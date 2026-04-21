//! Client TSA (Time Stamping Authority) RFC 3161.
//!
//! Flow :
//! 1. Construit un `TimeStampReq` ASN.1 DER avec le hash SHA-256 à horodater.
//! 2. POST à l'endpoint TSA avec Content-Type `application/timestamp-query`.
//! 3. Reçoit une `TimeStampResp` DER contenant un `TimeStampToken` (CMS SignedData).
//! 4. Extrait le TST et le retourne pour embed dans le CMS PAdES (UnsignedAttribute).
//!
//! **Endpoints** (ordre de fallback) :
//! - `https://freetsa.org/tsr` (primaire, gratuit, SHA-256)
//! - `http://timestamp.digicert.com` (fallback 1)
//! - `http://timestamp.sectigo.com` (fallback 2)
//!
//! Timeout 10s par endpoint, 1 retry chacun.

use std::time::Duration;

use const_oid::ObjectIdentifier;
use der::asn1::{Int, OctetString};
use der::{Decode, Encode, Sequence};
use rand::RngCore;
use sha2::{Digest, Sha256};
use spki::AlgorithmIdentifierOwned;

use crate::crypto::error::{CryptoError, CryptoResult};

pub const FREETSA_URL: &str = "https://freetsa.org/tsr";
pub const DIGICERT_URL: &str = "http://timestamp.digicert.com";
pub const SECTIGO_URL: &str = "http://timestamp.sectigo.com";

pub const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
pub const TSA_CONTENT_TYPE_QUERY: &str = "application/timestamp-query";
pub const TSA_CONTENT_TYPE_REPLY: &str = "application/timestamp-reply";

const OID_ID_SHA_256: &str = "2.16.840.1.101.3.4.2.1";

/// TSA endpoints ordonnés (primaire → fallbacks).
pub fn default_endpoints() -> Vec<&'static str> {
    vec![FREETSA_URL, DIGICERT_URL, SECTIGO_URL]
}

/// Résultat d'une requête TSA.
#[derive(Debug, Clone)]
pub struct TimestampToken {
    /// TST DER — CMS SignedData wrapping TSTInfo. À embedder dans le CMS PAdES
    /// comme UnsignedAttribute `id-smime-aa-timeStampToken`.
    pub tst_der: Vec<u8>,
    pub provider_url: String,
}

// ===== ASN.1 structures RFC 3161 =====

#[derive(Sequence)]
struct MessageImprint {
    hash_algorithm: AlgorithmIdentifierOwned,
    hashed_message: OctetString,
}

#[derive(Sequence)]
struct TimeStampReq {
    version: Int,
    message_imprint: MessageImprint,
    /*
     * Champs optionnels : reqPolicy, nonce, certReq, extensions.
     * Pour simplicité du POC on envoie : version=1, messageImprint, nonce, certReq=true
     * (le TSA inclut son cert dans la réponse → embarquable).
     * Le der::Sequence derive ne supporte pas directement OPTIONAL avec defaults —
     * on gère manuellement via encode_to_vec si besoin. Pour POC minimaliste, on
     * inclut uniquement version + messageImprint + nonce + certReq pour maximiser
     * la compatibilité avec FreeTSA.
     */
    nonce: Int,
    cert_req: bool,
}

/// Construit un TSQ DER pour le digest SHA-256 donné.
pub fn build_timestamp_query(sha256_digest: &[u8; 32]) -> CryptoResult<Vec<u8>> {
    let hash_algo = AlgorithmIdentifierOwned {
        oid: OID_ID_SHA_256
            .parse::<ObjectIdentifier>()
            .map_err(|e| CryptoError::TsaError(format!("oid: {}", e)))?,
        parameters: None,
    };
    let hashed_message =
        OctetString::new(sha256_digest.to_vec()).map_err(|e| CryptoError::TsaError(format!("octet: {}", e)))?;

    let message_imprint = MessageImprint {
        hash_algorithm: hash_algo,
        hashed_message,
    };

    let mut nonce_bytes = [0u8; 8];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    // Clear sign bit for positive INTEGER.
    nonce_bytes[0] &= 0x7F;

    let version = Int::new(&[1u8]).map_err(|e| CryptoError::TsaError(format!("int version: {}", e)))?;
    let nonce = Int::new(&nonce_bytes).map_err(|e| CryptoError::TsaError(format!("int nonce: {}", e)))?;

    let tsq = TimeStampReq {
        version,
        message_imprint,
        nonce,
        cert_req: true,
    };

    tsq.to_der()
        .map_err(|e| CryptoError::TsaError(format!("tsq encode: {}", e)))
}

