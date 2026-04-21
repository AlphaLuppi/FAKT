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
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    time::timeout,
};

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
/// Claude CLI 2.x emits newline-delimited JSON objects.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum CliLine {
    /// Partial text chunk.
    Text { text: String },
    /// The assistant message is complete; `content` holds the final text.
    Result {
        result: Option<String>,
        #[serde(default)]
        is_error: bool,
        error_code: Option<String>,
    },
    /// System-level status line (startup, tool calls, …) — silently ignored.
    #[serde(other)]
    Other,
}

// ─── CLI invocation ───────────────────────────────────────────────────────────

/// Resolves the `claude` binary path.
/// Checks FAKT_CLAUDE_PATH env override first (useful in tests / CI mock).
fn claude_binary() -> String {
    std::env::var("FAKT_CLAUDE_PATH").unwrap_or_else(|_| "claude".to_string())
}

/// Spawns the Claude CLI subprocess and returns its handle.
///
/// Security note: we use `Command::new` (not a shell invocation) and pass
/// the prompt via stdin, not as a command-line argument — preventing any
/// shell injection risk.
async fn spawn_subprocess(
    prompt_text: &str,
) -> Result<tokio::process::Child, String> {
    let binary = claude_binary();

    let mut child = Command::new(&binary)
        // Non-interactive print mode: outputs result and exits.
        .arg("--print")
        // Stream JSON lines instead of plain text.
        .arg("--output-format")
        .arg("stream-json")
        // Include partial message chunks as they arrive.
        .arg("--include-partial-messages")
        // Disable CLAUDE.md discovery and hooks — deterministic in prod.
        .arg("--bare")
        // Read prompt from stdin (safer than --arg injection).
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| {
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

    let result = timeout(STREAM_TIMEOUT, stream_inner(&prompt_text, &channel)).await;

    match result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => {
            let _ = channel.send(AiStreamEvent::Error { message: e.clone() });
            Err(e)
        }
        Err(_elapsed) => {
            let msg = "Délai dépassé (60s) — la réponse Claude CLI n'est pas arrivée à temps.".to_string();
            let _ = channel.send(AiStreamEvent::Error { message: msg.clone() });
            Err(msg)
        }
    }
}

async fn stream_inner(
    prompt_text: &str,
    channel: &Channel<AiStreamEvent>,
) -> Result<(), String> {
    let mut child = spawn_subprocess(prompt_text).await?;

    let stdout = child
        .stdout
        .take()
        .ok_or("Impossible de lire stdout du processus Claude")?;

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut final_result: Option<serde_json::Value> = None;

    loop {
        match lines.next_line().await {
            Ok(Some(line)) if !line.trim().is_empty() => {
                match serde_json::from_str::<CliLine>(&line) {
                    Ok(CliLine::Text { text }) => {
                        let _ = channel.send(AiStreamEvent::Token { text });
                    }
                    Ok(CliLine::Result {
                        result: Some(content),
                        is_error: false,
                        ..
                    }) => {
                        // Try to parse as JSON object; fall back to string.
                        let value = serde_json::from_str::<serde_json::Value>(&content)
                            .unwrap_or_else(|_| serde_json::Value::String(content));
                        final_result = Some(value);
                    }
                    Ok(CliLine::Result {
                        is_error: true,
                        error_code,
                        ..
                    }) => {
                        let msg = error_code
                            .unwrap_or_else(|| "Erreur inconnue CLI".to_string());
                        let _ = channel.send(AiStreamEvent::Error { message: msg.clone() });
                        return Err(msg);
                    }
                    Ok(CliLine::Other) | Err(_) => {
                        // Unknown line format — skip silently.
                    }
                }
            }
            Ok(Some(_)) => {} // Empty line — skip.
            Ok(None) => break, // EOF
            Err(e) => {
                return Err(format!("Erreur lecture stdout : {e}"));
            }
        }
    }

    // Wait for the process to exit cleanly.
    let _ = child.wait().await;

    // Emit done event with the final JSON result.
    let result = final_result.unwrap_or(serde_json::Value::Null);
    let _ = channel.send(AiStreamEvent::Done { result });

    Ok(())
}

/// Health check command: detects Claude CLI on the current OS.
/// FR-003: used by onboarding wizard and settings.
/// Never panics — returns structured result.
#[tauri::command]
pub async fn check_claude_cli() -> Result<CliCheckResult, String> {
    let binary = claude_binary();

    // Try `claude --version` first.
    let version_output = Command::new(&binary)
        .arg("--version")
        .output()
        .await;

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

    #[test]
    fn claude_binary_uses_env_override() {
        // FAKT_CLAUDE_PATH allows CI to inject a mock binary.
        std::env::set_var("FAKT_CLAUDE_PATH", "/mock/claude-stub");
        assert_eq!(claude_binary(), "/mock/claude-stub");
        std::env::remove_var("FAKT_CLAUDE_PATH");
    }

    #[test]
    fn claude_binary_defaults_to_claude() {
        std::env::remove_var("FAKT_CLAUDE_PATH");
        assert_eq!(claude_binary(), "claude");
    }

    #[tokio::test]
    async fn check_claude_cli_returns_err_when_not_found() {
        // Point to a non-existent binary.
        std::env::set_var("FAKT_CLAUDE_PATH", "/nonexistent/claude-xyz-abc");
        let result = check_claude_cli().await;
        assert!(result.is_err());
        std::env::remove_var("FAKT_CLAUDE_PATH");
    }
}
