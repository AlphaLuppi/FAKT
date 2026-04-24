//! In-memory tracker des runs IA (MVP — pas encore en DB).
//!
//! Permet à la page /settings/ai-sessions d'afficher :
//!   - runs actifs (status: pending | streaming)
//!   - historique récent (max 50) avec status final (done | error | timeout)
//!   - stderr complet du subprocess Claude CLI (précieux pour debug)
//!
//! Thread-safe via parking_lot::RwLock. Singleton global via OnceLock.
//! Nettoyage : ring-buffer de 50 entrées pour ne pas fuiter en mémoire.

use std::sync::OnceLock;

use parking_lot::RwLock;
use serde::Serialize;

/// Nombre max de sessions terminées gardées en mémoire.
/// Les sessions actives (pending/streaming) ne sont jamais élaguées.
const MAX_HISTORY: usize = 50;

/// Aperçu du prompt pour UI (jamais exposer le full prompt en logs).
const PROMPT_PREVIEW_LEN: usize = 200;

/// Taille max de la réponse accumulée gardée en mémoire (bytes).
const RESPONSE_MAX_BYTES: usize = 32 * 1024;

/// Nombre max de lignes JSON brutes du CLI conservées (ring-buffer par session).
const RAW_EVENTS_MAX: usize = 50;

/// État d'une session IA tracé en mémoire.
/// Sérialisé tel quel pour le frontend — tous les champs sont côté UI.
#[derive(Debug, Clone, Serialize)]
pub struct AiSession {
    pub id: String,
    /// `extract_quote` | `chat` | `draft_email` | `unknown` — heuristique sur prompt.
    pub kind: String,
    pub status: SessionStatus,
    /// Aperçu du prompt (200 premiers chars). Jamais le full prompt.
    pub prompt_preview: String,
    pub prompt_chars: usize,
    /// Timestamps en ms depuis epoch UTC.
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_ms: Option<i64>,
    /// Nombre d'événements token émis (progression).
    pub token_events: u32,
    /// Nombre total de lignes JSON reçues du CLI.
    pub cli_lines: u32,
    /// Message d'erreur (si status = Error ou Timeout).
    pub error: Option<String>,
    /// Stderr complet du subprocess (tronqué à 4 KB pour éviter gonflement mémoire).
    pub stderr: Option<String>,
    /// Réponse accumulée token par token (ce que l'IA a dit) — tronquée.
    /// Mise à jour à chaque token, permet de voir la sortie en live dans l'UI.
    #[serde(default)]
    pub response_text: String,
    /// Résultat final parsé (JSON ou texte) une fois la session terminée.
    #[serde(default)]
    pub final_result: Option<serde_json::Value>,
    /// Tool calls déclenchés par l'IA via MCP (name + args serializés en JSON).
    #[serde(default)]
    pub tool_calls: Vec<ToolCallRecord>,
    /// Ring-buffer des dernières lignes JSON brutes reçues du CLI — pour debug.
    /// Capture ce que `bump_cli_line` voit passer avant le parsing.
    #[serde(default)]
    pub raw_events: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolCallRecord {
    pub name: String,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub is_error: bool,
    pub started_at: i64,
    pub ended_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Pending,
    Streaming,
    Done,
    Error,
    Timeout,
    Cancelled,
}

/// Container partagé. `active` = runs en cours, `history` = ring-buffer terminés.
#[derive(Default)]
pub struct SessionStore {
    active: Vec<AiSession>,
    history: Vec<AiSession>,
}

static TRACKER: OnceLock<RwLock<SessionStore>> = OnceLock::new();

fn store() -> &'static RwLock<SessionStore> {
    TRACKER.get_or_init(|| RwLock::new(SessionStore::default()))
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Heuristique simple — reconnaît les 3 prompts templates de `packages/ai/src/prompts/`.
/// Si le prompt commence par une instruction connue, on l'identifie, sinon `unknown`.
fn detect_kind(prompt: &str) -> &'static str {
    let head = prompt.chars().take(400).collect::<String>().to_lowercase();
    if head.contains("extract") && head.contains("devis") {
        "extract_quote"
    } else if head.contains("brouillon d'email") || head.contains("draft email") {
        "draft_email"
    } else if head.contains("historique de conversation") || head.contains("assistant:") {
        "chat"
    } else {
        "unknown"
    }
}

fn preview_of(prompt: &str) -> String {
    prompt.chars().take(PROMPT_PREVIEW_LEN).collect::<String>()
}

/// Enregistre un nouveau run au moment du spawn. Retourne l'ID généré.
/// Le spawn_claude Tauri command doit stocker cet ID pour les updates.
pub fn start_session(prompt: &str) -> String {
    let id = format!("ai-{}-{}", now_ms(), fastrand::u32(..));
    let session = AiSession {
        id: id.clone(),
        kind: detect_kind(prompt).to_string(),
        status: SessionStatus::Pending,
        prompt_preview: preview_of(prompt),
        prompt_chars: prompt.chars().count(),
        started_at: now_ms(),
        ended_at: None,
        duration_ms: None,
        token_events: 0,
        cli_lines: 0,
        error: None,
        stderr: None,
        response_text: String::new(),
        final_result: None,
        tool_calls: Vec::new(),
        raw_events: Vec::new(),
    };
    store().write().active.push(session);
    id
}

/// Marque la session comme "streaming" dès la première ligne stdout reçue.
pub fn mark_streaming(id: &str) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        if matches!(s.status, SessionStatus::Pending) {
            s.status = SessionStatus::Streaming;
        }
    }
}

/// Incrémente le compteur de token events (pour la barre de progression UI).
pub fn bump_token(id: &str) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        s.token_events = s.token_events.saturating_add(1);
    }
}

