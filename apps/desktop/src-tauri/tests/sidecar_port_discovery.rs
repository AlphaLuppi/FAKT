//! Test d'intégration pour la logique de port discovery du sidecar fakt-api.
//!
//! Simule les lignes stdout que le binaire `fakt-api` écrirait (incluant des
//! logs pino JSON entre la première ligne et la ligne ready), puis vérifie
//! que `parse_ready_line` extrait bien le port choisi par le kernel (PORT=0).

use fakt_lib::sidecar::{parse_ready_line, READY_PREFIX};

/// Ligne canonique écrite par le sidecar après bind kernel-assigned.
const READY_LINE: &str = "FAKT_API_READY:port=12345";

#[test]
fn ready_line_extracted_from_raw_stdout() {
    let port = parse_ready_line(READY_LINE).expect("parse OK");
    assert_eq!(port, Some(12345));
}

#[test]
fn ready_prefix_matches_constant() {
    assert!(READY_LINE.starts_with(READY_PREFIX));
}

#[test]
fn ignores_pino_json_logs_before_ready() {
    // Typique avant ready : logs pino niveau info.
    let lines = [
        r#"{"level":30,"time":1714123400000,"msg":"booting api-server"}"#,
        r#"{"level":30,"time":1714123400010,"msg":"db migrated"}"#,
        "FAKT_API_READY:port=54321",
    ];
    let mut found = None;
    for l in lines {
        if let Some(p) = parse_ready_line(l).expect("parse ok") {
            found = Some(p);
            break;
        }
    }
    assert_eq!(found, Some(54321));
}

#[test]
fn discovery_errors_on_nan_port() {
    let res = parse_ready_line("FAKT_API_READY:port=NaN");
    assert!(res.is_err(), "port NaN doit remonter une erreur");
}

#[test]
fn discovery_errors_on_out_of_range_port() {
    // u16::MAX = 65535 ; 70000 overflow.
    let res = parse_ready_line("FAKT_API_READY:port=70000");
    assert!(res.is_err(), "port > u16::MAX doit remonter une erreur");
}

#[test]
fn discovery_tolerates_cr_lf() {
    // Certains binaires Windows écrivent \r\n ; parse_ready_line strippe
    // déjà whitespace donc le \r en fin doit être absorbé.
    let port = parse_ready_line("FAKT_API_READY:port=42\r\n").expect("parse OK");
    assert_eq!(port, Some(42));
}

#[test]
fn discovery_returns_none_on_unrelated_output() {
    assert_eq!(parse_ready_line("listening on 0.0.0.0:3000").expect("parse ok"), None);
    assert_eq!(parse_ready_line("").expect("parse ok"), None);
    assert_eq!(parse_ready_line("FAKT_API_ERROR:db").expect("parse ok"), None);
}
