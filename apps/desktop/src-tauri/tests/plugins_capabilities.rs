//! Valide que :
//! 1. `capabilities/default.json` est un JSON valide et contient les permissions
//!    critiques (`fs:default`, `dialog:default`, `shell:default`).
//! 2. La configuration scope fs est bien présente et limitée (least-privilege) :
//!    ne contient pas `$ROOT` / `$HOME` ouverts sur tout le disque.
//!
//! Le check réel d'initialisation des plugins fs/dialog au boot Tauri est
//! implicite : si les crates manquent dans Cargo.toml, le crate ne compile
//! même pas → `cargo test` échoue avant d'atteindre ce test.

use std::path::PathBuf;

use fakt_lib::crypto::tsa::default_endpoints;

fn capabilities_path() -> PathBuf {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    PathBuf::from(manifest_dir).join("capabilities").join("default.json")
}

fn tauri_conf_path() -> PathBuf {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    PathBuf::from(manifest_dir).join("tauri.conf.json")
}

fn load_capabilities() -> serde_json::Value {
    let raw = std::fs::read_to_string(capabilities_path())
        .expect("capabilities/default.json doit exister");
    serde_json::from_str(&raw).expect("capabilities/default.json doit être un JSON valide")
}

fn load_tauri_conf() -> serde_json::Value {
    let raw = std::fs::read_to_string(tauri_conf_path())
        .expect("tauri.conf.json doit exister");
    serde_json::from_str(&raw).expect("tauri.conf.json doit être un JSON valide")
}

/// Extrait la chaîne d'origine TSA d'une URL `https://host[:port]/path`.
fn origin_of(url: &str) -> String {
    // `https://host/tsr` → `https://host`
    let rest = url.trim_start_matches("https://");
    let host = rest.split('/').next().unwrap_or("");
    format!("https://{}", host)
}

#[test]
fn capabilities_json_is_valid() {
    let v = load_capabilities();
    assert_eq!(
        v.get("identifier").and_then(|i| i.as_str()),
        Some("default"),
        "identifier doit être 'default'"
    );
    assert!(
        v.get("permissions").and_then(|p| p.as_array()).is_some(),
        "permissions doit être un array"
    );
}

#[test]
fn capabilities_include_fs_dialog_shell() {
    let v = load_capabilities();
    let perms = v
        .get("permissions")
        .and_then(|p| p.as_array())
        .expect("permissions array");

    let has = |needle: &str| -> bool {
        perms.iter().any(|p| p.as_str() == Some(needle))
    };

    // Plugins fs + dialog + shell doivent être déclarés (défaut + permissions
    // spécifiques consommées par email draft, archive ZIP, open URL externe).
    assert!(has("fs:default"), "fs:default absent");
    assert!(has("fs:allow-write-text-file"), "fs:allow-write-text-file absent");
    assert!(has("dialog:default"), "dialog:default absent");
    assert!(has("dialog:allow-save"), "dialog:allow-save absent");
    assert!(has("shell:default"), "shell:default absent");
    assert!(has("shell:allow-open"), "shell:allow-open absent");
}

#[test]
fn capabilities_fs_scope_is_least_privilege() {
    let v = load_capabilities();
    let perms = v
        .get("permissions")
        .and_then(|p| p.as_array())
        .expect("permissions array");

    let fs_scope = perms
        .iter()
        .find(|p| {
            p.get("identifier").and_then(|i| i.as_str()) == Some("fs:scope")
        })
        .expect("fs:scope doit être présent pour limiter l'accès filesystem");

    let allow = fs_scope
        .get("allow")
        .and_then(|a| a.as_array())
        .expect("fs:scope.allow doit être un array");

    let paths: Vec<&str> = allow
        .iter()
        .filter_map(|e| e.get("path").and_then(|p| p.as_str()))
        .collect();

    // Au minimum : TEMP (drafts email), AppData (DB + signed PDFs),
    // Downloads (save ZIP destination choisi par user).
    assert!(
        paths.iter().any(|p| p.contains("$TEMP")),
        "fs:scope doit autoriser $TEMP (drafts email)"
    );
    assert!(
        paths.iter().any(|p| p.contains("$APPDATA") || p.contains("$APPLOCALDATA")),
        "fs:scope doit autoriser $APPDATA ou $APPLOCALDATA"
    );

    // Sécurité : JAMAIS le filesystem entier (pas de scope $HOME/**, $ROOT/**,
    // ni wildcard seul `**`).
    for p in &paths {
        assert!(
            !matches!(*p, "**" | "$HOME/**" | "$ROOT/**" | "/**"),
            "fs:scope ne doit PAS ouvrir le filesystem entier : {}",
            p
        );
    }
}

/// P0 security : la CSP `connect-src` doit whitelister TOUS les endpoints TSA
/// effectifs retournés par `tsa::default_endpoints()`. Un fallback non listé
/// bloquerait silencieusement toute future requête fetch → rétrogradation
/// PAdES-B-T → B sans erreur visible.
#[test]
fn csp_connect_src_covers_all_tsa_endpoints() {
    let conf = load_tauri_conf();
    let csp = conf
        .get("app")
        .and_then(|a| a.get("security"))
        .and_then(|s| s.get("csp"))
        .and_then(|c| c.as_str())
        .expect("tauri.conf.json > app.security.csp doit exister");

    // Isoler la directive connect-src.
    let connect_src = csp
        .split(';')
        .map(|s| s.trim())
        .find(|s| s.starts_with("connect-src"))
        .expect("csp doit définir connect-src");

    for url in default_endpoints() {
        let origin = origin_of(url);
        assert!(
            connect_src.contains(&origin),
            "connect-src CSP doit inclure {} (endpoint TSA {}), trouvé: {}",
            origin,
            url,
            connect_src
        );
    }
}

/// P0 security : aucun endpoint TSA ne doit utiliser HTTP plaintext (MITM).
#[test]
fn csp_connect_src_has_no_plaintext_tsa() {
    let conf = load_tauri_conf();
    let csp = conf
        .get("app")
        .and_then(|a| a.get("security"))
        .and_then(|s| s.get("csp"))
        .and_then(|c| c.as_str())
        .expect("csp manquante");

    // `http://127.0.0.1:*` est légitime (sidecar local-only). Tout autre http://
    // est interdit.
    for token in csp.split_whitespace() {
        if token.starts_with("http://") && !token.starts_with("http://127.0.0.1") {
            panic!("CSP contient un endpoint plaintext non-local: {}", token);
        }
    }
}
