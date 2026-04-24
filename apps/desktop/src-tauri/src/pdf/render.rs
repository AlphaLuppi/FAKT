//! Tauri command `render_pdf` — rend un devis ou une facture via Typst CLI.
//!
//! Flux :
//!   1. Le frontend appelle `invoke("render_pdf", { docType, dataJson })`.
//!   2. On écrit les templates embarqués (`include_str!`) dans un tempdir.
//!   3. On écrit `ctx.json` (le data_json) à côté de `quote.typ` / `invoice.typ`.
//!   4. On invoque `typst compile --input ctx-path=ctx.json <template> out.pdf`.
//!   5. On lit les bytes du PDF généré, on retourne Vec<u8>.
//!
//! Sécurité :
//!   - `Command::new` (pas de shell) → pas d'injection.
//!   - Le JSON passe par un fichier, pas par argv (évite tout overflow argv
//!     Windows ~8191 chars).
//!   - Le tempdir est automatiquement nettoyé via `tempfile::TempDir` Drop.
//!
//! Erreurs :
//!   - Binaire introuvable (NotFound) → message explicite en français.
//!   - Stderr Typst capturé et remonté tel quel à l'utilisateur (les
//!     messages du compilateur Typst sont informatifs : ligne + message).

use std::{
    path::PathBuf,
    process::Stdio,
};

use thiserror::Error;
use tokio::{io::AsyncWriteExt, process::Command};

// ─── Templates embarqués à compile-time ──────────────────────────────────────

// On embarque les templates pour que le binaire Tauri n'ait pas à résoudre de
// chemin disque (les chemins sont relatifs au crate, pas à l'installation).
const TPL_BASE: &str = include_str!(
    "../../../../../packages/pdf/templates/base.typ"
);
const TPL_QUOTE: &str = include_str!(
    "../../../../../packages/pdf/templates/quote.typ"
);
const TPL_INVOICE: &str = include_str!(
    "../../../../../packages/pdf/templates/invoice.typ"
);
const TPL_HEADER_WORKSPACE: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/header-workspace.typ"
);
const TPL_HEADER_CLIENT: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/header-client.typ"
);
const TPL_ITEMS_TABLE: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/items-table.typ"
);
const TPL_TOTALS: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/totals.typ"
);
const TPL_LEGAL_MENTIONS: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/legal-mentions.typ"
);
const TPL_SIGNATURE_BLOCK: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/signature-block.typ"
);
const TPL_QUOTE_LEGAL: &str = include_str!(
    "../../../../../packages/pdf/templates/partials/quote-legal.typ"
);

// Pour le fallback (mode sans Typst CLI), nous exposons un PDF stub minimal
// PDF 1.4 byte-parfait (1 page A4, même bytes à chaque call — déterministe).
// Activé uniquement si FAKT_PDF_STUB=1 — utile pour CI sans typst installé.
const STUB_PDF: &[u8] = include_bytes!("stub.pdf");

// ─── Erreurs typées ──────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum RenderError {
    #[error("Type de document invalide : {0} (attendu: quote ou invoice)")]
    InvalidDocType(String),

    #[error(
        "Typst CLI introuvable (chemin: {0}). Installez Typst : \
         https://github.com/typst/typst"
    )]
    BinaryNotFound(String),

    #[error("Erreur écriture fichier temporaire : {0}")]
    TempIo(String),

    #[error("Erreur compilation Typst : {0}")]
    TypstCompile(String),

    #[error("JSON de contexte invalide : {0}")]
    InvalidJson(String),
}

impl RenderError {
    /// Flatten en String pour le retour Tauri command (Result<_, String>).
    pub fn to_message(&self) -> String {
        self.to_string()
    }
}

// ─── Résolution binaire ──────────────────────────────────────────────────────

fn typst_binary() -> String {
    std::env::var("FAKT_TYPST_PATH").unwrap_or_else(|_| "typst".to_string())
}

fn use_stub() -> bool {
    matches!(std::env::var("FAKT_PDF_STUB"), Ok(v) if v == "1")
}

// ─── Tauri command ───────────────────────────────────────────────────────────

/// Rend un PDF à partir du type de document et du JSON de contexte sérialisé.
///
/// `doc_type` : "quote" ou "invoice".
/// `data_json` : la chaîne JSON (pas un objet) produite côté TS via
///               JSON.stringify(ctx).
///
/// Retourne les bytes bruts du PDF. En cas d'erreur, retourne un message FR
/// prêt à afficher dans un toast UI.
#[tauri::command]
pub async fn render_pdf(
    doc_type: String,
    data_json: String,
) -> Result<Vec<u8>, String> {
    render_pdf_internal(&doc_type, &data_json)
        .await
        .map_err(|e| e.to_message())
}

