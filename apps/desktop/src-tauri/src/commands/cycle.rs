//! Cycle de vie devis + facture + onboarding : résorbe les dettes Wave 2.
//!
//! Ces commandes sont volontairement idempotentes. La vérité métier réside
//! dans la couche Drizzle/TypeScript côté renderer — ces endpoints Rust
//! fournissent uniquement :
//! 1. Le flag `setup_completed` persisté sur disque (table `setup_state`).
//! 2. L'atomicité CGI art. 289 pour la numérotation (via `state::next_sequence`).
//! 3. Un squelette typé pour les transitions de statut (la persistance DB réelle
//!    est gérée côté TS — ici on renvoie `()` / `null` pour signaler l'acceptation).
//!
//! Quand la couche DB Rust arrivera (v0.2), ces commandes seront étendues avec
//! lecture/écriture Drizzle équivalente côté back — la signature IPC reste stable.

use std::sync::Arc;

use chrono::{Datelike, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::state::{
    format_invoice_number, format_quote_number, AppState, FaktError, FaktResult,
    NumberingPayload,
};

#[tauri::command]
pub fn is_setup_completed(state: State<'_, Arc<AppState>>) -> bool {
    state.is_setup_completed()
}

#[tauri::command]
pub fn complete_setup(state: State<'_, Arc<AppState>>) -> FaktResult<()> {
    state.mark_setup_completed()
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IdPayload {
    pub id: String,
}

#[tauri::command]
pub fn mark_quote_invoiced(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> FaktResult<()> {
    validate_uuid(&id)?;
    tracing::info!(target = "fakt::cycle", id = %id, "mark_quote_invoiced");
    let _ = state;
    Ok(())
}

#[tauri::command]
pub fn mark_invoice_sent(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> FaktResult<()> {
    validate_uuid(&id)?;
    tracing::info!(target = "fakt::cycle", id = %id, "mark_invoice_sent");
    let _ = state;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct UpdateInvoicePayload {
    pub id: String,
    #[serde(default)]
    pub input: serde_json::Value,
}

#[tauri::command]
pub fn update_invoice(
    state: State<'_, Arc<AppState>>,
    id: String,
    #[allow(unused_variables)] input: serde_json::Value,
) -> FaktResult<()> {
    validate_uuid(&id)?;
    tracing::info!(target = "fakt::cycle", id = %id, "update_invoice");
    let _ = state;
    Ok(())
}

#[tauri::command]
pub fn delete_invoice(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> FaktResult<()> {
    validate_uuid(&id)?;
    tracing::info!(target = "fakt::cycle", id = %id, "delete_invoice");
    let _ = state;
    Ok(())
}

#[tauri::command]
pub fn numbering_next_quote(
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> FaktResult<NumberingPayload> {
    let year = Utc::now().year();
    let seq = state.next_sequence(&workspace_id, year, "quote")?;
    Ok(NumberingPayload {
        year,
        sequence: seq,
        formatted: format_quote_number(year, seq),
    })
}

#[tauri::command]
pub fn numbering_next_invoice(
    state: State<'_, Arc<AppState>>,
    workspace_id: String,
) -> FaktResult<NumberingPayload> {
    let year = Utc::now().year();
    let seq = state.next_sequence(&workspace_id, year, "invoice")?;
    Ok(NumberingPayload {
        year,
        sequence: seq,
        formatted: format_invoice_number(year, seq),
    })
}

fn validate_uuid(id: &str) -> FaktResult<()> {
    // UUID v4-ish : 36 chars avec tirets à positions fixes.
    // On reste permissif pour accepter les IDs legacy (UUID sans tirets).
    let len = id.len();
    if !(len == 32 || len == 36) {
        return Err(FaktError::Validation(format!(
            "id doit être un UUID (len={}) : {}",
            len, id
        )));
    }
    Ok(())
}
