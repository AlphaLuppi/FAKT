//! Subprocess wrapper for Claude Code CLI.
//!
//! Architecture rule (§8): subprocess only in v0.1.
//! The Anthropic token is NEVER accessed by FAKT — it is managed by the
//! `claude` binary itself (keychain / ANTHROPIC_API_KEY env set by the user).
//! CLI args are NEVER logged in plain text.
//!
//! Streaming flow:
//!   1. `spawn_claude` Tauri command receives the rendered prompt text + a Channel.
//!   2. We spawn `claude -p --output-format stream-json` via tokio::process::Command.
//!   3. Stdout is piped line-by-line; each JSON line is parsed into AiStreamEvent.
//!   4. Events are sent through the Channel to the frontend.
//!   5. A 60-second timeout is enforced per stream session.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, BufReader},
    process::Command,
    time::timeout,
};

use super::sessions::{self, SessionStatus};

// ─── Stream event types (mirrored in packages/ai/src/providers/claude-cli.ts) ──

/// Events emitted through the Tauri Channel<AiStreamEvent>.
/// `#[serde(tag = "type", rename_all = "snake_case")]` ensures the JSON
/// format matches what the TypeScript side expects.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiStreamEvent {
    /// A partial text token streamed by the model.
    Token { text: String },
    /// Final complete result (JSON value, validated downstream in TS via Zod).
    Done { result: serde_json::Value },
    /// Unrecoverable error; stream terminates.
    Error { message: String },
}

// ─── Claude CLI output format (stream-json) ──────────────────────────────────

/// Subset of the `--output-format stream-json` lines we care about.
/// Claude CLI 2.x émet des objets JSON newline-delimited. Les types vus en
/// pratique (2025) :
///   - `system` : init, hooks, status — ignorés
///   - `stream_event` : delta par chunk (message_start, content_block_delta,
///     content_block_stop, message_delta, message_stop)
///   - `assistant` : message complet (redondant avec les deltas, ignoré)
///   - `rate_limit_event` : info quota — ignoré
///   - `result` : sortie finale avec champ `result` = texte complet
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum CliLine {
    /// Format legacy conservé pour compat (avant CLI 2.x).
    Text { text: String },
    /// Événement de streaming — on n'utilise que les `content_block_delta`
    /// avec un `text_delta` pour émettre des tokens partiels à l'UI.
    StreamEvent { event: StreamEventInner },
    /// La sortie finale du CLI — `result` est le texte complet (ou JSON
    /// stringifié pour nos prompts extract_quote).
    Result {
        result: Option<String>,
        #[serde(default)]
        is_error: bool,
        error_code: Option<String>,
    },
    /// Tout le reste (system, assistant, rate_limit_event, …) — ignoré.
    #[serde(other)]
    Other,
}

/// Inner structure d'un `stream_event` — seul `content_block_delta` nous
/// intéresse (pour afficher les tokens au fil de l'eau).
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum StreamEventInner {
    ContentBlockDelta { delta: ContentDelta },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ContentDelta {
    /// `{"type":"text_delta","text":"..."}` — chunk texte incrémental.
    TextDelta { text: String },
    #[serde(other)]
    Other,
}

// ─── CLI invocation ───────────────────────────────────────────────────────────

/// Resolves the `claude` binary path.
/// Checks FAKT_CLAUDE_PATH env override first (useful in tests / CI mock).
fn claude_binary() -> String {
    std::env::var("FAKT_CLAUDE_PATH").unwrap_or_else(|_| "claude".to_string())
}

/// Arguments passés à `claude`. Claude CLI 2.x refuse `--print --output-format stream-json`
/// sans `--verbose` (il répond : "requires --verbose"). Bug historique FAKT :
/// le flag manquait → subprocess exit tout de suite sur stderr avalé → UI
/// recevait un `done` avec `result: null` et affichait "rien".
fn claude_cli_args() -> Vec<&'static str> {
    vec![
        "--print",
        "--output-format",
        "stream-json",
        "--verbose", // MANDATORY with stream-json + --print.
        "--include-partial-messages",
    ]
}

