//! Audit trail chaîné SHA-256 append-only (FR-018).
//!
//! Architecture (archi §7.7) :
//! - Chaque événement signature insère une ligne dans `signature_events` (SQLite).
//! - `previous_event_hash` = SHA-256 des champs de l'événement précédent.
//! - Cette chaîne permet de détecter toute modification rétroactive des logs.
//!
//! **Couplage Rust → TS :** l'insertion DB se fait côté TS via `drizzle` (Track C).
//! Ce module Rust expose uniquement :
//! - La structure `SignatureEvent` serializable.
//! - Le calcul `append_signature_event_hash` (hash chain).
//!
//! L'appel effectif `db.signature_events.insert` se fait depuis le consumer TS
//! après réception du `SignatureEvent` via Tauri event/command (pas de coupling
//! direct Rust → Drizzle).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::crypto::error::CryptoResult;

/// Un événement signature à insérer en DB.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureEvent {
    pub id: String,
    pub document_type: String, // "quote" | "invoice"
    pub document_id: String,
    pub signer_name: String,
    pub signer_email: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub timestamp_iso: String,
    pub doc_hash_before: String, // hex SHA-256
    pub doc_hash_after: String,  // hex SHA-256
    pub signature_png_base64: Option<String>,
    pub tsa_provider: Option<String>,
    /// TSA response (TimeStampToken) encodée base64 pour stockage DB.
    pub tsa_response_base64: Option<String>,
    /// Hash SHA-256 de l'événement précédent (hex) — None si premier événement.
    pub previous_event_hash: Option<String>,
}

impl SignatureEvent {
    /// Calcule le hash SHA-256 de cet événement — utilisé pour chaîner au suivant.
    ///
    /// Format déterministe — couvre **tous** les champs métier + `previous_event_hash`
    /// pour empêcher tout tampering rétroactif (P0 security fix) :
    /// `id|document_type|document_id|signer_name|signer_email|ip_address|user_agent|
    ///  timestamp_iso|doc_hash_before|doc_hash_after|signature_png_base64|
    ///  tsa_provider|tsa_response_base64|previous_event_hash`.
    pub fn compute_self_hash(&self) -> [u8; 32] {
        let mut hasher = Sha256::new();
        let fields: [&str; 14] = [
            &self.id,
            &self.document_type,
            &self.document_id,
            &self.signer_name,
            &self.signer_email,
            self.ip_address.as_deref().unwrap_or(""),
            self.user_agent.as_deref().unwrap_or(""),
            &self.timestamp_iso,
            &self.doc_hash_before,
            &self.doc_hash_after,
            self.signature_png_base64.as_deref().unwrap_or(""),
            self.tsa_provider.as_deref().unwrap_or(""),
            self.tsa_response_base64.as_deref().unwrap_or(""),
            self.previous_event_hash.as_deref().unwrap_or(""),
        ];
        for (i, f) in fields.iter().enumerate() {
            if i > 0 {
                hasher.update(b"|");
            }
            hasher.update(f.as_bytes());
        }
        hasher.finalize().into()
    }

    /// Hash hex — pratique pour affichage / storage DB.
    pub fn compute_self_hash_hex(&self) -> String {
        hex::encode(self.compute_self_hash())
    }
}

/// Calcule le `previous_event_hash` à utiliser pour un **nouvel** événement,
/// à partir de l'événement précédent (ou `None` pour le premier).
pub fn compute_previous_hash(prev: Option<&SignatureEvent>) -> Option<String> {
    prev.map(|p| p.compute_self_hash_hex())
}

/// Vérifie l'intégrité d'une chaîne d'événements.
///
/// Retourne la liste des index où une incohérence a été détectée.
pub fn verify_chain(events: &[SignatureEvent]) -> Vec<usize> {
    let mut broken = Vec::new();
    for (i, evt) in events.iter().enumerate() {
        let expected = if i == 0 {
            None
        } else {
            Some(events[i - 1].compute_self_hash_hex())
        };
        if evt.previous_event_hash != expected {
            broken.push(i);
        }
    }
    broken
}

