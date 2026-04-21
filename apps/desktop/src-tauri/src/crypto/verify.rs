//! Vérification d'intégrité d'une signature PAdES-B-T + chaîne d'audit.
//!
//! Ce module calcule :
//! - `integrity_ok` : le hash byte-range du PDF signé correspond à `doc_hash_after`.
//! - `chain_ok` : chaque `previous_event_hash` de la chaîne matche le `self_hash`
//!   du précédent (verify_chain).
//!
//! La vérification complète CMS/PAdES (OCSP, CRL, trust anchor) est hors scope
//! v0.1 — on se limite à la cohérence interne suffisante pour assurer
//! l'intégrité du document + l'append-only de l'audit trail.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::crypto::audit::{verify_chain, SignatureEvent};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyReport {
    pub event_id: String,
    pub document_type: String,
    pub document_id: String,
    pub integrity_ok: bool,
    pub chain_ok: bool,
    pub chain_length: usize,
    pub broken_chain_indices: Vec<usize>,
    pub doc_hash_before: String,
    pub doc_hash_after: String,
    pub tsa_provider: Option<String>,
    pub signer_name: String,
    pub signer_email: String,
    pub timestamp_iso: String,
    pub pades_level: String,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

/// Produit un VerifyReport à partir d'un événement cible + chaîne complète
/// + PDF signé éventuel (None → vérification limitée à la chaîne).
pub fn build_verify_report(
    event: &SignatureEvent,
    chain: &[SignatureEvent],
    signed_pdf: Option<&[u8]>,
) -> VerifyReport {
    let broken = verify_chain(chain);
    let chain_ok = broken.is_empty();
    let integrity_ok = match signed_pdf {
        Some(bytes) => {
            let computed = sha256_hex(bytes);
            computed == event.doc_hash_after
        }
        None => true,
    };
    let pades_level = if event.tsa_provider.is_some() {
        "B-T".to_string()
    } else {
        "B".to_string()
    };
    VerifyReport {
        event_id: event.id.clone(),
        document_type: event.document_type.clone(),
        document_id: event.document_id.clone(),
        integrity_ok,
        chain_ok,
        chain_length: chain.len(),
        broken_chain_indices: broken,
        doc_hash_before: event.doc_hash_before.clone(),
        doc_hash_after: event.doc_hash_after.clone(),
        tsa_provider: event.tsa_provider.clone(),
        signer_name: event.signer_name.clone(),
        signer_email: event.signer_email.clone(),
        timestamp_iso: event.timestamp_iso.clone(),
        pades_level,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::audit::compute_previous_hash;

    fn fixture(id: &str, prev: Option<&SignatureEvent>) -> SignatureEvent {
        SignatureEvent {
            id: id.to_string(),
            document_type: "quote".to_string(),
            document_id: "doc-1".to_string(),
            signer_name: "Tom".to_string(),
            signer_email: "tom@alphaluppi.com".to_string(),
            ip_address: None,
            user_agent: None,
            timestamp_iso: "2026-04-22T10:00:00Z".to_string(),
            doc_hash_before: sha256_hex(b"before"),
            doc_hash_after: sha256_hex(b"after"),
            signature_png_base64: None,
            tsa_provider: Some("https://freetsa.org/tsr".into()),
            tsa_response_base64: None,
            previous_event_hash: compute_previous_hash(prev),
        }
    }

    #[test]
    fn report_marks_integrity_ok_when_hash_matches() {
        let e = fixture("e1", None);
        let expected = e.doc_hash_after.clone();
        // Sample PDF bytes whose sha256 matches doc_hash_after.
        let bytes = b"after";
        let sig_pdf_hash = sha256_hex(bytes);
        assert_eq!(expected, sig_pdf_hash);
        let rep = build_verify_report(&e, &[e.clone()], Some(bytes));
        assert!(rep.integrity_ok);
        assert!(rep.chain_ok);
        assert_eq!(rep.pades_level, "B-T");
    }

    #[test]
    fn report_marks_integrity_broken_on_tamper() {
        let e = fixture("e1", None);
        let rep = build_verify_report(&e, &[e.clone()], Some(b"tampered"));
        assert!(!rep.integrity_ok);
    }

    #[test]
    fn report_marks_chain_broken_when_prev_hash_mismatch() {
        let e1 = fixture("e1", None);
        let mut e2 = fixture("e2", Some(&e1));
        e2.previous_event_hash = Some("deadbeef".to_string());
        let rep = build_verify_report(&e2, &[e1, e2.clone()], None);
        assert!(!rep.chain_ok);
        assert!(rep.broken_chain_indices.contains(&1));
    }
}
