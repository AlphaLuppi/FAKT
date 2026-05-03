//! Commande Tauri exposant le calcul du `compute_self_hash_hex` d'un
//! `SignatureEvent` au frontend.
//!
//! Utilisé par l'UI « Importer signature client » : avant d'appender un
//! nouvel event au sidecar, le frontend doit calculer le `previousEventHash`
//! du dernier event de la chaîne. Cette logique de hash chaîné vit côté
//! Rust (`crate::crypto::audit`) et ne doit PAS être dupliquée en TS — sinon
//! la moindre divergence casserait la vérification d'intégrité.

use crate::crypto::audit::SignatureEvent;

/// Shape DTO côté frontend : Tauri convertit automatiquement camelCase TS
/// en snake_case Rust à la désérialisation, donc le frontend passe le
/// `SignatureEvent` TS tel quel (pas de conversion explicite côté JS).
#[tauri::command]
pub fn compute_signature_event_self_hash(event: SignatureEvent) -> String {
    event.compute_self_hash_hex()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_event() -> SignatureEvent {
        SignatureEvent {
            id: "evt-1".into(),
            document_type: "quote".into(),
            document_id: "quote-1".into(),
            signer_name: "Client SARL".into(),
            signer_email: "client@example.fr".into(),
            ip_address: None,
            user_agent: None,
            timestamp_iso: "2026-05-03T12:00:00Z".into(),
            doc_hash_before: "a".repeat(64),
            doc_hash_after: "b".repeat(64),
            signature_png_base64: None,
            tsa_provider: None,
            tsa_response_base64: None,
            previous_event_hash: None,
        }
    }

    #[test]
    fn hash_is_deterministic() {
        let h1 = compute_signature_event_self_hash(sample_event());
        let h2 = compute_signature_event_self_hash(sample_event());
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn hash_changes_when_field_changes() {
        let original = compute_signature_event_self_hash(sample_event());
        let mut modified = sample_event();
        modified.doc_hash_after = "c".repeat(64);
        let after = compute_signature_event_self_hash(modified);
        assert_ne!(original, after);
    }
}