/// Crée la Command avec les bons args. Sur Windows, `claude` installé via
/// `npm -g` est un script `.cmd` que `tokio::process::Command::new("claude")`
/// ne résout pas. On retombe sur `cmd /C` pour que le shell applique PATHEXT.
#[cfg(target_os = "windows")]
fn build_command(binary: &str) -> Command {
    // Tente `.exe` direct si présent dans PATH, sinon passer par `cmd /C`.
    // On détecte via variable d'env FAKT_CLAUDE_PATH ou fallback cmd systématique
    // (toujours safe car pas de substitution shell sur les args après `/C <bin>`).
    let mut cmd = Command::new("cmd");
    cmd.arg("/C").arg(binary);
    for arg in claude_cli_args() {
        cmd.arg(arg);
    }
    cmd
}

#[cfg(not(target_os = "windows"))]
fn build_command(binary: &str) -> Command {
    let mut cmd = Command::new(binary);
    for arg in claude_cli_args() {
        cmd.arg(arg);
    }
    cmd
}

/// Spawns the Claude CLI subprocess and returns its handle + stderr reader.
///
/// Security note: we use `Command::new` (not a shell invocation for args) and
/// pass the prompt via stdin, not as a command-line argument — preventing any
/// shell injection risk. The prompt NEVER appears in argv.
async fn spawn_subprocess(
    prompt_text: &str,
) -> Result<tokio::process::Child, String> {
    let binary = claude_binary();

    let mut cmd = build_command(&binary);
    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        // Ancien bug : stderr était Stdio::null() — toutes les erreurs du CLI
        // (ex: "requires --verbose", "ANTHROPIC_API_KEY missing", rate-limit)
        // étaient avalées. Maintenant on pipe pour pouvoir les remonter à l'UI
        // et à la page /settings/ai-sessions.
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            format!(
                "Claude CLI non trouvé (chemin: {binary}). \
                 Installez Claude Code : https://claude.ai/code"
            )
        } else {
            format!("Erreur démarrage Claude CLI : {e}")
        }
    })?;

    // Write prompt to stdin and close it so the CLI sees EOF.
    if let Some(mut stdin) = child.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin
            .write_all(prompt_text.as_bytes())
            .await
            .map_err(|e| format!("Erreur écriture stdin : {e}"))?;
        // stdin drops here, sending EOF to the process.
    }

    Ok(child)
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// Streams an AI response from the Claude CLI.
///
/// Called from TypeScript as `invoke("spawn_claude", { promptText, channel })`.
/// The channel receives AiStreamEvent values until `done` or `error`.
///
/// # Timeout
/// The entire stream is bounded to 60 seconds. If the CLI does not finish
/// within that window, an `error` event is sent and the process is killed.
#[tauri::command]
pub async fn spawn_claude(
    prompt_text: String,
    channel: Channel<AiStreamEvent>,
) -> Result<(), String> {
    const STREAM_TIMEOUT: Duration = Duration::from_secs(60);

    let session_id = sessions::start_session(&prompt_text);

    let result = timeout(
        STREAM_TIMEOUT,
        stream_inner(&prompt_text, &channel, &session_id),
    )
    .await;

    match result {
        Ok(Ok(())) => {
            // stream_inner a déjà appelé end_session avec Done.
            Ok(())
        }
        Ok(Err((msg, stderr))) => {
            let _ = channel.send(AiStreamEvent::Error { message: msg.clone() });
            sessions::end_session(&session_id, SessionStatus::Error, Some(msg.clone()), stderr);
            Err(msg)
        }
        Err(_elapsed) => {
            let msg = "Délai dépassé (60s) — la réponse Claude CLI n'est pas arrivée à temps."
                .to_string();
            let _ = channel.send(AiStreamEvent::Error { message: msg.clone() });
            sessions::end_session(&session_id, SessionStatus::Timeout, Some(msg.clone()), None);
            Err(msg)
        }
    }
}

/// Erreur de stream_inner : message utilisateur + stderr brut optionnel.
/// Le stderr n'est PAS affiché à l'utilisateur (souvent technique) mais
/// archivé dans la page /settings/ai-sessions pour debug.
type StreamErr = (String, Option<String>);

