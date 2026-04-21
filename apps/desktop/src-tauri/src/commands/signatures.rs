//! Commandes Tauri autour de la signature PAdES — Track I.
//!
//! Étoffe `sign_document` (déjà livré Wave 1) avec :
//! - `get_signature_events` : liste triée de la chaîne d'audit pour un doc.
//! - `append_signature_event` : insertion append-only côté back (miroir Rust).
//! - `store_signed_pdf` / `get_signed_pdf` : persistance binaire des PDF signés.
//! - `verify_signature` : calcul du VerifyReport consommé par la route
//!   `/signatures/:eventId/verify`.

use std::sync::Arc;

use tauri::State;

use crate::commands::state::{AppState, FaktError, FaktResult};
use crate::crypto::audit::SignatureEvent;
use crate::crypto::verify::{build_verify_report, VerifyReport};

#[tauri::command]
pub fn get_signature_events(
    state: State<'_, Arc<AppState>>,
    doc_type: String,
    doc_id: String,
) -> Vec<SignatureEvent> {
    let mut events = state.list_signature_events(&doc_type, &doc_id);
    events.sort_by(|a, b| a.timestamp_iso.cmp(&b.timestamp_iso));
    events
}

#[tauri::command]
pub fn append_signature_event(
    state: State<'_, Arc<AppState>>,
    event: SignatureEvent,
) -> FaktResult<()> {
    if event.id.is_empty() {
        return Err(FaktError::Validation("event.id vide".into()));
    }
    state.append_signature_event(event)
}

#[tauri::command]
pub fn store_signed_pdf(
    state: State<'_, Arc<AppState>>,
    doc_type: String,
    doc_id: String,
    bytes: Vec<u8>,
) -> FaktResult<String> {
    if bytes.is_empty() {
        return Err(FaktError::Validation("PDF signé vide".into()));
    }
    let path = state.store_signed_pdf(&doc_type, &doc_id, &bytes)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn get_signed_pdf(
    state: State<'_, Arc<AppState>>,
    doc_type: String,
    doc_id: String,
) -> FaktResult<Option<Vec<u8>>> {
    state.load_signed_pdf(&doc_type, &doc_id)
}

#[tauri::command]
pub fn verify_signature(
    state: State<'_, Arc<AppState>>,
    doc_id: String,
    event_id: String,
) -> FaktResult<VerifyReport> {
    let event = state
        .find_event(&event_id)
        .ok_or_else(|| FaktError::Validation(format!("event introuvable: {}", event_id)))?;
    // Si le docId reçu n'est pas celui de l'événement (cas /signatures/:eventId/verify
    // où le client passe eventId comme alias), on retombe sur l'event.document_id.
    let doc_id_effective = if event.document_id == doc_id {
        doc_id
    } else {
        event.document_id.clone()
    };
    let chain = state.list_signature_events(&event.document_type, &doc_id_effective);
    let signed_pdf = state.load_signed_pdf(&event.document_type, &doc_id_effective)?;
    Ok(build_verify_report(
        &event,
        &chain,
        signed_pdf.as_deref(),
    ))
}
