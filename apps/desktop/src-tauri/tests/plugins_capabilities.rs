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

fn capabilities_path() -> PathBuf {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    PathBuf::from(manifest_dir).join("capabilities").join("default.json")
}

fn load_capabilities() -> serde_json::Value {
    let raw = std::fs::read_to_string(capabilities_path())
        .expect("capabilities/default.json doit exister");
    serde_json::from_str(&raw).expect("capabilities/default.json doit être un JSON valide")
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
