//! Tauri commands exposées au frontend pour le module crypto.
//!
//! Conventions :
//! - Les payloads binaires (DER, PKCS#8) sont transportés via `Vec<u8>` — Tauri
//!   sérialise en tableau JSON de bytes, coûteux mais lisible côté TS.
//! - Les opérations lourdes (RSA 4096) passent par `tokio::task::spawn_blocking`
//!   pour ne pas bloquer la tokio runtime.
//! - Toutes les erreurs sont `CryptoError` (Serialize impl dans error.rs).

use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::crypto::audit::{self, SignatureEvent};
use crate::crypto::audit_client;
use crate::crypto::cert::{
    cert_info_from_der, generate_self_signed_cert, CertInfo, GeneratedCert, SubjectDn,
};
use crate::crypto::error::{CryptoError, CryptoResult};
use crate::crypto::keychain::{self, DEFAULT_ACCOUNT};
use crate::crypto::pades::embed_signature_with_timestamp;
use crate::crypto::tsa::{self, default_endpoints, TimestampToken};

/// Payload retourné au frontend après génération/rotation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertGenerationResult {
    pub info: CertInfo,
    /// PEM encoding du certificat public (pour enregistrement DB `settings`).
    pub cert_pem: String,
    /// Où la clé a été persistée.
    pub storage: StorageLocation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum StorageLocation {
    Keychain,
    FallbackFile { path: String },
}

fn to_pem(x509_der: &[u8]) -> String {
    use base64::engine::general_purpose::STANDARD as B64;
    use base64::Engine;
    let b64 = B64.encode(x509_der);
    let mut pem = String::from("-----BEGIN CERTIFICATE-----\n");
    for chunk in b64.as_bytes().chunks(64) {
        pem.push_str(std::str::from_utf8(chunk).unwrap());
        pem.push('\n');
    }
    pem.push_str("-----END CERTIFICATE-----\n");
    pem
}

fn default_fallback_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("cert-fallback.enc"))
}

