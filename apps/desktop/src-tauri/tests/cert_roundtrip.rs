//! Test d'intégration D1 — round-trip complet cert + keychain + fallback.
//!
//! Stratégie cross-OS :
//! - Le test `full_roundtrip_fallback` passe partout (déterministe, pas de dépendance OS).
//! - Le test `full_roundtrip_keychain` est `#[ignore]` par défaut car il requiert
//!   un keychain accessible — à lancer avec `cargo test -- --ignored` sur chaque OS.

use fakt_lib::crypto::cert::{
    cert_info_from_der, decode_private_key, generate_self_signed_cert, SubjectDn,
};
use fakt_lib::crypto::keychain::{
    self, store_private_key, StoreOutcome, DEFAULT_ACCOUNT,
};
use tempfile::tempdir;

fn sample_dn() -> SubjectDn {
    SubjectDn {
        common_name: "Tom Andrieu".to_string(),
        organization: Some("AlphaLuppi".to_string()),
        country: "FR".to_string(),
        email: Some("contact@alphaluppi.com".to_string()),
    }
}

#[test]
fn full_roundtrip_fallback() {
    // Génère cert
    let gen = generate_self_signed_cert(&sample_dn()).expect("génération cert");
    assert!(!gen.x509_der.is_empty());
    assert!(!gen.rsa_priv_pkcs8_der.is_empty());

    // Vérifie extraction info
    let info = cert_info_from_der(&gen.x509_der).expect("parse cert");
    assert!(info.subject_cn.to_lowercase().contains("tom"));

    // Validité >= 10 ans
    let y_nb: i32 = info.not_before_iso[0..4].parse().unwrap();
    let y_na: i32 = info.not_after_iso[0..4].parse().unwrap();
    assert!(y_na - y_nb >= 9, "validity too short: {} → {}", y_nb, y_na);

    // Store dans fallback file (pas de keychain réel pour ce test)
    let dir = tempdir().unwrap();
    let fallback_path = dir.path().join("cert-fallback.enc");
    let pw = "test-password-2026";

    // On force le fallback en utilisant un account unique + bypass direct
    keychain::store_in_fallback_file(&fallback_path, &gen.rsa_priv_pkcs8_der, pw)
        .expect("store fallback");
    let loaded = keychain::load_from_fallback_file(&fallback_path, pw)
        .expect("load fallback");
    assert_eq!(loaded, gen.rsa_priv_pkcs8_der);

    // Vérifie que la clé décodée est valide
    let _priv = decode_private_key(&loaded).expect("decode rsa");
}

#[test]
#[ignore = "requires OS keychain — run with --ignored on Windows/macOS/Linux"]
fn full_roundtrip_keychain() {
    let gen = generate_self_signed_cert(&sample_dn()).expect("génération cert");
    let account = format!("{}-test-{}", DEFAULT_ACCOUNT, rand_hex());

    let outcome = store_private_key(&account, &gen.rsa_priv_pkcs8_der, None, None)
        .expect("store keychain ok");
    assert!(matches!(outcome, StoreOutcome::Keychain));

    let loaded = keychain::load_private_key(&account, None, None)
        .expect("load keychain");
    assert_eq!(loaded, gen.rsa_priv_pkcs8_der);

    let _priv = decode_private_key(&loaded).expect("decode rsa");

    keychain::delete_from_keychain(&account).expect("cleanup");
}

fn rand_hex() -> String {
    use rand::RngCore;
    let mut b = [0u8; 8];
    rand::rngs::OsRng.fill_bytes(&mut b);
    hex::encode(b)
}
