//! Tauri commands exposées au frontend pour le module crypto.
//!
//! Conventions :
//! - Les payloads binaires (DER, PKCS#8) sont transportés via `Vec<u8>` — Tauri
//!   sérialise en tableau JSON de bytes, coûteux mais lisible côté TS.
//! - Les opérations lourdes (RSA 4096) passent par `tokio::task::spawn_blocking`
//!   pour ne pas bloquer la tokio runtime.
//! - Toutes les erreurs sont `CryptoError` (Serialize impl dans error.rs).

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::crypto::cert::{
    cert_info_from_der, generate_self_signed_cert, CertInfo, GeneratedCert, SubjectDn,
};
use crate::crypto::error::{CryptoError, CryptoResult};
use crate::crypto::keychain::{self, DEFAULT_ACCOUNT};

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