pub(crate) async fn render_pdf_internal(
    doc_type: &str,
    data_json: &str,
) -> Result<Vec<u8>, RenderError> {
    // Validate doc_type upfront.
    let main_tpl_content = match doc_type {
        "quote" => TPL_QUOTE,
        "invoice" => TPL_INVOICE,
        other => return Err(RenderError::InvalidDocType(other.to_string())),
    };

    // Validate JSON shape upfront — catches frontend bugs early, avoids
    // writing a corrupt ctx.json to disk.
    serde_json::from_str::<serde_json::Value>(data_json)
        .map_err(|e| RenderError::InvalidJson(e.to_string()))?;

    // Stub mode — retourne un PDF fixe (utile pour CI ou dev sans Typst).
    if use_stub() {
        return Ok(STUB_PDF.to_vec());
    }

    let tmp = tempfile::tempdir().map_err(|e| RenderError::TempIo(e.to_string()))?;
    let root = tmp.path();

    // Matérialise l'arborescence complète des templates.
    write_file(root.join("base.typ"), TPL_BASE).await?;
    let main_name = format!("{doc_type}.typ");
    write_file(root.join(&main_name), main_tpl_content).await?;

    let partials = root.join("partials");
    tokio::fs::create_dir_all(&partials)
        .await
        .map_err(|e| RenderError::TempIo(e.to_string()))?;
    write_file(partials.join("header-workspace.typ"), TPL_HEADER_WORKSPACE).await?;
    write_file(partials.join("header-client.typ"), TPL_HEADER_CLIENT).await?;
    write_file(partials.join("items-table.typ"), TPL_ITEMS_TABLE).await?;
    write_file(partials.join("totals.typ"), TPL_TOTALS).await?;
    write_file(partials.join("legal-mentions.typ"), TPL_LEGAL_MENTIONS).await?;
    write_file(partials.join("signature-block.typ"), TPL_SIGNATURE_BLOCK).await?;
    write_file(partials.join("quote-legal.typ"), TPL_QUOTE_LEGAL).await?;

    // Écrit le contexte.
    let ctx_path = root.join("ctx.json");
    write_file(&ctx_path, data_json).await?;

    // Chemin de sortie.
    let out_path = root.join("out.pdf");

    // Invoque la CLI Typst.
    let binary = typst_binary();
    let mut cmd = Command::new(&binary);
    cmd.arg("compile")
        .arg("--root")
        .arg(root)
        .arg("--input")
        .arg(format!("ctx-path={}", "ctx.json"))
        .arg(&main_name)
        .arg(&out_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(root);

    let output = cmd.output().await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            RenderError::BinaryNotFound(binary.clone())
        } else {
            RenderError::TypstCompile(format!("spawn: {e}"))
        }
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
        let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        let msg = if stderr.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            stderr.trim().to_string()
        };
        return Err(RenderError::TypstCompile(msg));
    }

    // Lit le PDF généré.
    let pdf_bytes = tokio::fs::read(&out_path)
        .await
        .map_err(|e| RenderError::TempIo(format!("lecture out.pdf: {e}")))?;

    // Sanity check — un PDF doit commencer par "%PDF-".
    if pdf_bytes.len() < 5 || &pdf_bytes[0..5] != b"%PDF-" {
        return Err(RenderError::TypstCompile(
            "Sortie Typst ne commence pas par %PDF-".to_string(),
        ));
    }

    Ok(pdf_bytes)
}

/// Version synchrone utilitaire — écrit via tokio fs.
async fn write_file<P: Into<PathBuf>>(
    path: P,
    content: &str,
) -> Result<(), RenderError> {
    let path = path.into();
    let mut f = tokio::fs::File::create(&path)
        .await
        .map_err(|e| RenderError::TempIo(format!("create {path:?}: {e}")))?;
    f.write_all(content.as_bytes())
        .await
        .map_err(|e| RenderError::TempIo(format!("write {path:?}: {e}")))?;
    f.flush()
        .await
        .map_err(|e| RenderError::TempIo(format!("flush {path:?}: {e}")))?;
    Ok(())
}

// ─── Tests unitaires ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Les tests qui touchent aux env vars doivent être sérialisés — sinon on
    // observe des races (ex: stub=1 d'un test contamine le test "binary
    // not found"). `cargo test` lance les unit tests en parallèle par
    // défaut.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn typst_binary_uses_env_override() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("FAKT_TYPST_PATH", "/mock/typst-stub");
        assert_eq!(typst_binary(), "/mock/typst-stub");
        std::env::remove_var("FAKT_TYPST_PATH");
    }

    #[test]
    fn typst_binary_defaults() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var("FAKT_TYPST_PATH");
        assert_eq!(typst_binary(), "typst");
    }

    #[tokio::test]
    async fn render_rejects_unknown_doc_type() {
        // Pas de dépendance env — OK en parallèle.
        let result = render_pdf_internal("foo", "{}").await;
        assert!(matches!(result, Err(RenderError::InvalidDocType(_))));
    }

    #[tokio::test]
    async fn render_rejects_invalid_json() {
        let result = render_pdf_internal("quote", "not{json").await;
        assert!(matches!(result, Err(RenderError::InvalidJson(_))));
    }

    #[tokio::test]
    async fn render_stub_mode_returns_bytes() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("FAKT_PDF_STUB", "1");
        let result = render_pdf_internal("quote", "{\"kind\":\"quote\"}").await;
        std::env::remove_var("FAKT_PDF_STUB");
        assert!(result.is_ok(), "stub mode should return bytes: {:?}", result);
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..5], b"%PDF-");
    }

    #[tokio::test]
    async fn render_reports_missing_binary() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var("FAKT_PDF_STUB");
        std::env::set_var("FAKT_TYPST_PATH", "/nonexistent/typst-xyz-abc");
        let result = render_pdf_internal("quote", "{\"kind\":\"quote\"}").await;
        std::env::remove_var("FAKT_TYPST_PATH");
        match result {
            Err(RenderError::BinaryNotFound(_)) => {}
            other => panic!("expected BinaryNotFound, got {other:?}"),
        }
    }
}
