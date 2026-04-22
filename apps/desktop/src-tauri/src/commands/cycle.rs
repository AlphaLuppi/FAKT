//! Flag `setup_completed` — persisté en SQLite locale.
//!
//! Depuis le refacto API-server (Option C), les transitions de statut métier
//! (mark_quote_invoiced, mark_invoice_sent, update/delete_invoice) ainsi que
//! la numérotation atomique passent par le sidecar api-server HTTP. Il ne reste
//! ici que le flag local d'onboarding (local au process Tauri, pas au serveur).

use std::sync::Arc;

use tauri::State;

use crate::commands::state::{AppState, FaktResult};

#[tauri::command]
pub fn is_setup_completed(state: State<'_, Arc<AppState>>) -> bool {
    state.is_setup_completed()
}

#[tauri::command]
pub fn complete_setup(state: State<'_, Arc<AppState>>) -> FaktResult<()> {
    state.mark_setup_completed()
}
