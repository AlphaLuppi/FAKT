//! Test haut niveau de `build_verify_report` sur des fixtures déterministes.

use fakt_lib::crypto::audit::{compute_previous_hash, SignatureEvent};
use fakt_lib::crypto::verify::{build_verify_report, sha256_hex};

fn make_event(id: &str, prev: Option<&SignatureEvent>, hash_after: &str) -> SignatureEvent {
    SignatureEvent {
        id: id.to_string(),
        document_type: "quote".to_string(),
        document_id: "doc-verify".to_string(),
        signer_name: "Tom".to_string(),
        signer_email: "tom@alphaluppi.com".to_string(),
        ip_address: None,
        user_agent: None,
        timestamp_iso: "2026-04-22T14:00:00Z".to_string(),
        doc_hash_before: sha256_hex(b"before"),
        doc_hash_after: hash_after.to_string(),
        signature_png_base64: None,
        tsa_provider: Some("https://freetsa.org/tsr".into()),
        tsa_response_base64: None,
        previous_event_hash: compute_previous_hash(prev),
    }
}

#[test]
fn report_integrity_ok_when_bytes_match_hash_after() {
    let bytes = b"signed-pdf-content";
    let hash = sha256_hex(bytes);
    let ev = make_event("e1", None, &hash);
    let rep = build_verify_report(&ev, &[ev.clone()], Some(bytes));
    assert!(rep.integrity_ok);
    assert!(rep.chain_ok);
    assert_eq!(rep.pades_level, "B-T");
    assert_eq!(rep.chain_length, 1);
}

#[test]
fn report_integrity_broken_on_tamper() {
    let hash = sha256_hex(b"original");
    let ev = make_event("e1", None, &hash);
    let rep = build_verify_report(&ev, &[ev.clone()], Some(b"tampered"));
    assert!(!rep.integrity_ok);
}

#[test]
fn report_chain_broken_when_prev_hash_forged() {
    let h1 = sha256_hex(b"doc-1");
    let h2 = sha256_hex(b"doc-2");
    let e1 = make_event("e1", None, &h1);
    let mut e2 = make_event("e2", Some(&e1), &h2);
    e2.previous_event_hash = Some("00".repeat(32));
    let rep = build_verify_report(&e2, &[e1, e2.clone()], None);
    assert!(!rep.chain_ok);
    assert!(rep.broken_chain_indices.contains(&1));
}
