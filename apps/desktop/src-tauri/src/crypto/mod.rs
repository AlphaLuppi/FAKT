//! Module crypto FAKT — PAdES B-T maison.
//!
//! Organisation :
//! - `error` : erreurs unifiées du module.
//! - `cert` : génération X.509 auto-signé RSA 4096 (FR-002).
//! - `keychain` : wrapper `keyring` + fallback AES-256-GCM fichier.
//! - `pades` : embed signature CMS dans PDF (FR-017).
//! - `tsa` : client RFC 3161 (FreeTSA + fallbacks).
//! - `audit` : chaîne de hash append-only (FR-018).
//! - `commands` : Tauri commands exposées à la webview.

pub mod audit;
pub mod cert;
pub mod commands;
pub mod error;
pub mod keychain;
pub mod pades;
pub mod tsa;
pub mod verify;

pub use commands::*;
pub use error::CryptoError;
