//! Commande Tauri exposant `compute_pdf_text_hash`.
//!
//! Appelée :
//!   - À l'émission d'un devis pour calculer + persister le hash texte du
//!     PDF officiel via le sidecar (`POST /api/quotes/:id/original-text-hash`).
//!   - À l'import retour signé pour comparer le hash du PDF reçu à celui
//!     stocké à l'émission. Si différent, l'utilisateur peut forcer mais
//!     l'écart est consigné dans l'audit trail.

use crate::pdf::text_hash::compute_pdf_text_hash as compute_inner;

/// Calcule le SHA-256 hex du texte normalisé d'un PDF.
///
/// Le frontend appelle `invoke<string>("compute_pdf_text_hash", { pdfBytes })`.
/// Retour : `Ok(hex 64 chars)` ou `Err(message FR)` si extraction texte échoue.
#[tauri::command]
pub fn compute_pdf_text_hash(pdf_bytes: Vec<u8>) -> Result<String, String> {
    if pdf_bytes.is_empty() {
        return Err("PDF vide".into());
    }
    compute_inner(&pdf_bytes).map_err(|e| e.to_string())
}
