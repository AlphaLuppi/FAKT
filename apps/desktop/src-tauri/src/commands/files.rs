use std::fs;
use std::path::Path;

/// Ecrit des bytes arbitraires a un chemin absolu choisi par l'utilisateur via
/// le dialog save. Contourne le plugin-fs dont `write_file` exige une
/// permission `fs:allow-write-file` que nos capabilities n'expose pas par
/// defaut (et dont le scope oblige a re-declarer chaque racine).
///
/// Concus pour le telechargement PDF depuis Detail.tsx (devis + factures) :
/// le chemin vient du dialog natif, il est donc implicitement valide par l'OS.
#[tauri::command]
pub fn write_pdf_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    tracing::info!(
        target = "fakt::files",
        path = %path,
        bytes = bytes.len(),
        "write_pdf_file start"
    );

    if path.trim().is_empty() {
        tracing::error!(target = "fakt::files", "write_pdf_file: path vide");
        return Err("chemin de destination vide".to_string());
    }
    if bytes.is_empty() {
        tracing::error!(target = "fakt::files", "write_pdf_file: bytes vides");
        return Err("aucun contenu PDF a ecrire".to_string());
    }

    let target = Path::new(&path);

    // Cree le dossier parent si besoin (cas ou dialog natif retourne un chemin
    // dans un dossier Downloads non encore cree sur un fresh install Windows).
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                tracing::error!(
                    target = "fakt::files",
                    parent = %parent.display(),
                    error = %e,
                    "write_pdf_file: create_dir_all failed"
                );
                return Err(format!("impossible de creer le dossier parent: {}", e));
            }
        }
    }

    match fs::write(target, &bytes) {
        Ok(()) => {
            tracing::info!(
                target = "fakt::files",
                path = %path,
                bytes = bytes.len(),
                "write_pdf_file ok"
            );
            Ok(())
        }
        Err(e) => {
            tracing::error!(
                target = "fakt::files",
                path = %path,
                error = %e,
                "write_pdf_file: fs::write failed"
            );
            Err(format!("ecriture du PDF impossible: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::write_pdf_file;
    use std::fs;

    #[test]
    fn writes_bytes_to_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.pdf");
        let bytes = b"%PDF-1.4 hello\n".to_vec();
        write_pdf_file(path.to_string_lossy().to_string(), bytes.clone()).unwrap();
        let back = fs::read(&path).unwrap();
        assert_eq!(back, bytes);
    }

    #[test]
    fn rejects_empty_path() {
        let err = write_pdf_file(String::new(), vec![1, 2, 3]).unwrap_err();
        assert!(err.contains("vide"));
    }

    #[test]
    fn rejects_empty_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("out.pdf");
        let err = write_pdf_file(path.to_string_lossy().to_string(), vec![]).unwrap_err();
        assert!(err.contains("aucun"));
    }

    #[test]
    fn creates_missing_parent_dir() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("subdir/out.pdf");
        write_pdf_file(path.to_string_lossy().to_string(), vec![0x25, 0x50]).unwrap();
        assert!(path.exists());
    }
}
