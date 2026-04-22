//! P0 security : `store_signed_pdf` / `load_signed_pdf` doivent rejeter tout
//! `doc_id` ou `doc_type` qui permettrait un path traversal (`..`, `/`, `\`)
//! ou qui contiendrait un caractère hors de `[A-Za-z0-9_-]`.
//!
//! La commande Tauri est exposée au webview, donc un bug frontend ou une
//! prompt-injection IA qui fabrique un doc_id malicieux ne doit PAS pouvoir
//! écraser des fichiers hors du répertoire `signed/`.

use tempfile::TempDir;

use fakt_lib::commands::AppState;

fn make_state() -> (TempDir, std::sync::Arc<AppState>) {
    let tmp = TempDir::new().expect("tempdir");
    let state = AppState::new(tmp.path()).expect("AppState");
    (tmp, state)
}

#[test]
fn store_signed_pdf_rejects_parent_escape() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "../../escape", b"pdf");
    assert!(
        res.is_err(),
        "doc_id avec `..` DOIT être rejeté, got: {:?}",
        res.as_ref().err()
    );
}

#[test]
fn store_signed_pdf_rejects_forward_slash() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "foo/bar", b"pdf");
    assert!(res.is_err(), "doc_id avec `/` DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_backslash() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "foo\\bar", b"pdf");
    assert!(res.is_err(), "doc_id avec `\\` DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_nul_byte() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "foo\0bar", b"pdf");
    assert!(res.is_err(), "doc_id avec NUL DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_control_chars() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "foo\nbar", b"pdf");
    assert!(res.is_err(), "doc_id avec \\n DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_dot_dot_segment() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "..", b"pdf");
    assert!(res.is_err(), "doc_id `..` DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_empty_doc_id() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "", b"pdf");
    assert!(res.is_err(), "doc_id vide DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_too_long_doc_id() {
    let (_tmp, state) = make_state();
    let long = "a".repeat(65);
    let res = state.store_signed_pdf("invoice", &long, b"pdf");
    assert!(res.is_err(), "doc_id > 64 chars DOIT être rejeté");
}

#[test]
fn store_signed_pdf_rejects_invalid_doc_type() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice/../x", "inv-001", b"pdf");
    assert!(res.is_err(), "doc_type contaminé DOIT être rejeté");
}

#[test]
fn store_signed_pdf_accepts_safe_ident() {
    let (_tmp, state) = make_state();
    let res = state.store_signed_pdf("invoice", "INV-2026-0001", b"pdf-bytes");
    assert!(res.is_ok(), "doc_id sain DOIT être accepté: {:?}", res.err());
    let path = res.unwrap();
    assert!(path.ends_with("invoice-INV-2026-0001.pdf"));
    assert!(path.exists());
}

#[test]
fn store_signed_pdf_accepts_ulid_like_id() {
    let (_tmp, state) = make_state();
    // ULID-like: 26 alphanum chars, dashes and underscores permitted.
    let res = state.store_signed_pdf("quote", "01HW4G5Z7K_B3N-QX", b"pdf");
    assert!(res.is_ok(), "ULID-like DOIT être accepté: {:?}", res.err());
}

#[test]
fn load_signed_pdf_rejects_traversal() {
    let (_tmp, state) = make_state();
    let res = state.load_signed_pdf("invoice", "../../escape");
    assert!(res.is_err(), "load avec `..` DOIT être rejeté");
}

#[test]
fn load_signed_pdf_returns_none_for_missing_safe_id() {
    let (_tmp, state) = make_state();
    let res = state.load_signed_pdf("invoice", "MISSING-001");
    assert!(
        matches!(res, Ok(None)),
        "load d'un id sain mais absent DOIT retourner Ok(None), got: {:?}",
        res
    );
}

#[test]
fn roundtrip_store_then_load() {
    let (_tmp, state) = make_state();
    let content = b"signed-pdf-content-bytes";
    state
        .store_signed_pdf("invoice", "INV-2026-0042", content)
        .expect("store");
    let loaded = state
        .load_signed_pdf("invoice", "INV-2026-0042")
        .expect("load")
        .expect("some");
    assert_eq!(loaded, content);
}