async fn stream_inner(
    prompt_text: &str,
    channel: &Channel<AiStreamEvent>,
    session_id: &str,
) -> Result<(), StreamErr> {
    let mut child = spawn_subprocess(prompt_text)
        .await
        .map_err(|e| (e, None))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| ("Impossible de lire stdout du processus Claude".to_string(), None))?;
    let stderr_pipe = child.stderr.take();

    // Lecture stderr en parallèle dans une tâche dédiée — on collecte tout
    // pour pouvoir remonter l'erreur exacte si le CLI exit non-zéro.
    let stderr_task = tokio::spawn(async move {
        let Some(mut stderr) = stderr_pipe else {
            return String::new();
        };
        let mut buf = Vec::with_capacity(1024);
        let _ = stderr.read_to_end(&mut buf).await;
        String::from_utf8_lossy(&buf).into_owned()
    });

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut final_result: Option<serde_json::Value> = None;
    let mut streaming_started = false;

    loop {
        match lines.next_line().await {
            Ok(Some(line)) if !line.trim().is_empty() => {
                sessions::bump_cli_line(session_id);
                if !streaming_started {
                    sessions::mark_streaming(session_id);
                    streaming_started = true;
                }
                match serde_json::from_str::<CliLine>(&line) {
                    Ok(CliLine::Text { text }) => {
                        sessions::bump_token(session_id);
                        let _ = channel.send(AiStreamEvent::Token { text });
                    }
                    Ok(CliLine::StreamEvent {
                        event: StreamEventInner::ContentBlockDelta {
                            delta: ContentDelta::TextDelta { text },
                        },
                    }) => {
                        sessions::bump_token(session_id);
                        let _ = channel.send(AiStreamEvent::Token { text });
                    }
                    Ok(CliLine::StreamEvent { .. }) => {
                        // Autres stream_event (message_start, content_block_stop,
                        // message_delta, message_stop) — ignorés, le texte
                        // complet arrive via `type:"result"` à la fin.
                    }
                    Ok(CliLine::Result {
                        result: Some(content),
                        is_error: false,
                        ..
                    }) => {
                        let value = serde_json::from_str::<serde_json::Value>(&content)
                            .unwrap_or_else(|_| serde_json::Value::String(content));
                        final_result = Some(value);
                    }
                    Ok(CliLine::Result {
                        is_error: true,
                        error_code,
                        ..
                    }) => {
                        let msg = error_code.unwrap_or_else(|| "Erreur inconnue CLI".to_string());
                        let stderr = stderr_task.await.ok();
                        return Err((msg, stderr));
                    }
                    Ok(CliLine::Result { .. }) | Ok(CliLine::Other) | Err(_) => {
                        // Unknown / incomplete line — skip silently.
                    }
                }
            }
            Ok(Some(_)) => {}
            Ok(None) => break, // EOF stdout
            Err(e) => {
                let stderr = stderr_task.await.ok();
                return Err((format!("Erreur lecture stdout : {e}"), stderr));
            }
        }
    }

    // Attendre que le process exit pour connaître le code de sortie.
    let exit_status = match child.wait().await {
        Ok(s) => s,
        Err(e) => {
            let stderr = stderr_task.await.ok();
            return Err((format!("Erreur attente processus : {e}"), stderr));
        }
    };

    let stderr_content = stderr_task.await.unwrap_or_default();
    let stderr_opt = if stderr_content.trim().is_empty() {
        None
    } else {
        Some(stderr_content.clone())
    };

    if !exit_status.success() {
        // Bug historique : on arrivait ici avec stdout vide + stderr vide (null)
        // → on envoyait un `done { result: null }` silencieux. Maintenant on
        // remonte l'erreur exacte du CLI avec le stderr comme diagnostic.
        let code = exit_status
            .code()
            .map(|c| c.to_string())
            .unwrap_or_else(|| "?".to_string());
        let msg = if stderr_content.trim().is_empty() {
            format!("Claude CLI a terminé avec un code d'erreur {code} (aucun message stderr)")
        } else {
            // Prend la première ligne non vide de stderr comme message utilisateur.
            let first = stderr_content
                .lines()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("");
            format!("Claude CLI : {}", first.trim())
        };
        return Err((msg, stderr_opt));
    }

    // Success path — émettre done event.
    let result = final_result.unwrap_or(serde_json::Value::Null);
    let _ = channel.send(AiStreamEvent::Done {
        result: result.clone(),
    });
    sessions::end_session(session_id, SessionStatus::Done, None, stderr_opt);

    Ok(())
}

