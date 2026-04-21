/**
 * Export workspace ZIP — approche hybride JS+Rust.
 * Le JS génère les PDFs via renderPdf puis appelle build_workspace_zip avec les bytes.
 * Le Rust assemble le ZIP via la crate zip et retourne le chemin du fichier créé.
 */

use std::io::Write;
use std::path::PathBuf;

use chrono::Local;
use serde::Deserialize;
use zip::write::FileOptions;
use zip::ZipWriter;

#[derive(Deserialize)]
pub struct PdfEntry {
    pub name: String,
    pub bytes: Vec<u8>,
}

#[derive(Deserialize)]
pub struct BuildZipPayload {
    pub csv_clients: String,
    pub csv_prestations: String,
    pub pdfs_quotes: Vec<PdfEntry>,
    pub pdfs_invoices: Vec<PdfEntry>,
    pub readme: String,
    pub workspace_name: String,
}

#[tauri::command]
pub async fn build_workspace_zip(
    payload: BuildZipPayload,
    dest_path: String,
) -> Result<String, String> {
    let out_path = if dest_path.is_empty() {
        let timestamp = Local::now().format("%Y-%m-%d-%H%M%S");
        let filename = format!(
            "fakt-workspace-{}-{}.zip",
            sanitize_name(&payload.workspace_name),
            timestamp
        );
        std::env::temp_dir().join(filename)
    } else {
        PathBuf::from(&dest_path)
    };

    let file = std::fs::File::create(&out_path)
        .map_err(|e| format!("Impossible de créer le fichier ZIP : {}", e))?;

    let mut zip = ZipWriter::new(file);
    let options: FileOptions<()> = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("clients.csv", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(payload.csv_clients.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.start_file("prestations.csv", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(payload.csv_prestations.as_bytes())
        .map_err(|e| e.to_string())?;

    for entry in &payload.pdfs_quotes {
        let path = format!("quotes/{}", entry.name);
        zip.start_file(path, options).map_err(|e| e.to_string())?;
        zip.write_all(&entry.bytes).map_err(|e| e.to_string())?;
    }

    for entry in &payload.pdfs_invoices {
        let path = format!("invoices/{}", entry.name);
        zip.start_file(path, options).map_err(|e| e.to_string())?;
        zip.write_all(&entry.bytes).map_err(|e| e.to_string())?;
    }

    zip.start_file("README.txt", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(payload.readme.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;

    let abs_path = out_path
        .to_str()
        .ok_or("Chemin ZIP invalide")?
        .to_string();

    Ok(abs_path)
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}