// ===== TimeStampResp =====

// TimeStampResp ::= SEQUENCE { status PKIStatusInfo, timeStampToken TimeStampToken OPTIONAL }
// PKIStatusInfo ::= SEQUENCE { status INTEGER, statusString UTF8String OPTIONAL, failInfo BIT STRING OPTIONAL }
//
// On parse juste le minimum : status (doit être 0 = granted) + TimeStampToken DER brut.

#[derive(Sequence)]
struct PkiStatusInfo {
    status: Int,
    // statusString et failInfo optionnels — non parsés ici.
}

/// Extrait le TimeStampToken DER d'une TimeStampResp, ou une erreur si status != granted.
pub fn parse_timestamp_response(tsr_der: &[u8]) -> CryptoResult<Vec<u8>> {
    use der::{Reader, SliceReader, Tag, TagNumber};

    let mut reader =
        SliceReader::new(tsr_der).map_err(|e| CryptoError::TsaError(format!("reader: {}", e)))?;

    // TimeStampResp ::= SEQUENCE { ... }
    let header = reader
        .peek_header()
        .map_err(|e| CryptoError::TsaError(format!("peek: {}", e)))?;
    if header.tag != Tag::Sequence {
        return Err(CryptoError::TsaError(format!(
            "expected SEQUENCE, got {:?}",
            header.tag
        )));
    }

    // Take the SEQUENCE inner bytes.
    let seq_any: der::Any = der::Any::decode(&mut reader)
        .map_err(|e| CryptoError::TsaError(format!("seq decode: {}", e)))?;
    let inner = seq_any.value();

    // Parse inner = PKIStatusInfo SEQUENCE + optional TimeStampToken ContentInfo.
    let mut inner_reader = SliceReader::new(inner)
        .map_err(|e| CryptoError::TsaError(format!("inner reader: {}", e)))?;

    // Lire PKIStatusInfo.
    let status_info: PkiStatusInfo = PkiStatusInfo::decode(&mut inner_reader)
        .map_err(|e| CryptoError::TsaError(format!("status info: {}", e)))?;
    let status_bytes = status_info.status.as_bytes();
    let status_val = if status_bytes.is_empty() {
        0
    } else {
        status_bytes[0]
    };
    if status_val != 0 && status_val != 1 {
        return Err(CryptoError::TsaError(format!(
            "TSA returned non-granted status {}",
            status_val
        )));
    }

    // Le reste = TimeStampToken (ContentInfo CMS SignedData).
    if inner_reader.is_finished() {
        return Err(CryptoError::TsaError(
            "TSA response without TimeStampToken".to_string(),
        ));
    }

    // Le TimeStampToken est un ContentInfo (SEQUENCE). On le lit tel quel.
    let token_any: der::Any = der::Any::decode(&mut inner_reader)
        .map_err(|e| CryptoError::TsaError(format!("token decode: {}", e)))?;
    let tst_der = token_any
        .to_der()
        .map_err(|e| CryptoError::TsaError(format!("token encode: {}", e)))?;

    // Silence unused imports
    let _ = TagNumber::N0;

    Ok(tst_der)
}

// ===== HTTP client =====

/// Envoie le TSQ à l'endpoint et retourne la TSR DER brute.
pub fn post_tsq_blocking(url: &str, tsq_der: &[u8]) -> CryptoResult<Vec<u8>> {
    let client = reqwest::blocking::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|e| CryptoError::TsaError(format!("client: {}", e)))?;

    let resp = client
        .post(url)
        .header(reqwest::header::CONTENT_TYPE, TSA_CONTENT_TYPE_QUERY)
        .header(reqwest::header::ACCEPT, TSA_CONTENT_TYPE_REPLY)
        .body(tsq_der.to_vec())
        .send()
        .map_err(|e| CryptoError::TsaError(format!("post: {}", e)))?;

    if !resp.status().is_success() {
        return Err(CryptoError::TsaError(format!(
            "TSA HTTP status {}",
            resp.status()
        )));
    }

    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if !ct.contains("timestamp-reply") && !ct.contains("application/octet-stream") {
        tracing::warn!(target = "fakt::tsa", url, content_type = %ct, "unexpected TSA content-type");
    }

    resp.bytes()
        .map(|b| b.to_vec())
        .map_err(|e| CryptoError::TsaError(format!("body: {}", e)))
}

