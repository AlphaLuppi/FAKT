//! HTTP client Rust → api-server sidecar pour persister les événements
//! signature en SQLite (via POST /api/signature-events).
//!
//! Remplace l'ancien `Mutex<Vec<SignatureEvent>>` qui perdait l'audit trail
//! à chaque redémarrage Tauri (cf. `docs/sprint-notes/e2e-wiring-audit.md`
//! §6.2).
//!
//! Conception best-effort : si l'api-server n'est pas joignable (spawn
//! échoué, sidecar tué manuellement, etc.), on log un warning mais on ne
//! fait pas échouer l'opération de signature — un PDF signé reste valide
//! même si l'event audit est perdu. Tom doit relancer `POST` à la main si
//! nécessaire (Known Issue CHANGELOG v0.1.0).

use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::crypto::audit::SignatureEvent;
use crate::sidecar::ApiContext;

/// Timeout appliqué au POST audit — volontairement agressif pour ne pas
/// bloquer la signature si l'api-server est down.
const AUDIT_POST_TIMEOUT: Duration = Duration::from_secs(3);

/// Erreur opaque — les callers la loguent comme warning et continuent.
#[derive(Debug, thiserror::Error)]
pub enum AuditPostError {
    #[error("api-server non disponible (ApiContext missing)")]
    NoApiContext,
    #[error("reqwest: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("http {status}: {body}")]
    HttpStatus { status: u16, body: String },
}

#[derive(Debug, Serialize)]
struct SignatureEventPayload<'a> {
    #[serde(flatten)]
    event: &'a SignatureEvent,
}

/// POST l'event vers `/api/signature-events`. Renvoie `Err` si l'appel
/// échoue — le caller est censé logger et continuer.
pub async fn post_signature_event(
    app: &AppHandle,
    event: &SignatureEvent,
) -> Result<(), AuditPostError> {
    let ctx = app
        .try_state::<std::sync::Arc<ApiContext>>()
        .ok_or(AuditPostError::NoApiContext)?;
    post_to_ctx(&ctx, event).await
}

async fn post_to_ctx(
    ctx: &ApiContext,
    event: &SignatureEvent,
) -> Result<(), AuditPostError> {
    let client = reqwest::Client::builder()
        .timeout(AUDIT_POST_TIMEOUT)
        .build()?;
    let url = format!("{}/api/signature-events", ctx.url());
    let payload = SignatureEventPayload { event };
    let resp = client
        .post(&url)
        .header("X-FAKT-Token", &ctx.token)
        .json(&payload)
        .send()
        .await?;
    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "<body read failed>".to_string());
        return Err(AuditPostError::HttpStatus { status, body });
    }
    Ok(())
}

/// Variante best-effort : ne jamais propager l'erreur, log un warning.
pub async fn post_signature_event_best_effort(app: &AppHandle, event: &SignatureEvent) {
    match post_signature_event(app, event).await {
        Ok(()) => {
            tracing::info!(
                target = "fakt::audit",
                event_id = %event.id,
                doc_id = %event.document_id,
                "signature event persisted to api-server"
            );
        }
        Err(e) => {
            tracing::warn!(
                target = "fakt::audit",
                event_id = %event.id,
                doc_id = %event.document_id,
                error = %e,
                "signature event POST failed; event sera perdu jusqu'à re-signature (cf. Known Issues v0.1.0)"
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use parking_lot::Mutex;

    fn sample_event() -> SignatureEvent {
        SignatureEvent {
            id: "evt-test".to_string(),
            document_type: "invoice".to_string(),
            document_id: "INV-2026-0001".to_string(),
            signer_name: "Tom Andrieu".to_string(),
            signer_email: "contact@alphaluppi.com".to_string(),
            ip_address: None,
            user_agent: None,
            timestamp_iso: "2026-04-22T12:00:00Z".to_string(),
            doc_hash_before: format!("{:064x}", 1),
            doc_hash_after: format!("{:064x}", 2),
            signature_png_base64: None,
            tsa_provider: None,
            tsa_response_base64: None,
            previous_event_hash: None,
        }
    }

    fn fake_ctx(port: u16, token: &str) -> Arc<ApiContext> {
        Arc::new(ApiContext {
            port,
            token: token.to_string(),
            child: Mutex::new(None),
            crash_timestamps: Mutex::new(Vec::new()),
        })
    }

    #[tokio::test]
    async fn post_fails_if_server_down() {
        // Port inoccupé — la connexion reqwest doit échouer rapidement.
        let ctx = fake_ctx(1, "token");
        let event = sample_event();
        let err = post_to_ctx(&ctx, &event).await.unwrap_err();
        // On attend une erreur de type Reqwest (connexion refusée ou timeout),
        // pas un HttpStatus (celui-ci n'est émis que si on reçoit une réponse).
        match err {
            AuditPostError::Reqwest(_) => {}
            other => panic!("attendu Reqwest, reçu {:?}", other),
        }
    }

    #[tokio::test]
    async fn payload_flattens_signature_event_fields() {
        // Vérifie que la sérialisation JSON aplatit bien les champs de l'event
        // à la racine du body — conforme au schéma Zod côté api-server.
        let event = sample_event();
        let payload = SignatureEventPayload { event: &event };
        let json = serde_json::to_value(&payload).unwrap();
        let obj = json.as_object().expect("payload object");
        assert!(obj.contains_key("id"));
        assert!(obj.contains_key("document_type"));
        assert!(obj.contains_key("document_id"));
        assert!(obj.contains_key("doc_hash_after"));
        assert_eq!(obj.get("id").and_then(|v| v.as_str()), Some("evt-test"));
    }
}
