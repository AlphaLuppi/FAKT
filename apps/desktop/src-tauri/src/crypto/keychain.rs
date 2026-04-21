//! Stockage cross-OS de la clé privée RSA dans le keychain natif.
//!
//! **Stratégie :**
//! - Tente d'abord `keyring` crate (Windows Credential Manager, macOS Keychain,
//!   Linux Secret Service / keyutils).
//! - En cas d'échec (plateforme headless Linux, CI sans seahorse, permissions),
//!   fallback AES-256-GCM sur fichier chiffré avec clé dérivée d'un password
//!   utilisateur (PBKDF2-SHA256 100k iterations).
//!
//! **Formats :** la clé privée PKCS#8 DER est stockée en **bytes bruts** via
//! `set_secret` (et non `set_password` qui encode en UTF-16 et double la taille).
//! Windows Credential Manager impose `CRED_MAX_CREDENTIAL_BLOB_SIZE` = 2560 octets,
//! RSA 4096 PKCS#8 DER ~2300 octets → OK.

use std::fs;
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use pbkdf2::pbkdf2_hmac;
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;

use crate::crypto::error::{CryptoError, CryptoResult};

pub const SERVICE_NAME: &str = "fakt";
pub const DEFAULT_ACCOUNT: &str = "cert-main";

const PBKDF2_ITERATIONS: u32 = 100_000;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;

/// Tente de stocker la clé dans le keychain OS (bytes bruts via `set_secret`).
///
/// Retourne `Ok(())` si le keyring accepte. En cas d'échec plateforme,
/// renvoie `CryptoError::KeychainUnavailable` — l'appelant doit alors
/// basculer sur `store_in_fallback_file`.
pub fn store_in_keychain(account: &str, payload: &[u8]) -> CryptoResult<()> {
    let entry = keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| CryptoError::KeychainUnavailable(format!("entry: {}", e)))?;
    entry
        .set_secret(payload)
        .map_err(|e| CryptoError::KeychainUnavailable(format!("set_secret: {}", e)))?;
    Ok(())
}

/// Récupère la clé depuis le keychain OS (bytes bruts via `get_secret`).
pub fn load_from_keychain(account: &str) -> CryptoResult<Vec<u8>> {
    let entry = keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| CryptoError::KeychainUnavailable(format!("entry: {}", e)))?;
    match entry.get_secret() {
        Ok(bytes) => Ok(bytes),
        Err(keyring::Error::NoEntry) => Err(CryptoError::KeyNotFound(account.to_string())),
        Err(e) => Err(CryptoError::KeychainUnavailable(e.to_string())),
    }
}

/// Supprime l'entrée du keychain (utilisé lors d'une rotation).
pub fn delete_from_keychain(account: &str) -> CryptoResult<()> {
    let entry = keyring::Entry::new(SERVICE_NAME, account)
        .map_err(|e| CryptoError::KeychainUnavailable(format!("entry: {}", e)))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(CryptoError::KeychainUnavailable(e.to_string())),
    }
}

/// Enveloppe sérialisable du fichier fallback chiffré.
///
/// Structure binaire :
/// - 4 bytes magic "FAKT"
/// - 1 byte version (0x01)
/// - 16 bytes salt (PBKDF2)
/// - 4 bytes iterations (u32 LE)
/// - 12 bytes nonce (AES-GCM)
/// - N bytes ciphertext (dont tag GCM en suffixe)
struct FallbackEnvelope {
    salt: [u8; SALT_LEN],
    iterations: u32,
    nonce: [u8; NONCE_LEN],
    ciphertext: Vec<u8>,
}

const MAGIC: &[u8; 4] = b"FAKT";
const VERSION: u8 = 0x01;

impl FallbackEnvelope {
    fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(4 + 1 + SALT_LEN + 4 + NONCE_LEN + self.ciphertext.len());
        out.extend_from_slice(MAGIC);
        out.push(VERSION);
        out.extend_from_slice(&self.salt);
        out.extend_from_slice(&self.iterations.to_le_bytes());
        out.extend_from_slice(&self.nonce);
        out.extend_from_slice(&self.ciphertext);
        out
    }

    fn from_bytes(data: &[u8]) -> CryptoResult<Self> {
        if data.len() < 4 + 1 + SALT_LEN + 4 + NONCE_LEN {
            return Err(CryptoError::FallbackError("fichier tronqué".to_string()));
        }
        if &data[0..4] != MAGIC {
            return Err(CryptoError::FallbackError(
                "magic bytes invalides".to_string(),
            ));
        }
        if data[4] != VERSION {
            return Err(CryptoError::FallbackError(format!(
                "version non supportée : {}",
                data[4]
            )));
        }
        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&data[5..5 + SALT_LEN]);
        let iters_start = 5 + SALT_LEN;
        let iterations = u32::from_le_bytes([
            data[iters_start],
            data[iters_start + 1],
            data[iters_start + 2],
            data[iters_start + 3],
        ]);
        let nonce_start = iters_start + 4;
        let mut nonce = [0u8; NONCE_LEN];
        nonce.copy_from_slice(&data[nonce_start..nonce_start + NONCE_LEN]);
        let ciphertext = data[nonce_start + NONCE_LEN..].to_vec();
        Ok(Self {
            salt,
            iterations,
            nonce,
            ciphertext,
        })
    }
}

fn derive_key(password: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);
    key
}