/// Demande un timestamp pour le digest donné. Tente chaque endpoint dans l'ordre.
///
/// `endpoints` : liste ordonnée (primaire + fallbacks). Utiliser `default_endpoints()`.
pub fn request_timestamp(
    sha256_digest: &[u8; 32],
    endpoints: &[&str],
) -> CryptoResult<TimestampToken> {
    let tsq = build_timestamp_query(sha256_digest)?;

    let mut last_err: Option<CryptoError> = None;
    for url in endpoints {
        // 1 retry par endpoint.
        for attempt in 0..2 {
            match post_tsq_blocking(url, &tsq) {
                Ok(tsr_der) => match parse_timestamp_response(&tsr_der) {
                    Ok(tst_der) => {
                        return Ok(TimestampToken {
                            tst_der,
                            provider_url: url.to_string(),
                        });
                    }
                    Err(e) => {
                        tracing::warn!(
                            target = "fakt::tsa",
                            url,
                            attempt,
                            error = %e,
                            "TSA response parse failed"
                        );
                        last_err = Some(e);
                    }
                },
                Err(e) => {
                    tracing::warn!(
                        target = "fakt::tsa",
                        url,
                        attempt,
                        error = %e,
                        "TSA request failed"
                    );
                    last_err = Some(e);
                }
            }
        }
    }

    Err(last_err.unwrap_or_else(|| CryptoError::TsaError("all TSA providers failed".to_string())))
}

/// Calcule le digest SHA-256 de la signature RSA + demande un timestamp RFC 3161.
///
/// Retourne le TimeStampToken prêt à embedder dans le CMS comme UnsignedAttribute.
///
/// Helper pour Track D3 — flow exact : on timestamp le **hash de la signature**
/// RSA (pas le hash du document), conformément à RFC 3161 / PAdES B-T où
/// `timeStampToken` atteste du moment où la signature a été posée.
pub fn request_signature_timestamp(
    rsa_signature: &[u8],
    endpoints: &[&str],
) -> CryptoResult<TimestampToken> {
    let mut h = Sha256::new();
    h.update(rsa_signature);
    let digest: [u8; 32] = h.finalize().into();
    request_timestamp(&digest, endpoints)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_tsq_der() {
        let digest = [0x11u8; 32];
        let tsq = build_timestamp_query(&digest).expect("build tsq");
        // Doit commencer par SEQUENCE tag (0x30).
        assert_eq!(tsq[0], 0x30);
        // Le digest doit apparaître quelque part.
        let idx = tsq.windows(32).position(|w| w == digest).expect("digest in tsq");
        assert!(idx > 0);
    }

    #[test]
    fn parse_bad_response_rejects() {
        let err = parse_timestamp_response(b"not a tsr").unwrap_err();
        assert!(matches!(err, CryptoError::TsaError(_)));
    }

    /// Simule une TSR granted avec un TimeStampToken trivial.
    #[test]
    fn parse_granted_minimal_tsr() {
        use der::{asn1::Int, Encode, Sequence};

        #[derive(Sequence)]
        struct MinimalToken {
            // ContentInfo-like SEQUENCE pour le test.
            dummy: Int,
        }

        #[derive(Sequence)]
        struct MinimalTsr {
            status_info: PkiStatusInfo,
            token: MinimalToken,
        }

        let tsr = MinimalTsr {
            status_info: PkiStatusInfo {
                status: Int::new(&[0u8]).unwrap(),
            },
            token: MinimalToken {
                dummy: Int::new(&[42u8]).unwrap(),
            },
        };
        let tsr_der = tsr.to_der().unwrap();
        let tst_der = parse_timestamp_response(&tsr_der).expect("parse ok");
        assert!(!tst_der.is_empty());
    }

    #[test]
    fn parse_rejected_status_fails() {
        use der::{asn1::Int, Encode, Sequence};

        #[derive(Sequence)]
        struct MinimalTsr {
            status_info: PkiStatusInfo,
        }

        let tsr = MinimalTsr {
            status_info: PkiStatusInfo {
                status: Int::new(&[2u8]).unwrap(), // 2 = rejection
            },
        };
        let tsr_der = tsr.to_der().unwrap();
        let err = parse_timestamp_response(&tsr_der).unwrap_err();
        assert!(matches!(err, CryptoError::TsaError(_)));
    }

    // Test réseau — ignoré par défaut pour CI déterministe.
    #[test]
    #[ignore = "network test: real TSA FreeTSA call"]
    fn live_freetsa_roundtrip() {
        let digest = [0xAAu8; 32];
        let token = request_timestamp(&digest, &[FREETSA_URL]).expect("freetsa");
        assert!(!token.tst_der.is_empty());
        assert_eq!(token.provider_url, FREETSA_URL);
        // Le TST doit être une SEQUENCE DER.
        assert_eq!(token.tst_der[0], 0x30);
    }
}