/// Incrémente le compteur de lignes CLI (incluant system/other).
pub fn bump_cli_line(id: &str) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        s.cli_lines = s.cli_lines.saturating_add(1);
    }
}

/// Append un chunk de texte à la réponse accumulée. Tronque au-delà de
/// RESPONSE_MAX_BYTES pour éviter qu'une réponse de 200 KB ne reste en mémoire.
pub fn append_response(id: &str, chunk: &str) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        if s.response_text.len() >= RESPONSE_MAX_BYTES {
            return;
        }
        let remaining = RESPONSE_MAX_BYTES - s.response_text.len();
        if chunk.len() <= remaining {
            s.response_text.push_str(chunk);
        } else {
            // Tronque proprement sur une frontière UTF-8.
            let safe_end = chunk
                .char_indices()
                .take_while(|(i, _)| *i <= remaining)
                .last()
                .map(|(i, _)| i)
                .unwrap_or(0);
            s.response_text.push_str(&chunk[..safe_end]);
            s.response_text.push_str("…[tronqué]");
        }
    }
}

/// Stocke le résultat final parsé (après événement `result` du CLI).
pub fn set_final_result(id: &str, value: serde_json::Value) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        s.final_result = Some(value);
    }
}

/// Archive la ligne JSON brute dans le ring-buffer de la session — utile pour
/// debug quand le parser se trompe ou que des events sont ignorés.
pub fn record_raw_event(id: &str, line: &str) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        // Tronque les lignes trop longues (garde les 2 KB premiers).
        let trimmed = if line.len() > 2048 {
            format!("{}…", &line[..2048])
        } else {
            line.to_string()
        };
        s.raw_events.push(trimmed);
        if s.raw_events.len() > RAW_EVENTS_MAX {
            let drain_to = s.raw_events.len() - RAW_EVENTS_MAX;
            s.raw_events.drain(..drain_to);
        }
    }
}

/// Enregistre le début d'un tool call MCP. Retourne l'index pour update
/// ultérieur via `record_tool_call_end`.
pub fn record_tool_call_start(
    id: &str,
    name: &str,
    input: serde_json::Value,
) -> Option<usize> {
    let mut guard = store().write();
    let session = guard.active.iter_mut().find(|s| s.id == id)?;
    session.tool_calls.push(ToolCallRecord {
        name: name.to_string(),
        input,
        output: None,
        is_error: false,
        started_at: now_ms(),
        ended_at: None,
    });
    Some(session.tool_calls.len() - 1)
}

/// Complète un tool call avec son output (ou erreur).
pub fn record_tool_call_end(
    id: &str,
    index: usize,
    output: Option<serde_json::Value>,
    is_error: bool,
) {
    let mut guard = store().write();
    if let Some(s) = guard.active.iter_mut().find(|s| s.id == id) {
        if let Some(tc) = s.tool_calls.get_mut(index) {
            tc.output = output;
            tc.is_error = is_error;
            tc.ended_at = Some(now_ms());
        }
    }
}

/// Clôt la session avec un statut final. Déplace de `active` vers `history`.
pub fn end_session(id: &str, status: SessionStatus, error: Option<String>, stderr: Option<String>) {
    let mut guard = store().write();
    let Some(pos) = guard.active.iter().position(|s| s.id == id) else {
        return;
    };
    let mut session = guard.active.remove(pos);
    let ended = now_ms();
    session.ended_at = Some(ended);
    session.duration_ms = Some(ended - session.started_at);
    session.status = status;
    session.error = error;
    // Tronque stderr à 4 KB pour éviter les gros logs en mémoire.
    session.stderr = stderr.map(|s| {
        if s.len() > 4096 {
            format!("{}...[tronqué]", &s[..4096])
        } else {
            s
        }
    });

    guard.history.push(session);
    // Ring-buffer : on garde les MAX_HISTORY plus récents.
    if guard.history.len() > MAX_HISTORY {
        let drain_to = guard.history.len() - MAX_HISTORY;
        guard.history.drain(..drain_to);
    }
}

/// Snapshot complet : actives d'abord (ordre d'insertion), puis historique (du + récent au + ancien).
#[derive(Debug, Serialize)]
pub struct SessionsSnapshot {
    pub active: Vec<AiSession>,
    pub history: Vec<AiSession>,
}

#[tauri::command]
pub fn list_ai_sessions() -> SessionsSnapshot {
    let guard = store().read();
    let mut history = guard.history.clone();
    history.reverse(); // Plus récents d'abord.
    SessionsSnapshot {
        active: guard.active.clone(),
        history,
    }
}

/// Vide l'historique (sessions actives préservées).
#[tauri::command]
pub fn clear_ai_sessions_history() {
    store().write().history.clear();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_kind_variants() {
        assert_eq!(detect_kind("Extract a devis from the following brief"), "extract_quote");
        assert_eq!(detect_kind("Rédige un brouillon d'email pour"), "draft_email");
        assert_eq!(detect_kind("Historique de conversation:\n\nAssistant:"), "chat");
        assert_eq!(detect_kind("Hello world"), "unknown");
    }

    #[test]
    fn preview_truncates_to_200() {
        let long = "x".repeat(500);
        assert_eq!(preview_of(&long).len(), 200);
    }
}

// fastrand est utilisé juste pour un suffixe d'id uniq — si l'on veut éviter
// d'ajouter la dép, on peut replacer par un AtomicUsize global.
mod fastrand {
    use std::sync::atomic::{AtomicU32, Ordering};
    static COUNTER: AtomicU32 = AtomicU32::new(0);
    pub fn u32(_: std::ops::RangeFull) -> u32 {
        COUNTER.fetch_add(1, Ordering::Relaxed)
    }
}
