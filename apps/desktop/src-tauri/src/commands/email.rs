use std::path::Path;
use std::process::Command;

#[tauri::command]
pub async fn open_email_draft(eml_path: String) -> Result<(), String> {
    let path = Path::new(&eml_path);
    if !path.exists() {
        return Err(format!("Fichier .eml introuvable : {}", eml_path));
    }
    if path.extension().and_then(|e| e.to_str()) != Some("eml") {
        return Err("Le chemin doit pointer vers un fichier .eml".to_string());
    }

    dispatch_open(&eml_path)
}

#[tauri::command]
pub async fn open_mailto_fallback(url: String) -> Result<(), String> {
    if !url.starts_with("mailto:") {
        return Err("URL invalide : doit commencer par mailto:".to_string());
    }
    dispatch_open(&url)
}

fn dispatch_open(target: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", target])
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir : {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir : {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir : {}", e))?;
    }

    Ok(())
}
