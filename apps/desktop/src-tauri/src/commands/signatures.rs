//! Commandes Tauri autour de la signature PAdES — Track I.
//!
//! Les audit events (GET / POST /api/signature-events) sont désormais persistés
//! par le sidecar api-server en SQLite. Ne restent ici que les routines qui
//! manipulent des bytes (PDF signé) ou accèdent au keychain.

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager, State};

use crate::commands::state::{AppState, FaktError, FaktResult};
use crate::crypto::audit::SignatureEvent;
use crate::crypto::verify::{build_verify_report, VerifyReport};
use crate::sidecar::ApiContext;

/// Timeout HTTP pour fetch audit depuis le sidecar. Court — une panne n'est
/// pas bloquante critique, l'utilisateur peut retenter la vérification.
const AUDIT_FETCH_TIMEOUT: Duration = Duration::from_secs(3);

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

/// Fetch la chaîne d'audit d'un document depuis l'api-server.
/// Endpoint côté sidecar (Track γ) :
/// `GET /api/signature-events?documentType=…&documentId=…` →
/// JSON `{ events: SignatureEvent[] }`.
async fn fetch_audit_chain(
    ctx: &ApiContext,
    doc_type: &str,
    doc_id: &str,
) -> FaktResult<Vec<SignatureEvent>> {
    let client = reqwest::Client::builder()
        .timeout(AUDIT_FETCH_TIMEOUT)
        .build()
        .map_err(|e| FaktError::State(format!("reqwest build: {e}")))?;
    let url = format!(
        "{}/api/signature-events?documentType={}&documentId={}",
        ctx.url(),
        percent_encode(doc_type),
        percent_encode(doc_id),
    );
    let resp = client
        .get(&url)
        .header("X-FAKT-Token", &ctx.token)
        .send()
        .await
        .map_err(|e| FaktError::State(format!("reqwest send: {e}")))?;
    if !resp.status().is_success() {
        return Err(FaktError::State(format!(
            "audit fetch non-2xx: {}",
            resp.status()
        )));
    }
    #[derive(serde::Deserialize)]
    struct ListResponse {
        events: Vec<SignatureEvent>,
    }
    let body: ListResponse = resp
        .json()
        .await
        .map_err(|e| FaktError::State(format!("json decode: {e}")))?;
    Ok(body.events)
}

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        match *b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            other => out.push_str(&format!("%{:02X}", other)),
        }
    }
    out
}

#[tauri::command]
pub async fn verify_signature(
    app: AppHandle,
    doc_id: String,
    event_id: String,
) -> FaktResult<VerifyReport> {
    let ctx = app
        .try_state::<Arc<ApiContext>>()
        .ok_or_else(|| FaktError::State("api-server non disponible (ApiContext missing)".into()))?;
    let state = app
        .try_state::<Arc<AppState>>()
        .ok_or_else(|| FaktError::State("AppState missing".into()))?;

    // On ignore le doc_type côté frontend — l'event connaît le sien. On essaie
    // invoice puis quote (deux seuls types valides) jusqu'à trouver l'event.
    let mut event: Option<SignatureEvent> = None;
    let mut chain: Vec<SignatureEvent> = Vec::new();
    for doc_type in ["invoice", "quote"].iter() {
        let fetched = fetch_audit_chain(&ctx, doc_type, &doc_id).await?;
        if let Some(hit) = fetched.iter().find(|e| e.id == event_id) {
            event = Some(hit.clone());
            chain = fetched;
            break;
        }
    }
    let event = event
        .ok_or_else(|| FaktError::Validation(format!("event introuvable: {}", event_id)))?;

    let doc_id_effective = if event.document_id == doc_id {
        doc_id
    } else {
        event.document_id.clone()
    };
    let signed_pdf = state.load_signed_pdf(&event.document_type, &doc_id_effective)?;
    Ok(build_verify_report(&event, &chain, signed_pdf.as_deref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_encode_preserves_safe_chars() {
        assert_eq!(percent_encode("invoice"), "invoice");
        assert_eq!(percent_encode("INV-2026-0001"), "INV-2026-0001");
    }

    #[test]
    fn percent_encode_escapes_unsafe_chars() {
        assert_eq!(percent_encode("a b"), "a%20b");
        assert_eq!(percent_encode("a?b&c=d"), "a%3Fb%26c%3Dd");
    }
}
