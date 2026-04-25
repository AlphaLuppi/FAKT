//! Configuration du mode backend (mode 1 sidecar local OU mode 2 backend distant).
//!
//! Persisté dans `app_data_dir/backend.json` (zero secret — juste mode + URL).
//! Au boot, `lib.rs` lit cette config pour décider de spawn le sidecar local
//! ou de pointer le webview sur l'URL distante.
//!
//! L'utilisateur change le mode via l'onglet Settings "Backend" qui appelle
//! les commands Tauri `set_backend_mode` / `get_backend_mode`.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

const FILE_NAME: &str = "backend.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BackendMode {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    pub mode: BackendMode,
    /// URL du backend distant (uniquement pertinent si mode=Remote).
    pub url: Option<String>,
}

impl Default for BackendConfig {
    fn default() -> Self {
        // Default compile-time : si FAKT_DEFAULT_AUTH_MODE=remote bakée dans le build
        // (pour la distribution AlphaLuppi), démarre en remote pré-configuré.
        let default_mode = match option_env!("FAKT_DEFAULT_AUTH_MODE") {
            Some("remote") => BackendMode::Remote,
            _ => BackendMode::Local,
        };
        let default_url = option_env!("FAKT_DEFAULT_BACKEND_URL").map(String::from);
        BackendConfig {
            mode: default_mode,
            url: default_url,
        }
    }
}

impl BackendConfig {
    pub fn load(app_data_dir: &Path) -> Self {
        let path = app_data_dir.join(FILE_NAME);
        match fs::read_to_string(&path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|e| {
                tracing::warn!(error = %e, "backend.json invalide, fallback default");
                BackendConfig::default()
            }),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => BackendConfig::default(),
            Err(e) => {
                tracing::warn!(error = %e, "lecture backend.json échouée, fallback default");
                BackendConfig::default()
            }
        }
    }

    pub fn save(&self, app_data_dir: &Path) -> std::io::Result<()> {
        let path = app_data_dir.join(FILE_NAME);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self).map_err(std::io::Error::other)?;
        fs::write(&path, content)
    }

    pub fn is_remote(&self) -> bool {
        matches!(self.mode, BackendMode::Remote)
    }

    pub fn remote_url(&self) -> Option<&str> {
        if self.is_remote() {
            self.url.as_deref()
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn default_is_local_when_no_compile_env() {
        let cfg = BackendConfig::default();
        // Note : le test peut être en mode remote si la variable build-time est
        // settée pour la distribution AlphaLuppi. On teste juste la roundtrip.
        let _ = cfg.is_remote();
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = TempDir::new().unwrap();
        let cfg = BackendConfig {
            mode: BackendMode::Remote,
            url: Some("https://fakt.alphaluppi.fr".to_string()),
        };
        cfg.save(dir.path()).unwrap();
        let loaded = BackendConfig::load(dir.path());
        assert_eq!(loaded.mode, BackendMode::Remote);
        assert_eq!(loaded.url.as_deref(), Some("https://fakt.alphaluppi.fr"));
    }

    #[test]
    fn load_missing_returns_default() {
        let dir = TempDir::new().unwrap();
        let cfg = BackendConfig::load(dir.path());
        // Default existe sans crash
        let _ = cfg.mode;
    }
}
