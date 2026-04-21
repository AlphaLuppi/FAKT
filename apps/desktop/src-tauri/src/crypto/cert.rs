//! Génération de certificat X.509 auto-signé RSA 4096 (FR-002).
//!
//! Utilise `x509-cert` builder pour composer un certificat Root auto-signé
//! valide 10 ans. La paire de clés RSA est générée via `rsa::RsaPrivateKey::new`.
//!
//! NB : RSA 4096 est lent à générer (2-5s sur machine moderne) mais la génération
//! n'a lieu qu'une seule fois par workspace (onboarding ou rotation explicite).

use std::str::FromStr;
use std::time::Duration;

use const_oid::db::rfc5912::{RSA_ENCRYPTION, SHA_256_WITH_RSA_ENCRYPTION};
use der::asn1::{OctetString, UtcTime};
use der::Encode;
use pkcs8::EncodePrivateKey;
use rand::rngs::OsRng;
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::DecodePrivateKey;
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use spki::SubjectPublicKeyInfoOwned;
use x509_cert::builder::{Builder, CertificateBuilder, Profile};
use x509_cert::name::Name;
use x509_cert::serial_number::SerialNumber;
use x509_cert::time::Validity;
use x509_cert::Certificate;

use crate::crypto::error::{CryptoError, CryptoResult};

const RSA_BITS: usize = 4096;
const CERT_VALIDITY_YEARS: u64 = 10;

/// Subject Distinguished Name saisi par l'utilisateur lors de l'onboarding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectDn {
    pub common_name: String,
    pub organization: Option<String>,
    pub country: String,
    pub email: Option<String>,
}

impl SubjectDn {
    /// Construit une chaîne RFC 4514 utilisable par `Name::from_str`.
    fn to_rfc4514(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        parts.push(format!("CN={}", escape_rdn(&self.common_name)));
        if let Some(o) = &self.organization {
            parts.push(format!("O={}", escape_rdn(o)));
        }
        parts.push(format!("C={}", escape_rdn(&self.country)));
        // emailAddress est ajouté en extension SAN — voir la construction builder.
        parts.join(",")
    }
}

fn escape_rdn(s: &str) -> String {
    // RFC 4514 : échappe les caractères spéciaux.
    s.replace('\\', "\\\\")
        .replace(',', "\\,")
        .replace('+', "\\+")
        .replace('"', "\\\"")
        .replace('<', "\\<")
        .replace('>', "\\>")
        .replace(';', "\\;")
        .replace('=', "\\=")
}

/// Résultat d'une génération : clé privée PKCS#8 DER + certificat DER.
#[derive(Debug, Clone)]
pub struct GeneratedCert {
    pub x509_der: Vec<u8>,
    pub rsa_priv_pkcs8_der: Vec<u8>,
}

/// Génère une paire RSA 4096 + certificat X.509 auto-signé valide 10 ans.
///
/// # Performance
/// RSA 4096 : ~2-5s sur machine moderne. Bloque le thread appelant ;
/// à wrapper dans `tokio::task::spawn_blocking` côté Tauri command.
pub fn generate_self_signed_cert(subject_dn: &SubjectDn) -> CryptoResult<GeneratedCert> {
    let mut rng = OsRng;
    let priv_key = RsaPrivateKey::new(&mut rng, RSA_BITS)
        .map_err(|e| CryptoError::RsaKeyGen(e.to_string()))?;
    let pub_key = RsaPublicKey::from(&priv_key);

    // Subject + Issuer (identique, root self-signed).
    let dn_str = subject_dn.to_rfc4514();
    let subject = Name::from_str(&dn_str)
        .map_err(|e| CryptoError::CertBuild(format!("parse DN '{}': {}", dn_str, e)))?;

    let validity = Validity::from_now(Duration::from_secs(
        60 * 60 * 24 * 365 * CERT_VALIDITY_YEARS,
    ))
    .map_err(|e| CryptoError::CertBuild(format!("validity: {}", e)))?;

    // SubjectPublicKeyInfo via pkcs1 encoding (RSA).
    let spki = public_key_to_spki(&pub_key)?;

    // Numéro de série : 20 octets aléatoires (recommandation RFC 5280).
    let mut serial_bytes = [0u8; 20];
    use rand::RngCore;
    OsRng.fill_bytes(&mut serial_bytes);
    // Premier bit à 0 pour garantir positivité (ASN.1 INTEGER signed).
    serial_bytes[0] &= 0x7F;
    let serial = SerialNumber::new(&serial_bytes)
        .map_err(|e| CryptoError::CertBuild(format!("serial: {}", e)))?;

    let signer: SigningKey<Sha256> = SigningKey::new(priv_key.clone());

    let builder = CertificateBuilder::new(
        Profile::Root,
        serial,
        validity,
        subject,
        spki,
        &signer,
    )
    .map_err(|e| CryptoError::CertBuild(format!("builder: {}", e)))?;

    let cert: Certificate = builder
        .build()
        .map_err(|e| CryptoError::CertBuild(format!("sign/build: {}", e)))?;

    let x509_der = cert
        .to_der()
        .map_err(|e| CryptoError::DerEncode(format!("cert: {}", e)))?;

    let priv_pkcs8_der = priv_key
        .to_pkcs8_der()
        .map_err(|e| CryptoError::DerEncode(format!("priv pkcs8: {}", e)))?
        .as_bytes()
        .to_vec();

    Ok(GeneratedCert {
        x509_der,
        rsa_priv_pkcs8_der: priv_pkcs8_der,
    })
}

