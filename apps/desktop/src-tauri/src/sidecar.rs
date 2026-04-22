//! Spawn + port discovery + healthcheck + shutdown du sidecar `fakt-api`.
//!
//! Le sidecar est le backend HTTP Bun+Hono qui expose les queries Drizzle
//! en REST (mode 1 solo, bind 127.0.0.1 + token aléatoire). Tauri le lance
//! au boot, lit `FAKT_API_READY:port=<N>` sur stdout pour découvrir le port
//! choisi par le kernel (PORT=0), stocke le contexte dans l'état Tauri,
//! puis injecte `window.__FAKT_API_URL__` / `__FAKT_API_TOKEN__` / `__FAKT_MODE__`
//! dans le webview via `initialization_script`.
//!
//! Archi : `docs/refacto-spec/architecture.md` §5.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use parking_lot::Mutex;
use rand::RngCore;
use tauri::async_runtime::Receiver;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tokio::time::timeout;

/// Préfixe que l'api-server écrit sur stdout à la fin de son boot.
pub const READY_PREFIX: &str = "FAKT_API_READY:port=";

/// Timeout pour la découverte du port via stdout.
pub const SPAWN_READY_TIMEOUT: Duration = Duration::from_secs(5);

/// Timeout total des retries healthcheck.
pub const HEALTH_TIMEOUT: Duration = Duration::from_secs(5);

/// Nombre maximum de retries healthcheck (5×500ms).
pub const HEALTH_RETRIES: u32 = 5;
pub const HEALTH_RETRY_DELAY: Duration = Duration::from_millis(500);

/// Grace period avant SIGKILL au shutdown.
pub const SHUTDOWN_GRACE: Duration = Duration::from_secs(3);

/// Fenêtre pour la détection de crash-loop.
pub const CRASH_LOOP_WINDOW: Duration = Duration::from_secs(60);

