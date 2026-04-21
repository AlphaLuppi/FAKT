mod commands;
pub mod crypto;
mod pdf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_version,
            pdf::render::render_pdf,
            crypto::generate_cert,
            crypto::get_cert_info,
            crypto::rotate_cert,
            crypto::sign_document,
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application FAKT");
}
