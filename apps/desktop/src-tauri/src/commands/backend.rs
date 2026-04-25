//! Commands Tauri pour gérer le mode backend (local sidecar OU remote self-host).
//!
//! Persiste dans `app_data_dir/backend.json` via `backend_config::BackendConfig`.
//! Au prochain restart de l'app, `lib.rs` lit cette config pour décider du
//! mode (spawn sidecar ou skip + injecter URL distante dans le webview).

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::backend_config::{BackendConfig, BackendMode};

#[derive(Debug, Serialize, Deserialize)]
pub struct BackendConfigDto {
    pub mode: String,
    pub url: Option<String>,
}

impl From<BackendConfig> for BackendConfigDto {
    fn from(c: BackendConfig) -> Self {
        BackendConfigDto {
            mode: match c.mode {
                BackendMode::Local => "local".into(),
                BackendMode::Remote => "remote".into(),
            },
            url: c.url,
        }
    }
}

/// Lit la config backend depuis le disque.
#[tauri::command]
pub fn get_backend_mode(app: AppHandle) -> Result<BackendConfigDto, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
    let cfg = BackendConfig::load(&dir);
    Ok(cfg.into())
}

/// Persiste la config backend. Le changement prend effet au prochain restart.
#[tauri::command]
pub fn set_backend_mode(
    app: AppHandle,
    mode: String,
    url: Option<String>,
) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
    let mode = match mode.as_str() {
        "local" => BackendMode::Local,
        "remote" => BackendMode::Remote,
        other => return Err(format!("mode invalide: {other}")),
    };
    if matches!(mode, BackendMode::Remote) {
        let url = url.as_deref().unwrap_or("");
        if url.is_empty() {
            return Err("url requise en mode remote".into());
        }
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err("url doit commencer par http:// ou https://".into());
        }
    }
    let cfg = BackendConfig { mode, url };
    cfg.save(&dir).map_err(|e| format!("save backend.json: {e}"))?;
    Ok(())
}