#[tauri::command]
pub async fn generate_cert(
    app: AppHandle,
    subject_dn: SubjectDn,
    fallback_password: Option<String>,
) -> CryptoResult<CertGenerationResult> {
    let fallback_path = default_fallback_path(&app);

    let dn = subject_dn.clone();
    let generated: GeneratedCert = tokio::task::spawn_blocking(move || -> CryptoResult<GeneratedCert> {
        generate_self_signed_cert(&dn)
    })
    .await
    .map_err(|e| CryptoError::RsaKeyGen(format!("join blocking: {}", e)))??;

    let outcome = keychain::store_private_key(
        DEFAULT_ACCOUNT,
        &generated.rsa_priv_pkcs8_der,
        fallback_path.as_deref(),
        fallback_password.as_deref(),
    )?;

    let storage = match outcome {
        keychain::StoreOutcome::Keychain => StorageLocation::Keychain,
        keychain::StoreOutcome::Fallback(p) => StorageLocation::FallbackFile {
            path: p.to_string_lossy().into_owned(),
        },
    };

    let info = cert_info_from_der(&generated.x509_der)?;
    let cert_pem = to_pem(&generated.x509_der);

    // On stocke le cert DER public dans le keychain aussi (account séparé) pour
    // pouvoir le re-récupérer sans dépendre de la DB. Taille ~1.5 KB, OK.
    keychain::store_in_keychain(
        &format!("{}-cert-der", DEFAULT_ACCOUNT),
        &generated.x509_der,
    )
    .ok(); // best-effort — la DB reste la source de vérité (settings table)

    Ok(CertGenerationResult {
        info,
        cert_pem,
        storage,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GetCertInfoArgs {
    #[serde(default)]
    pub fallback_password: Option<String>,
}

#[tauri::command]
pub async fn get_cert_info(
    app: AppHandle,
    fallback_password: Option<String>,
) -> CryptoResult<Option<CertInfo>> {
    // Essai keychain DER d'abord (best-effort).
    match keychain::load_from_keychain(&format!("{}-cert-der", DEFAULT_ACCOUNT)) {
        Ok(der) => {
            let info = cert_info_from_der(&der)?;
            return Ok(Some(info));
        }
        Err(CryptoError::KeyNotFound(_)) => {}
        Err(_) => {}
    }

    // Pas de cert dans le keychain — vérifier si une clé privée existe au moins.
    let fallback_path = default_fallback_path(&app);
    match keychain::load_private_key(
        DEFAULT_ACCOUNT,
        fallback_path.as_deref(),
        fallback_password.as_deref(),
    ) {
        Ok(_) => {
            // Clé existe mais pas le cert DER — état inconsistent, signaler null.
            Ok(None)
        }
        Err(CryptoError::KeyNotFound(_)) => Ok(None),
        Err(e) => Err(e),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotateCertArgs {
    pub subject_dn: SubjectDn,
    pub fallback_password: Option<String>,
    /// Si `true`, archive l'ancien cert dans le keychain sous un account horodaté
    /// pour préserver l'audit trail avant rotation.
    #[serde(default = "default_true")]
    pub archive_previous: bool,
}

fn default_true() -> bool {
    true
}

#[tauri::command]
pub async fn rotate_cert(
    app: AppHandle,
    args: RotateCertArgs,
) -> CryptoResult<CertGenerationResult> {
    if args.archive_previous {
        if let Ok(old_der) =
            keychain::load_from_keychain(&format!("{}-cert-der", DEFAULT_ACCOUNT))
        {
            let archive_account = format!(
                "{}-archive-{}",
                DEFAULT_ACCOUNT,
                chrono_like_timestamp()
            );
            keychain::store_in_keychain(&archive_account, &old_der).ok();
        }
    }

    // Re-génère un nouveau cert + écrase la clé existante.
    generate_cert(app, args.subject_dn, args.fallback_password).await
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

// ===== Sign document (orchestration D1 + D2 + D3) =====

/// Arguments du sign_document command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignDocumentArgs {
    pub doc_id: String,
    /// Type ("quote" | "invoice") — utilisé dans l'audit trail.
    pub doc_type: String,
    pub signer_name: String,
    pub signer_email: String,
    /// PDF source à signer (bytes).
    pub pdf_bytes: Vec<u8>,
    /// PNG du signage manuscrit (optionnel, embed visuel v0.2).
    pub signature_png: Vec<u8>,
    /// Dernier événement de la chaîne (pour `previous_event_hash`).
    /// Le consumer TS lit `SELECT ... FROM signature_events ORDER BY timestamp DESC LIMIT 1`
    /// et passe le résultat.
    #[serde(default)]
    pub previous_event: Option<SignatureEvent>,
    /// Password pour fallback AES si keychain indisponible.
    #[serde(default)]
    pub fallback_password: Option<String>,
    /// Si `true`, skip TSA (PAdES-B au lieu de PAdES-B-T). Mode offline / debug.
    #[serde(default)]
    pub skip_tsa: bool,
}

/// Résultat du sign_document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignDocumentResult {
    /// PDF signé (bytes).
    pub signed_pdf: Vec<u8>,
    /// Événement à insérer en DB via Tauri event côté TS.
    pub signature_event: SignatureEvent,
    /// Fournisseur TSA effectivement utilisé, None si PAdES-B sans timestamp.
    pub tsa_provider_used: Option<String>,
    /// Niveau atteint : "B" ou "B-T".
    pub pades_level: String,
}

/// Orchestre D1 (retrieve cert/key) + D2 (embed PAdES) + D3 (TSA timestamp + audit).
#[tauri::command]
pub async fn sign_document(
    app: AppHandle,
    args: SignDocumentArgs,
) -> CryptoResult<SignDocumentResult> {
    // 1. Récupérer cert + clé privée du keychain.
    let fallback_path = default_fallback_path(&app);
    let priv_pkcs8 = keychain::load_private_key(
        DEFAULT_ACCOUNT,
        fallback_path.as_deref(),
        args.fallback_password.as_deref(),
    )?;
    let cert_der = keychain::load_from_keychain(&format!("{}-cert-der", DEFAULT_ACCOUNT))?;

    // 2. D2 embed PAdES (d'abord sans TSR pour pouvoir signer, puis on ajoute le TSR au 2e pass).
    //
    // Pour PAdES-B-T, l'approche rigoureuse c'est :
    //   a) Signer et embed PAdES-B (sans TSR).
    //   b) Hasher la signature RSA produite.
    //   c) Demander TSR pour ce hash.
    //   d) Re-embed avec TSR en UnsignedAttribute.
    //
    // Pour simplicité POC : on fait directement un embed WITHOUT tsr (PAdES-B),
    // puis on récupère la signature RSA depuis le CMS, on demande TSR, puis on
    // re-embed avec TSR. C'est un léger overhead mais le POC reste propre.

    let pdf_bytes = args.pdf_bytes.clone();
    let cert_der_for_task = cert_der.clone();
    let priv_for_task = priv_pkcs8.clone();
    let png_for_task = args.signature_png.clone();

    let signed_b = tokio::task::spawn_blocking(move || {
        embed_signature_with_timestamp(
            &pdf_bytes,
            &cert_der_for_task,
            &priv_for_task,
            &png_for_task,
            None,
        )
    })
    .await
    .map_err(|e| CryptoError::SignError(format!("join: {}", e)))??;

    // 3. TSA round-trip.
    let (final_pdf, tsa_used) = if args.skip_tsa {
        (signed_b.pdf_bytes, None)
    } else {
        match request_tsa_for_signature(&signed_b.cms_der).await {
            Ok(token) => {
                // Re-embed avec TSR inside UnsignedAttribute.
                let tsr = token.tst_der.clone();
                let pdf2 = args.pdf_bytes.clone();
                let cert2 = cert_der.clone();
                let priv2 = priv_pkcs8.clone();
                let png2 = args.signature_png.clone();

                let signed_bt = tokio::task::spawn_blocking(move || {
                    embed_signature_with_timestamp(&pdf2, &cert2, &priv2, &png2, Some(&tsr))
                })
                .await
                .map_err(|e| CryptoError::SignError(format!("join2: {}", e)))??;

                (signed_bt.pdf_bytes, Some(token.provider_url))
            }
            Err(e) => {
                tracing::warn!(target = "fakt::sign", error = %e, "TSA failed, falling back to PAdES-B");
                (signed_b.pdf_bytes, None)
            }
        }
    };

    // 4. Audit event.
    let doc_hash_after_hex = hex::encode(sha256(&final_pdf));
    let doc_hash_before_hex = hex::encode(signed_b.doc_hash_before_sha256);

    let previous_hash_hex = audit::compute_previous_hash(args.previous_event.as_ref());

    let event = SignatureEvent {
        id: new_uuid_like(),
        document_type: args.doc_type,
        document_id: args.doc_id,
        signer_name: args.signer_name,
        signer_email: args.signer_email,
        ip_address: None,
        user_agent: None,
        timestamp_iso: iso_now(),
        doc_hash_before: doc_hash_before_hex,
        doc_hash_after: doc_hash_after_hex,
        signature_png_base64: if args.signature_png.is_empty() {
            None
        } else {
            Some(B64.encode(&args.signature_png))
        },
        tsa_provider: tsa_used.clone(),
        tsa_response_base64: None, // le TSR est déjà embedded dans le PDF signé
        previous_event_hash: previous_hash_hex,
    };

    let pades_level = if tsa_used.is_some() {
        "B-T".to_string()
    } else {
        "B".to_string()
    };

    // 5. Persist audit event via api-server HTTP POST (best-effort).
    // Remplace l'ancien `AppState::append_signature_event` qui stockait en RAM
    // uniquement. Cf. docs/sprint-notes/e2e-wiring-audit.md §6.2.
    audit_client::post_signature_event_best_effort(&app, &event).await;

    Ok(SignDocumentResult {
        signed_pdf: final_pdf,
        signature_event: event,
        tsa_provider_used: tsa_used,
        pades_level,
    })
}

/// Construit le messageImprint du TimeStampReq conformément à RFC 3161 §2.5
/// pour une signature PAdES-B-T : SHA-256 du `SignerInfo.signature` BIT STRING
/// value, pas du CMS SignedData entier.
///
/// Exposée `pub` pour les tests d'intégration (`tests/tsa_hash_correctness.rs`).
pub fn tsa_imprint_for_cms(cms_der: &[u8]) -> CryptoResult<[u8; 32]> {
    use cms::content_info::ContentInfo;
    use cms::signed_data::SignedData;
    use der::Decode;
    use sha2::{Digest, Sha256};

    let ci = ContentInfo::from_der(cms_der)
        .map_err(|e| CryptoError::TsaError(format!("ci parse: {}", e)))?;
    let sd: SignedData = ci
        .content
        .decode_as()
        .map_err(|e| CryptoError::TsaError(format!("sd parse: {}", e)))?;
    let si = sd
        .signer_infos
        .0
        .as_slice()
        .first()
        .ok_or_else(|| CryptoError::TsaError("no signer info".to_string()))?;
    let sig_bytes = si.signature.as_bytes();

    let mut h = Sha256::new();
    h.update(sig_bytes);
    Ok(h.finalize().into())
}

async fn request_tsa_for_signature(cms_der: &[u8]) -> CryptoResult<TimestampToken> {
    let digest = tsa_imprint_for_cms(cms_der)?;
    let endpoints = default_endpoints();
    tokio::task::spawn_blocking(move || tsa::request_timestamp(&digest, &endpoints))
        .await
        .map_err(|e| CryptoError::TsaError(format!("join: {}", e)))?
}

fn sha256(data: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    let mut h = sha2::Sha256::new();
    h.update(data);
    h.finalize().into()
}

fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, mo, d) = days_to_ymd(days as i64);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, mo, d, h, m, s
    )
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

fn new_uuid_like() -> String {
    use rand::RngCore;
    let mut b = [0u8; 16];
    rand::rngs::OsRng.fill_bytes(&mut b);
    hex::encode(b)
}
