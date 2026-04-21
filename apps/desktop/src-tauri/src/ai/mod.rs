//! AI module — Claude Code CLI subprocess integration.
//!
//! Exports Tauri commands registered in `main.rs` via `.invoke_handler(...)`.

pub mod cli;

pub use cli::{check_claude_cli, spawn_claude, AiStreamEvent, CliCheckResult};
