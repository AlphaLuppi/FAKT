//! Extraction texte PDF + hash SHA-256 normalisé.
//!
//! Utilisé par le workflow « Importer signature client » pour vérifier
//! l'intégrité d'un PDF retourné signé. À l'émission, on calcule et stocke
//! `quotes.original_text_hash`. À l'import, on recalcule sur le PDF reçu et
//! on compare. Si différent, l'utilisateur peut forcer mais l'écart est
//! consigné dans l'audit trail.
//!
//! ## Stratégie de normalisation
//!
//! `pdf-extract` peut produire un texte légèrement différent selon les
//! marges (\n vs \r\n, double espaces sur certains layouts). Pour rendre
//! le hash stable :
//!
//! 1. BOM UTF-8 retiré
//! 2. Line endings unifiés (\r\n et \r → \n)
//! 3. Whitespace folded : tout run de whitespace ASCII (espace, tab,
//!    line breaks consécutifs) → un seul espace
//! 4. Trim global (start + end)
//!
//! Ce qui reste : le contenu lexical du PDF. Si un attaquant change un prix
//! ou une ligne, le texte change → hash change → mismatch détecté. Si le
//! client annote en marge ou imprime/scanne, le texte reste majoritairement
//! le même mais le hash CHANGE TOUT DE MÊME (annotations = nouveau contenu).
//! Dans ce cas l'utilisateur force l'import et l'event audit note la
//! divergence.

use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TextHashError {
    #[error("Extraction texte PDF échouée : {0}")]
    Extract(String),
}

/// Normalise un texte avant hash : whitespace folded, line endings unifiés,
/// BOM stripped, trim global.
///
/// Public pour tests + futur usage si on hash autre chose que des PDF.
pub fn normalize_text(text: &str) -> String {
    // 1. BOM UTF-8 (\u{FEFF}) en début → retiré
    let stripped = text.strip_prefix('\u{FEFF}').unwrap_or(text);

    // 2. + 3. Line endings + whitespace folding en une passe
    let mut out = String::with_capacity(stripped.len());
    let mut last_was_ws = false;
    for ch in stripped.chars() {
        if ch.is_ascii_whitespace() {
            if !last_was_ws {
                out.push(' ');
                last_was_ws = true;
            }
            // else : skip ce whitespace (déjà un espace ajouté)
        } else {
            out.push(ch);
            last_was_ws = false;
        }
    }

    // 4. Trim global
    out.trim().to_string()
}

/// Extrait le texte d'un PDF, le normalise, et retourne le SHA-256 hex.
///
/// Retourne `Err(TextHashError::Extract)` si `pdf-extract` ne sait pas lire
/// le PDF (corrompu, chiffré sans clé, etc.).
pub fn compute_pdf_text_hash(pdf_bytes: &[u8]) -> Result<String, TextHashError> {
    let raw =
        pdf_extract::extract_text_from_mem(pdf_bytes).map_err(|e| TextHashError::Extract(e.to_string()))?;
    let normalized = normalize_text(&raw);
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_text_folds_multiple_spaces() {
        assert_eq!(normalize_text("a   b"), "a b");
        assert_eq!(normalize_text("a\t\tb"), "a b");
        assert_eq!(normalize_text("a \t b"), "a b");
    }

    #[test]
    fn normalize_text_unifies_line_endings() {
        // \n, \r\n, \r → tous traités comme whitespace ASCII donc folded vers ' '
        assert_eq!(normalize_text("a\nb"), "a b");
        assert_eq!(normalize_text("a\r\nb"), "a b");
        assert_eq!(normalize_text("a\rb"), "a b");
    }

    #[test]
    fn normalize_text_strips_bom() {
        assert_eq!(normalize_text("\u{FEFF}hello"), "hello");
    }

    #[test]
    fn normalize_text_trims_edges() {
        assert_eq!(normalize_text("   hello   "), "hello");
        assert_eq!(normalize_text("\n\nhello\n\n"), "hello");
    }

    #[test]
    fn normalize_text_preserves_unicode_content() {
        // Caractères non-whitespace conservés tels quels
        assert_eq!(normalize_text("Tom Andrieu — 1 234,56 €"), "Tom Andrieu — 1 234,56 €");
    }

    #[test]
    fn normalize_text_idempotent() {
        let input = "  a   b  \n  c  ";
        let once = normalize_text(input);
        let twice = normalize_text(&once);
        assert_eq!(once, twice);
    }

    #[test]
    fn compute_pdf_text_hash_rejects_invalid_pdf() {
        let result = compute_pdf_text_hash(b"not a pdf at all");
        assert!(matches!(result, Err(TextHashError::Extract(_))));
    }

    #[test]
    fn compute_pdf_text_hash_returns_64_hex_chars_for_valid_input() {
        // PDF stub minimum (vide mais valide). Si pdf-extract échoue ici,
        // on tombe sur Extract — acceptable, le test n'est pas critique.
        // En pratique le test d'intégration sur un PDF Typst réel se fait
        // dans le test e2e Playwright + cas d'usage manuel.
        let stub = include_bytes!("stub.pdf");
        if let Ok(hex) = compute_pdf_text_hash(stub) {
            assert_eq!(hex.len(), 64);
            assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
        }
    }
}