#[derive(Debug, thiserror::Error)]
pub enum SidecarError {
    #[error("spawn: {0}")]
    Spawn(String),
    #[error("port discovery timeout ({0:?})")]
    DiscoveryTimeout(Duration),
    #[error("port discovery: stdout a été fermé avant ligne ready")]
    DiscoveryClosed,
    #[error("port discovery: ligne ready invalide: {0}")]
    DiscoveryParse(String),
    #[error("healthcheck KO après {0} retries")]
    Healthcheck(u32),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

pub type SidecarResult<T> = Result<T, SidecarError>;

/// Contexte api-server stocké via `app.manage()` — consultable par d'autres
/// commandes Tauri si besoin (diag, etc.).
#[derive(Debug)]
pub struct ApiContext {
    pub port: u16,
    pub token: String,
    /// Handle sur le child process sidecar. `Option` pour permettre le `take()`
    /// au moment du shutdown.
    pub child: Mutex<Option<CommandChild>>,
    /// Timestamps des crashes détectés, pour la crash-loop detection.
    pub crash_timestamps: Mutex<Vec<Instant>>,
}

impl ApiContext {
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}

/// Génère un token aléatoire 32 bytes encodé en base64url.
pub fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Parse une ligne stdout du sidecar et extrait le port si elle matche
/// `FAKT_API_READY:port=<N>`. Retourne `Ok(Some(port))` si c'est la ligne
/// ready, `Ok(None)` si c'est une ligne non-pertinente (log pino etc.),
/// `Err` si la ligne ressemble à ready mais est malformée.
pub fn parse_ready_line(line: &str) -> Result<Option<u16>, SidecarError> {
    let trimmed = line.trim();
    let Some(rest) = trimmed.strip_prefix(READY_PREFIX) else {
        return Ok(None);
    };
    rest.parse::<u16>()
        .map(Some)
        .map_err(|e| SidecarError::DiscoveryParse(format!("{trimmed:?}: {e}")))
}

/// Résout le chemin de la DB SQLite utilisateur (`~/.fakt/db.sqlite`).
fn default_db_path(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .home_dir()
        .ok()
        .map(|p| p.join(".fakt"))
        .unwrap_or_else(|| PathBuf::from(".fakt"));
    if let Err(e) = std::fs::create_dir_all(&base) {
        tracing::warn!(error = %e, "création ~/.fakt échouée, fallback cwd");
    }
    base.join("db.sqlite")
}

/// Spawn le sidecar `fakt-api`, attend le ready line, retourne le
/// ApiContext prêt à être `app.manage()`. En cas de `FAKT_API_EXTERNAL=1`
/// (dev mode), skip le spawn et retourne un contexte pointant sur un
/// port fixé par env `FAKT_API_PORT` (défaut 3001) et un token env `FAKT_API_TOKEN`.
pub async fn spawn_api_server(app: &AppHandle) -> SidecarResult<Arc<ApiContext>> {
    if std::env::var("FAKT_API_EXTERNAL").as_deref() == Ok("1") {
        let port: u16 = std::env::var("FAKT_API_PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(3001);
        let token = std::env::var("FAKT_API_TOKEN").unwrap_or_else(|_| generate_token());
        tracing::info!(port, "sidecar externe (dev) — skip spawn");
        return Ok(Arc::new(ApiContext {
            port,
            token,
            child: Mutex::new(None),
            crash_timestamps: Mutex::new(Vec::new()),
        }));
    }
    spawn_api_server_inner(app).await
}

async fn spawn_api_server_inner(app: &AppHandle) -> SidecarResult<Arc<ApiContext>> {
    let token = generate_token();
    let db_path = default_db_path(app);

    let cmd = app
        .shell()
        .sidecar("fakt-api")
        .map_err(|e| SidecarError::Spawn(format!("sidecar(): {e}")))?
        .env("FAKT_API_TOKEN", &token)
        .env("FAKT_API_PORT", "0")
        .env("FAKT_DB_PATH", db_path.to_string_lossy().to_string())
        .env("FAKT_MODE", "1");

    let (mut rx, child) = cmd
        .spawn()
        .map_err(|e| SidecarError::Spawn(format!("spawn: {e}")))?;

    tracing::info!("sidecar fakt-api spawned, attente port discovery");

    let port = timeout(SPAWN_READY_TIMEOUT, consume_until_ready(&mut rx))
        .await
        .map_err(|_| SidecarError::DiscoveryTimeout(SPAWN_READY_TIMEOUT))??;

    tracing::info!(port, "sidecar ready");

    // Drain en arrière-plan le reste du flux (stdout/stderr) pour éviter que
    // le child se bloque sur un buffer plein.
    tokio::spawn(async move {
        while let Some(ev) = rx.recv().await {
            match ev {
                CommandEvent::Stdout(line) => {
                    tracing::debug!(line = %String::from_utf8_lossy(&line), "sidecar stdout");
                }
                CommandEvent::Stderr(line) => {
                    tracing::warn!(line = %String::from_utf8_lossy(&line), "sidecar stderr");
                }
                CommandEvent::Error(err) => {
                    tracing::error!(err = %err, "sidecar error event");
                }
                CommandEvent::Terminated(payload) => {
                    tracing::warn!(code = ?payload.code, "sidecar terminated");
                    break;
                }
                _ => {}
            }
        }
    });

    let ctx = Arc::new(ApiContext {
        port,
        token,
        child: Mutex::new(Some(child)),
        crash_timestamps: Mutex::new(Vec::new()),
    });

    healthcheck_retry(&ctx).await?;

    Ok(ctx)
}

/// Boucle sur les events du child jusqu'à trouver la ligne ready ou la fin
/// du stream.
async fn consume_until_ready(
    rx: &mut Receiver<CommandEvent>,
) -> Result<u16, SidecarError> {
    while let Some(ev) = rx.recv().await {
        match ev {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line);
                for candidate in text.split('\n') {
                    if let Some(port) = parse_ready_line(candidate)? {
                        return Ok(port);
                    }
                }
            }
            CommandEvent::Stderr(line) => {
                tracing::warn!(
                    line = %String::from_utf8_lossy(&line),
                    "sidecar stderr (boot)"
                );
            }
            CommandEvent::Terminated(payload) => {
                return Err(SidecarError::Spawn(format!(
                    "sidecar terminé avant ready, code={:?}",
                    payload.code
                )));
            }
            _ => {}
        }
    }
    Err(SidecarError::DiscoveryClosed)
}

/// Ping `/health` avec le header `X-FAKT-Token` jusqu'à 200 ou épuisement
/// des retries. Utilise `reqwest::blocking` dans un `spawn_blocking` pour
/// éviter d'embarquer un runtime HTTP async complet (le crate est déjà
/// utilisé en blocking pour TSA RFC 3161).
async fn healthcheck_retry(ctx: &ApiContext) -> Result<(), SidecarError> {
    let deadline = Instant::now() + HEALTH_TIMEOUT;
    let url = format!("{}/health", ctx.url());
    let token = ctx.token.clone();
    for attempt in 0..HEALTH_RETRIES {
        if Instant::now() >= deadline {
            break;
        }
        let url_clone = url.clone();
        let token_clone = token.clone();
        let res = tokio::task::spawn_blocking(move || {
            reqwest::blocking::Client::builder()
                .timeout(Duration::from_millis(800))
                .build()
                .and_then(|c| c.get(&url_clone).header("X-FAKT-Token", &token_clone).send())
        })
        .await;
        match res {
            Ok(Ok(r)) if r.status().is_success() => {
                tracing::info!(attempt, "healthcheck OK");
                return Ok(());
            }
            Ok(Ok(r)) => {
                tracing::warn!(status = r.status().as_u16(), attempt, "healthcheck non-200");
            }
            Ok(Err(e)) => {
                tracing::debug!(error = %e, attempt, "healthcheck retry");
            }
            Err(e) => {
                tracing::warn!(error = %e, attempt, "healthcheck join error");
            }
        }
        tokio::time::sleep(HEALTH_RETRY_DELAY).await;
    }
    Err(SidecarError::Healthcheck(HEALTH_RETRIES))
}