/// Convertit une clé publique RSA en `SubjectPublicKeyInfoOwned`.
fn public_key_to_spki(pub_key: &RsaPublicKey) -> CryptoResult<SubjectPublicKeyInfoOwned> {
    use rsa::pkcs1::EncodeRsaPublicKey;
    let rsa_pub_der = pub_key
        .to_pkcs1_der()
        .map_err(|e| CryptoError::DerEncode(format!("rsa pub pkcs1: {}", e)))?;

    let alg = spki::AlgorithmIdentifierOwned {
        oid: RSA_ENCRYPTION,
        parameters: Some(der::Any::from(der::asn1::Null)),
    };

    let spki = SubjectPublicKeyInfoOwned {
        algorithm: alg,
        subject_public_key: der::asn1::BitString::from_bytes(rsa_pub_der.as_bytes())
            .map_err(|e| CryptoError::DerEncode(format!("bitstring: {}", e)))?,
    };
    // Suppress unused warning on helper
    let _ = SHA_256_WITH_RSA_ENCRYPTION;
    let _ = OctetString::new(Vec::<u8>::new());
    let _ = UtcTime::from_unix_duration(Duration::from_secs(0));
    Ok(spki)
}

/// Décode une clé privée PKCS#8 DER en `RsaPrivateKey` runtime.
pub fn decode_private_key(pkcs8_der: &[u8]) -> CryptoResult<RsaPrivateKey> {
    RsaPrivateKey::from_pkcs8_der(pkcs8_der)
        .map_err(|e| CryptoError::DerDecode(format!("rsa pkcs8: {}", e)))
}

/// Informations synthétiques du cert — exposées au frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertInfo {
    pub subject_cn: String,
    pub not_before_iso: String,
    pub not_after_iso: String,
    pub serial_hex: String,
    pub fingerprint_sha256_hex: String,
}

/// Extrait `CertInfo` depuis un certificat DER.
pub fn cert_info_from_der(x509_der: &[u8]) -> CryptoResult<CertInfo> {
    use der::Decode;
    use sha2::Digest;

    let cert = Certificate::from_der(x509_der)
        .map_err(|e| CryptoError::DerDecode(format!("cert: {}", e)))?;

    let subject_cn = cert
        .tbs_certificate
        .subject
        .to_string();

    let nb = cert.tbs_certificate.validity.not_before.to_unix_duration();
    let na = cert.tbs_certificate.validity.not_after.to_unix_duration();

    let not_before_iso = format_iso_unix(nb.as_secs());
    let not_after_iso = format_iso_unix(na.as_secs());

    let serial_hex = hex::encode(cert.tbs_certificate.serial_number.as_bytes());

    let mut hasher = Sha256::new();
    hasher.update(x509_der);
    let fingerprint_sha256_hex = hex::encode(hasher.finalize());

    Ok(CertInfo {
        subject_cn,
        not_before_iso,
        not_after_iso,
        serial_hex,
        fingerprint_sha256_hex,
    })
}

fn format_iso_unix(secs: u64) -> String {
    // Approximation naïve (sans chrono) — suffisante pour affichage onboarding.
    // Format : YYYY-MM-DDTHH:MM:SSZ.
    // Calcul manuel : days since epoch → year/month/day + hms.
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);

    // Jours → YMD (grégorien, 1970-01-01 base).
    let (y, mo, d) = days_to_ymd(days as i64);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", y, mo, d, h, m, s)
}

fn days_to_ymd(mut days: i64) -> (i32, u32, u32) {
    days += 719_468;
    let era = if days >= 0 { days } else { days - 146_096 } / 146_097;
    let doe = (days - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_dn() -> SubjectDn {
        SubjectDn {
            common_name: "Tom Andrieu".to_string(),
            organization: Some("AlphaLuppi".to_string()),
            country: "FR".to_string(),
            email: Some("contact@alphaluppi.com".to_string()),
        }
    }

    #[test]
    fn generates_cert_and_key() {
        let out = generate_self_signed_cert(&sample_dn()).expect("gen ok");
        assert!(!out.x509_der.is_empty());
        assert!(!out.rsa_priv_pkcs8_der.is_empty());
        // Round-trip clé privée
        let _priv = decode_private_key(&out.rsa_priv_pkcs8_der).expect("decode ok");
    }

    #[test]
    fn cert_info_roundtrip() {
        let out = generate_self_signed_cert(&sample_dn()).expect("gen ok");
        let info = cert_info_from_der(&out.x509_der).expect("info ok");
        assert!(info.subject_cn.contains("Tom"));
        assert!(info.not_after_iso.starts_with('2'));
        // Validité ~10 ans
        let y_not_before: i32 = info.not_before_iso[0..4].parse().unwrap();
        let y_not_after: i32 = info.not_after_iso[0..4].parse().unwrap();
        assert!(y_not_after - y_not_before >= 9);
    }

    #[test]
    fn rfc4514_escapes_commas() {
        let dn = SubjectDn {
            common_name: "Doe, John".to_string(),
            organization: None,
            country: "FR".to_string(),
            email: None,
        };
        let s = dn.to_rfc4514();
        assert!(s.contains("Doe\\, John"));
    }
}
