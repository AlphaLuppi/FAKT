pub mod commands;
pub mod crypto;
mod pdf;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            commands::mark_quote_invoiced,
            commands::mark_invoice_sent,
            commands::update_invoice,
            commands::delete_invoice,
            commands::numbering_next_quote,
            commands::numbering_next_invoice,
            commands::get_signature_events,
            commands::append_signature_event,
            commands::store_signed_pdf,
            commands::get_signed_pdf,
            commands::verify_signature,
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application FAKT");
}