/// Stocke la clé dans un fichier chiffré AES-256-GCM.
///
/// `path` : chemin complet du fichier (ex. `{tauri_data_dir}/cert-fallback.enc`).
/// `password` : passphrase utilisateur (jamais stockée, pour PBKDF2).
pub fn store_in_fallback_file(
    path: &Path,
    pkcs8_der: &[u8],
    password: &str,
) -> CryptoResult<()> {
    if password.is_empty() {
        return Err(CryptoError::FallbackError(
            "password vide interdit".to_string(),
        ));
    }

    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);

    let key = derive_key(password, &salt, PBKDF2_ITERATIONS);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::FallbackError(format!("aes init: {}", e)))?;

    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), pkcs8_der)
        .map_err(|e| CryptoError::FallbackError(format!("encrypt: {}", e)))?;

    let envelope = FallbackEnvelope {
        salt,
        iterations: PBKDF2_ITERATIONS,
        nonce,
        ciphertext,
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, envelope.to_bytes())?;
    Ok(())
}

/// Lit et déchiffre un fichier fallback.
pub fn load_from_fallback_file(path: &Path, password: &str) -> CryptoResult<Vec<u8>> {
    let data = fs::read(path)?;
    let env = FallbackEnvelope::from_bytes(&data)?;

    let key = derive_key(password, &env.salt, env.iterations);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| CryptoError::FallbackError(format!("aes init: {}", e)))?;

    cipher
        .decrypt(Nonce::from_slice(&env.nonce), env.ciphertext.as_slice())
        .map_err(|_| CryptoError::FallbackError("déchiffrement échoué (password ?)".to_string()))
}

/// API haut niveau : tente keychain, bascule sur fichier en cas d'échec.
///
/// Si `fallback_path` et `fallback_password` sont `None`, une erreur est
/// retournée au lieu de silently skip (éviter perte clé).
pub enum StoreOutcome {
    Keychain,
    Fallback(PathBuf),
}

pub fn store_private_key(
    account: &str,
    pkcs8_der: &[u8],
    fallback_path: Option<&Path>,
    fallback_password: Option<&str>,
) -> CryptoResult<StoreOutcome> {
    match store_in_keychain(account, pkcs8_der) {
        Ok(()) => Ok(StoreOutcome::Keychain),
        Err(keychain_err) => {
            match (fallback_path, fallback_password) {
                (Some(p), Some(pw)) => {
                    tracing::warn!(
                        target = "fakt::keychain",
                        error = %keychain_err,
                        "keychain indisponible, fallback fichier AES-GCM"
                    );
                    store_in_fallback_file(p, pkcs8_der, pw)?;
                    Ok(StoreOutcome::Fallback(p.to_path_buf()))
                }
                _ => Err(keychain_err),
            }
        }
    }
}

pub fn load_private_key(
    account: &str,
    fallback_path: Option<&Path>,
    fallback_password: Option<&str>,
) -> CryptoResult<Vec<u8>> {
    match load_from_keychain(account) {
        Ok(data) => Ok(data),
        Err(CryptoError::KeyNotFound(_)) => {
            // Pas d'entrée keyring → tenter fallback si configuré
            if let (Some(p), Some(pw)) = (fallback_path, fallback_password) {
                if p.exists() {
                    return load_from_fallback_file(p, pw);
                }
            }
            Err(CryptoError::KeyNotFound(account.to_string()))
        }
        Err(keychain_err) => {
            if let (Some(p), Some(pw)) = (fallback_path, fallback_password) {
                if p.exists() {
                    return load_from_fallback_file(p, pw);
                }
            }
            Err(keychain_err)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn fallback_file_roundtrip() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cert-fallback.enc");
        let data = b"pretend this is a pkcs8 RSA 4096 DER blob".to_vec();
        let pw = "correct horse battery staple";

        store_in_fallback_file(&path, &data, pw).expect("store ok");
        assert!(path.exists());

        let back = load_from_fallback_file(&path, pw).expect("load ok");
        assert_eq!(back, data);
    }

    #[test]
    fn fallback_wrong_password_fails() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cert-fallback.enc");
        store_in_fallback_file(&path, b"secret", "right").unwrap();
        let err = load_from_fallback_file(&path, "wrong").unwrap_err();
        assert!(matches!(err, CryptoError::FallbackError(_)));
    }

    #[test]
    fn fallback_rejects_empty_password() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("cert-fallback.enc");
        let err = store_in_fallback_file(&path, b"x", "").unwrap_err();
        assert!(matches!(err, CryptoError::FallbackError(_)));
    }

    #[test]
    fn envelope_bytes_shape() {
        let env = FallbackEnvelope {
            salt: [1u8; SALT_LEN],
            iterations: PBKDF2_ITERATIONS,
            nonce: [2u8; NONCE_LEN],
            ciphertext: vec![3, 4, 5],
        };
        let bytes = env.to_bytes();
        assert_eq!(&bytes[0..4], MAGIC);
        assert_eq!(bytes[4], VERSION);
        let round = FallbackEnvelope::from_bytes(&bytes).unwrap();
        assert_eq!(round.salt, env.salt);
        assert_eq!(round.iterations, env.iterations);
        assert_eq!(round.nonce, env.nonce);
        assert_eq!(round.ciphertext, env.ciphertext);
    }

    // Ce test dépend de la disponibilité d'un keychain OS.
    // En CI headless Linux, il peut échouer — on l'annote `ignore`.
    #[test]
    #[ignore = "dépend du keychain natif (OS interactif ou CI avec seahorse)"]
    fn keychain_roundtrip() {
        let account = format!("test-{}", uuid_like());
        let payload = b"test key material".to_vec();

        store_in_keychain(&account, &payload).expect("store ok");
        let back = load_from_keychain(&account).expect("load ok");
        assert_eq!(back, payload);

        delete_from_keychain(&account).expect("delete ok");
        let err = load_from_keychain(&account).unwrap_err();
        assert!(matches!(err, CryptoError::KeyNotFound(_)));
    }

    fn uuid_like() -> String {
        let mut b = [0u8; 16];
        OsRng.fill_bytes(&mut b);
        hex::encode(b)
    }
}