/// Enregistre un crash timestamp et retourne `true` si on a dépassé le seuil
/// (2 crashes en 60s → fatal).
pub fn record_crash_and_check_loop(ctx: &ApiContext) -> bool {
    let now = Instant::now();
    let mut guard = ctx.crash_timestamps.lock();
    guard.retain(|t| now.duration_since(*t) < CRASH_LOOP_WINDOW);
    guard.push(now);
    guard.len() >= 2
}

/// Shutdown propre : termine le child (SIGTERM sous Unix, TerminateProcess
/// sous Windows). `kill` de tauri_plugin_shell gère la grace period en
/// pratique — on l'appelle directement et on log si le process ne répond
/// pas immédiatement. Appelé depuis `on_window_event(CloseRequested)`.
pub fn shutdown(ctx: &ApiContext) {
    let Some(child) = ctx.child.lock().take() else {
        tracing::debug!("sidecar: pas de child à tuer (mode dev ou déjà mort)");
        return;
    };
    let start = Instant::now();
    if let Err(e) = child.kill() {
        tracing::warn!(error = %e, "sidecar.kill() a échoué");
    } else {
        tracing::info!(elapsed = ?start.elapsed(), "sidecar killed");
    }
    // La grace period SHUTDOWN_GRACE est gérée implicitement par le plugin —
    // on ne peut pas waitpid ici sans re-architecturer le child en Arc partagé.
    // Une future itération pourra ajouter un `wait_with_timeout`.
    let _ = SHUTDOWN_GRACE;
}

/// Inject script à pousser via `WebviewWindowBuilder::initialization_script`.
pub fn initialization_script(port: u16, token: &str) -> String {
    // Échappement JSON du token et sérialisation numérique du port pour
    // éviter toute tentative d'injection via un token piégé (même si
    // généré localement, mieux vaut cadenasser).
    let token_json = serde_json::to_string(token).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        "window.__FAKT_API_URL__ = \"http://127.0.0.1:{port}\";\n\
         window.__FAKT_API_TOKEN__ = {token_json};\n\
         window.__FAKT_MODE__ = 1;\n"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ready_ok() {
        assert_eq!(parse_ready_line("FAKT_API_READY:port=12345").unwrap(), Some(12345));
    }

    #[test]
    fn parse_ready_with_trailing_newline() {
        assert_eq!(parse_ready_line("FAKT_API_READY:port=7\n").unwrap(), Some(7));
    }

    #[test]
    fn parse_ready_with_leading_whitespace() {
        assert_eq!(parse_ready_line("  FAKT_API_READY:port=443  ").unwrap(), Some(443));
    }

    #[test]
    fn parse_non_ready_line_returns_none() {
        assert!(parse_ready_line("{\"level\":30,\"msg\":\"booting\"}").unwrap().is_none());
        assert!(parse_ready_line("").unwrap().is_none());
    }

    #[test]
    fn parse_ready_invalid_port_errors() {
        assert!(parse_ready_line("FAKT_API_READY:port=not_a_number").is_err());
        assert!(parse_ready_line("FAKT_API_READY:port=99999999").is_err());
    }

    #[test]
    fn generate_token_is_43_chars_base64url() {
        let t = generate_token();
        assert_eq!(t.len(), 43);
        assert!(!t.contains('='));
        assert!(!t.contains('+'));
        assert!(!t.contains('/'));
    }

    #[test]
    fn generate_token_is_unique_per_call() {
        let a = generate_token();
        let b = generate_token();
        assert_ne!(a, b);
    }

    #[test]
    fn initialization_script_contains_url_token_mode() {
        let js = initialization_script(51234, "abc.def_GHI-jkl");
        assert!(js.contains("window.__FAKT_API_URL__ = \"http://127.0.0.1:51234\""));
        assert!(js.contains("window.__FAKT_API_TOKEN__ = \"abc.def_GHI-jkl\""));
        assert!(js.contains("window.__FAKT_MODE__ = 1"));
    }

    #[test]
    fn initialization_script_escapes_token_quotes() {
        // Si un token exotique contenait un ", il doit rester échappé.
        let js = initialization_script(1, "bad\"token");
        assert!(js.contains("\"bad\\\"token\""));
    }
}
