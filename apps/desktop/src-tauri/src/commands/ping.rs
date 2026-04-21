/// Commande de santé — vérifie que l'IPC Tauri fonctionne.
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}

/// Retourne la version de l'application.
#[tauri::command]
pub fn get_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
