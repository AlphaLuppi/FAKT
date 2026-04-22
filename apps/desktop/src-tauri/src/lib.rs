pub mod commands;
pub mod crypto;
mod pdf;
pub mod sidecar;

use std::sync::Arc;

use commands::AppState;
use sidecar::{
    initialization_script, shutdown as sidecar_shutdown, spawn_api_server, ApiContext,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

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

            let handle = app.handle().clone();
            let api_ctx: Arc<ApiContext> =
                tauri::async_runtime::block_on(async move { spawn_api_server(&handle).await })
                    .map_err(|e| format!("spawn api-server: {}", e))?;

            let init_js = initialization_script(api_ctx.port, &api_ctx.token);
            app.manage(api_ctx);

            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("FAKT")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .resizable(true)
                .initialization_script(&init_js)
                .build()
                .map_err(|e| format!("window build: {}", e))?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                if let Some(ctx) = window.app_handle().try_state::<Arc<ApiContext>>() {
                    sidecar_shutdown(ctx.inner());
                }
            }
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
