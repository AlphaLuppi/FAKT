use std::path::Path;
use std::process::Command;

/// Ouvre un fichier `.eml` avec l'application système.
///
/// Sécurité (P1-3 audit Rust 2026-04-23) :
/// - vérifie l'extension `.eml` (case-insensitive)
/// - canonicalise le chemin (résout les symlinks) AVANT de vérifier l'extension
///   pour éviter qu'un symlink `evil.eml -> /etc/passwd` soit ouvert
/// - le chemin canonicalisé doit lui-même se terminer par `.eml`
#[tauri::command]
pub async fn open_email_draft(eml_path: String) -> Result<(), String> {
    let path = Path::new(&eml_path);
    if !path.exists() {
        return Err(format!("Fichier .eml introuvable : {}", eml_path));
    }

    // Canonicalise pour résoudre les symlinks. Si le chemin pointe vers
    // /etc/passwd via symlink, canonical sera /etc/passwd et la vérif
    // d'extension échouera.
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Chemin .eml invalide : {}", e))?;

    let ext_ok = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("eml"))
        == Some(true);
    if !ext_ok {
        return Err(
            "Le chemin doit pointer vers un fichier .eml (symlinks résolus)".to_string(),
        );
    }

    let canonical_str = canonical
        .to_str()
        .ok_or_else(|| "Chemin .eml non-UTF8".to_string())?;
    dispatch_open(canonical_str)
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
        // P0 security fix : ne JAMAIS utiliser `cmd /C start` — cmd.exe interprète
        // `& | < > ^` même avec `start`, ce qui permettait `file.eml & calc.exe`.
        // `rundll32 url.dll,FileProtocolHandler <target>` passe le target comme
        // argument unique à rundll32 (pas de shell parsing), puis url.dll l'ouvre
        // via ShellExecute comme le ferait un double-clic Explorer.
        let mut cmd = Command::new("rundll32");
        cmd.args(["url.dll,FileProtocolHandler", target]);
        crate::win_console::silence_std(&mut cmd);
        cmd.spawn()
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

    // NOTE : `quote_cmd_arg` n'est plus utilisée en prod — `dispatch_open` sous
    // Windows passe désormais par `rundll32 url.dll,FileProtocolHandler <target>`
    // qui ne fait aucun shell parsing (fix P0 security command injection).
    // Les tests restent pour documenter l'ancien comportement de référence au
    // cas où un fallback shell devrait être réintroduit — ils ne garantissent
    // PAS la sécurité du chemin de prod.

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

    /// P0 security — `open_mailto_fallback` doit rejeter les URL ne commençant
    /// pas par `mailto:`. Ce contrat reste invariant du choix de dispatcher
    /// (cmd vs rundll32).
    #[tokio::test]
    async fn open_mailto_fallback_rejects_non_mailto() {
        let res = super::open_mailto_fallback("http://evil.example/".into()).await;
        assert!(res.is_err());
    }

    /// P0 security — `open_email_draft` doit rejeter un path inexistant même
    /// avec extension `.eml` valide. Le chemin est ensuite passé à rundll32 sans
    /// shell parsing.
    #[tokio::test]
    async fn open_email_draft_rejects_missing_file() {
        let res =
            super::open_email_draft("C:\\nonexistent-fakt-draft-12345.eml".into()).await;
        assert!(res.is_err());
    }
}
