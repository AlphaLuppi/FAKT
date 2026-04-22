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
        // `cmd /C start "" "<path>"` — on passe le path entre guillemets.
        // Le 2e argument vide est le *titre* de la fenêtre : sans ça, `start`
        // interprète le 1er guillemet comme le titre et n'ouvre pas le fichier
        // si le path contient des espaces (FR usernames `Jean Dupont`, etc.).
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

/// Formate un chemin pour `cmd /C start`. Si le chemin contient espace,
/// guillemet, point-virgule, esperluette ou accent circonflexe, on l'entoure
/// de guillemets et on double les guillemets internes.
///
/// Utilisé par les tests unitaires qui vérifient le comportement pour les
/// usernames FR (`C:\Users\Jean Dupont\...`).
#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn quote_cmd_arg(path: &str) -> String {
    let needs_quoting = path
        .chars()
        .any(|c| c == ' ' || c == '"' || c == ';' || c == '&' || c == '^');
    if needs_quoting {
        let escaped = path.replace('"', "\"\"");
        format!("\"{}\"", escaped)
    } else {
        path.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::quote_cmd_arg;

    #[test]
    fn path_without_space_is_unchanged() {
        assert_eq!(quote_cmd_arg("C:\\fakt\\draft.eml"), "C:\\fakt\\draft.eml");
    }

    #[test]
    fn path_with_space_is_quoted() {
        assert_eq!(
            quote_cmd_arg("C:\\Users\\Jean Dupont\\fakt-drafts\\m.eml"),
            "\"C:\\Users\\Jean Dupont\\fakt-drafts\\m.eml\""
        );
    }

    #[test]
    fn mailto_url_is_preserved_unquoted() {
        assert_eq!(
            quote_cmd_arg("mailto:client@example.com?subject=Devis"),
            "mailto:client@example.com?subject=Devis"
        );
    }

    #[test]
    fn path_with_embedded_quote_is_escaped() {
        assert_eq!(quote_cmd_arg("C:\\a\"b.eml"), "\"C:\\a\"\"b.eml\"");
    }

    #[test]
    fn path_with_ampersand_is_quoted() {
        assert_eq!(
            quote_cmd_arg("C:\\Users\\A & B\\m.eml"),
            "\"C:\\Users\\A & B\\m.eml\""
        );
    }
}