/// Helper de bas niveau : appendé un nouveau hash à un précédent pour produire un
/// nouveau hash (signature brute : `sha256(prev || event_data)`).
///
/// Utilisé par D2 pour tests déterministes de la chaîne.
pub fn append_signature_event(prev_hash: [u8; 32], event_data: &[u8]) -> CryptoResult<[u8; 32]> {
    let mut h = Sha256::new();
    h.update(prev_hash);
    h.update(event_data);
    Ok(h.finalize().into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_event(id: &str, prev: Option<&SignatureEvent>) -> SignatureEvent {
        let prev_hash = compute_previous_hash(prev);
        SignatureEvent {
            id: id.to_string(),
            document_type: "invoice".to_string(),
            document_id: "INV-2026-0001".to_string(),
            signer_name: "Tom Andrieu".to_string(),
            signer_email: "contact@alphaluppi.com".to_string(),
            ip_address: Some("127.0.0.1".to_string()),
            user_agent: Some("FAKT/0.1.0".to_string()),
            timestamp_iso: "2026-04-21T19:40:00Z".to_string(),
            doc_hash_before: format!("{:064x}", 42),
            doc_hash_after: format!("{:064x}", 43),
            signature_png_base64: None,
            tsa_provider: Some("https://freetsa.org/tsr".to_string()),
            tsa_response_base64: None,
            previous_event_hash: prev_hash,
        }
    }

    #[test]
    fn self_hash_deterministic() {
        let e = sample_event("evt-1", None);
        let h1 = e.compute_self_hash_hex();
        let h2 = e.compute_self_hash_hex();
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64);
    }

    #[test]
    fn chain_linked_correctly() {
        let e1 = sample_event("evt-1", None);
        let e2 = sample_event("evt-2", Some(&e1));
        let e3 = sample_event("evt-3", Some(&e2));

        let events = vec![e1.clone(), e2.clone(), e3.clone()];
        let broken = verify_chain(&events);
        assert!(broken.is_empty(), "chain should be valid: {:?}", broken);

        // Modifier e2.doc_hash_after ne casse pas la chaîne telle que stockée, mais
        // le previous_event_hash de e3 ne matche plus.
        let mut e2_tampered = e2.clone();
        e2_tampered.doc_hash_after = format!("{:064x}", 999);
        let events_bad = vec![e1, e2_tampered, e3];
        let broken = verify_chain(&events_bad);
        assert_eq!(broken, vec![2], "tampering should break index 2");
    }

    #[test]
    fn append_event_helper_works() {
        let prev = [0u8; 32];
        let data = b"event-1-data";
        let h1 = append_signature_event(prev, data).unwrap();
        let h2 = append_signature_event(prev, data).unwrap();
        assert_eq!(h1, h2);

        let h3 = append_signature_event(h1, b"event-2-data").unwrap();
        assert_ne!(h1, h3);
    }

    #[test]
    fn first_event_has_no_previous() {
        let e = sample_event("evt-1", None);
        assert!(e.previous_event_hash.is_none());
        let broken = verify_chain(&[e]);
        assert!(broken.is_empty());
    }

    /// P0 security : chaque champ métier doit être couvert par `compute_self_hash`.
    /// On tampere champ par champ et on attend que `verify_chain` détecte la cassure.
    #[test]
    fn tampering_each_field_breaks_chain() {
        let e1 = sample_event("evt-1", None);
        let e2 = sample_event("evt-2", Some(&e1));

        // Each mutator modifies exactly one field of e1 (an "old" event in the chain).
        let mutators: Vec<(&str, fn(&mut SignatureEvent))> = vec![
            ("document_type", |e| e.document_type = "quote".into()),
            ("document_id", |e| e.document_id = "TAMPERED".into()),
            ("signer_name", |e| e.signer_name = "Mallory".into()),
            ("signer_email", |e| e.signer_email = "evil@x.com".into()),
            ("ip_address", |e| e.ip_address = Some("10.0.0.1".into())),
            ("user_agent", |e| e.user_agent = Some("curl/8".into())),
            ("timestamp_iso", |e| e.timestamp_iso = "2099-01-01T00:00:00Z".into()),
            ("doc_hash_before", |e| e.doc_hash_before = format!("{:064x}", 9999)),
            ("doc_hash_after", |e| e.doc_hash_after = format!("{:064x}", 7777)),
            ("signature_png_base64", |e| e.signature_png_base64 = Some("ZmFrZQ==".into())),
            ("tsa_provider", |e| e.tsa_provider = Some("http://evil.tsa".into())),
            ("tsa_response_base64", |e| e.tsa_response_base64 = Some("dHNh".into())),
        ];

        for (name, mutate) in mutators {
            let mut e1_t = e1.clone();
            mutate(&mut e1_t);
            let broken = verify_chain(&[e1_t, e2.clone()]);
            assert_eq!(
                broken,
                vec![1],
                "tampering `{}` on e1 must break e2's previous_event_hash link",
                name
            );
        }
    }

    /// Tampering de `previous_event_hash` lui-même (directement) cassse aussi la chaîne.
    #[test]
    fn tampering_previous_event_hash_breaks_chain() {
        let e1 = sample_event("evt-1", None);
        let mut e2 = sample_event("evt-2", Some(&e1));
        e2.previous_event_hash = Some(format!("{:064x}", 0));
        let broken = verify_chain(&[e1, e2]);
        assert_eq!(broken, vec![1]);
    }
}
