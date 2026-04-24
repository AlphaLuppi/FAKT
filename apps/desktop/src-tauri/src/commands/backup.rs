/**
 * Export workspace ZIP — approche hybride JS+Rust.
 * Le JS génère les PDFs via renderPdf puis appelle build_workspace_zip avec les bytes.
 * Le Rust assemble le ZIP via la crate zip et retourne le chemin du fichier créé.
 *
 * Sécurité (P1-2 audit Rust 2026-04-23) :
 * - `dest_path` doit avoir une extension `.zip` et un parent existant.
 * - `entry.name` est sanitisé pour empêcher la traversée de chemin (Zip Slip)
 *   à l'extraction par un archiveur naïf (Windows Explorer, macOS Archive Utility).
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

/// Sanitize une entrée pour ZIP : retire les `..`, `/`, `\`, drive letters,
/// ne garde qu'un nom de fichier sûr. Empêche le pattern Zip Slip à
/// l'extraction.
fn sanitize_zip_entry(name: &str) -> String {
    // Normalise d'abord les séparateurs Windows : `std::path::Path` sur Unix
    // ne reconnaît pas `\` comme séparateur, donc "C:\\evil.bin" resterait
    // intact et le `:` serait juste remplacé plus bas, laissant "C--evil.bin".
    let normalized = name.replace('\\', "/");
    // Garde le basename uniquement (jamais de chemin parent).
    let basename = std::path::Path::new(&normalized)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled");
    // Retire les caractères non-portables (drive letters Windows, devices).
    basename
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect::<String>()
        .trim_matches('.')
        .to_string()
}

/// Valide qu'un `dest_path` est acceptable pour écrire le ZIP : extension
/// `.zip`, parent existant et accessible. N'autorise PAS d'écrire dans des
/// chemins systèmes obvious (Windows : `C:\Windows`, `C:\Program Files`).
fn validate_dest_path(dest_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(dest_path);

    if path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("zip"))
        != Some(true)
    {
        return Err("dest_path doit avoir une extension .zip".to_string());
    }

    let parent = path
        .parent()
        .ok_or_else(|| "dest_path doit avoir un dossier parent".to_string())?;

    if !parent.is_dir() {
        return Err(format!(
            "dossier parent introuvable : {}",
            parent.display()
        ));
    }

    // Bloque les chemins systèmes Windows obvious.
    let parent_str = parent.to_string_lossy().to_lowercase();
    let blocked_prefixes = [
        "c:\\windows",
        "c:\\program files",
        "c:\\program files (x86)",
        "c:\\programdata",
        "/etc",
        "/usr",
        "/bin",
        "/sbin",
        "/system",
    ];
    for blocked in blocked_prefixes {
        if parent_str.starts_with(blocked) {
            return Err(format!(
                "écriture interdite dans un dossier système : {}",
                parent.display()
            ));
        }
    }

    Ok(path)
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
        validate_dest_path(&dest_path)?
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
        let safe_name = sanitize_zip_entry(&entry.name);
        let path = format!("quotes/{}", safe_name);
        zip.start_file(path, options).map_err(|e| e.to_string())?;
        zip.write_all(&entry.bytes).map_err(|e| e.to_string())?;
    }

    for entry in &payload.pdfs_invoices {
        let safe_name = sanitize_zip_entry(&entry.name);
        let path = format!("invoices/{}", safe_name);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_zip_entry_strips_path_traversal() {
        assert_eq!(sanitize_zip_entry("../../etc/passwd"), "passwd");
        assert_eq!(sanitize_zip_entry("../evil.bin"), "evil.bin");
        assert_eq!(sanitize_zip_entry("normal.pdf"), "normal.pdf");
        assert_eq!(sanitize_zip_entry("../../../../etc"), "etc");
    }

    #[test]
    fn sanitize_zip_entry_strips_windows_devices() {
        // Windows refuse "CON", "PRN", etc — on garde mais on ne crée PAS un
        // path absolu. Caractères device drive letters retirés.
        assert_eq!(sanitize_zip_entry("C:\\evil.bin"), "evil.bin");
        let s = sanitize_zip_entry("file<with|bad?chars*.pdf");
        assert!(!s.contains('<'));
        assert!(!s.contains('|'));
        assert!(!s.contains('?'));
        assert!(!s.contains('*'));
    }

    #[test]
    fn sanitize_zip_entry_handles_empty_or_dots() {
        assert_eq!(sanitize_zip_entry(""), "untitled");
        // ".." → file_name() retourne None → fallback "untitled"
        assert_eq!(sanitize_zip_entry(".."), "untitled");
    }

    #[test]
    fn validate_dest_path_requires_zip_extension() {
        let r = validate_dest_path("/tmp/file.txt");
        assert!(r.is_err());
        assert!(r.unwrap_err().contains(".zip"));
    }

    #[test]
    fn validate_dest_path_blocks_system_dirs() {
        let r = validate_dest_path("C:\\Windows\\fakt.zip");
        assert!(r.is_err(), "should block C:\\Windows");
    }
}