/// Health check command: detects Claude CLI on the current OS.
/// FR-003: used by onboarding wizard and settings.
/// Never panics — returns structured result.
///
/// Sur Windows, les binaires globaux npm sont distribués en tant que scripts
/// `.cmd` (ex: `claude.cmd`). `tokio::process::Command` ne les trouve pas
/// directement — on retombe sur `cmd /C claude --version` pour que le shell
/// résolve PATHEXT.
#[tauri::command]
pub async fn check_claude_cli() -> Result<CliCheckResult, String> {
    let binary = claude_binary();

    // Tentative directe (exe réel).
    let direct = Command::new(&binary).arg("--version").output().await;

    let version_output = match direct {
        Ok(out) => Ok(out),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            #[cfg(target_os = "windows")]
            {
                Command::new("cmd")
                    .args(["/C", &binary, "--version"])
                    .output()
                    .await
            }
            #[cfg(not(target_os = "windows"))]
            {
                Err(e)
            }
        }
        Err(e) => Err(e),
    };

    match version_output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();

            // Resolve full path via `which`/`where`.
            let path = resolve_binary_path(&binary).await;

            Ok(CliCheckResult {
                stdout,
                path: path.unwrap_or_else(|| binary.clone()),
            })
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Err(format!("Claude CLI retourne une erreur : {stderr}"))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Err(format!("Claude CLI introuvable (chemin: {binary})"))
        }
        Err(e) => Err(format!("Erreur détection Claude CLI : {e}")),
    }
}

/// Returned by `check_claude_cli`.
/// Mirrors the TypeScript `{ stdout: string; path: string }` shape.
#[derive(Debug, Serialize)]
pub struct CliCheckResult {
    pub stdout: String,
    pub path: String,
}

/// Cross-OS binary path resolution.
async fn resolve_binary_path(binary: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    let which_cmd = ("where", binary);
    #[cfg(not(target_os = "windows"))]
    let which_cmd = ("which", binary);

    let out = Command::new(which_cmd.0)
        .arg(which_cmd.1)
        .output()
        .await
        .ok()?;

    if out.status.success() {
        let path = String::from_utf8_lossy(&out.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if path.is_empty() { None } else { Some(path) }
    } else {
        None
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Les tests qui touchent à `FAKT_CLAUDE_PATH` partagent l'environnement
    // process — en parallèle ils se marchent dessus. Ce mutex sérialise
    // l'accès et évite les faux positifs type "left: claude / right: /mock".
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn claude_binary_uses_env_override() {
        let _guard = ENV_LOCK.lock().unwrap();
        // FAKT_CLAUDE_PATH allows CI to inject a mock binary.
        std::env::set_var("FAKT_CLAUDE_PATH", "/mock/claude-stub");
        assert_eq!(claude_binary(), "/mock/claude-stub");
        std::env::remove_var("FAKT_CLAUDE_PATH");
    }

    #[test]
    fn claude_binary_defaults_to_claude() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var("FAKT_CLAUDE_PATH");
        assert_eq!(claude_binary(), "claude");
    }

    #[tokio::test]
    async fn check_claude_cli_returns_err_when_not_found() {
        let _guard = ENV_LOCK.lock().unwrap();
        // Point to a non-existent binary.
        std::env::set_var("FAKT_CLAUDE_PATH", "/nonexistent/claude-xyz-abc");
        let result = check_claude_cli().await;
        assert!(result.is_err());
        std::env::remove_var("FAKT_CLAUDE_PATH");
    }
}
