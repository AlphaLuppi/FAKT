pub mod commands;
pub mod crypto;
mod pdf;
pub mod sidecar;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir: {}", e))?;
            let state =
                AppState::new(&app_data_dir).map_err(|e| format!("AppState: {}", e))?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_version,
            pdf::render::render_pdf,
            crypto::generate_cert,
            crypto::get_cert_info,
            crypto::rotate_cert,
            crypto::sign_document,
            commands::is_setup_completed,
            commands::complete_setup,
            commands::store_signed_pdf,
            commands::get_signed_pdf,
            commands::verify_signature,
            commands::open_email_draft,
            commands::open_mailto_fallback,
            commands::build_workspace_zip,
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application FAKT");
}
