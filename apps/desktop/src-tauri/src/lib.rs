pub mod ai;
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
    // Panic hook + traceur d'execution dans %TEMP%/fakt-trace.log.
    // Indispensable sous windows_subsystem="windows" ou stderr est avale.
    fn trace(stage: &str) {
        let path = std::env::temp_dir().join("fakt-trace.log");
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let msg = format!("[{}ms] {}\n", ts, stage);
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .and_then(|mut f| std::io::Write::write_all(&mut f, msg.as_bytes()));
    }
    trace("run() start");

    std::panic::set_hook(Box::new(|info| {
        let path = std::env::temp_dir().join("fakt-trace.log");
        let backtrace = std::backtrace::Backtrace::force_capture();
        let msg = format!(
            "PANIC: {}\nLocation: {:?}\nBacktrace:\n{}\n---\n",
            info,
            info.location(),
            backtrace
        );
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .and_then(|mut f| std::io::Write::write_all(&mut f, msg.as_bytes()));
    }));
    trace("panic hook installed");

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        run_inner();
    }));
    trace(&format!("run_inner returned: panic={}", result.is_err()));
}

fn run_inner() {
    let trace = |stage: &str| {
        let path = std::env::temp_dir().join("fakt-trace.log");
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let msg = format!("[{}ms] inner: {}\n", ts, stage);
        let _ = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .and_then(|mut f| std::io::Write::write_all(&mut f, msg.as_bytes()));
    };
    trace("run_inner start");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let trace = |stage: &str| {
                let path = std::env::temp_dir().join("fakt-trace.log");
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0);
                let msg = format!("[{}ms] setup: {}\n", ts, stage);
                let _ = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&path)
                    .and_then(|mut f| std::io::Write::write_all(&mut f, msg.as_bytes()));
            };
            trace("setup start");

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir: {}", e))?;
            trace(&format!("app_data_dir = {:?}", app_data_dir));

            let state =
                AppState::new(&app_data_dir).map_err(|e| format!("AppState: {}", e))?;
            trace("AppState ok");
            app.manage(state);

            let handle = app.handle().clone();
            trace("calling spawn_api_server");
            let api_ctx: Arc<ApiContext> =
                tauri::async_runtime::block_on(async move { spawn_api_server(&handle).await })
                    .map_err(|e| format!("spawn api-server: {}", e))?;
            trace(&format!("spawn_api_server ok port={}", api_ctx.port));

            let init_js = initialization_script(api_ctx.port, &api_ctx.token);
            app.manage(api_ctx);
            trace("calling WebviewWindowBuilder::build");

            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("FAKT")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .resizable(true)
                .initialization_script(&init_js)
                .build()
                .map_err(|e| format!("window build: {}", e))?;
            trace("setup complete");

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
            ai::cli::check_claude_cli,
            ai::cli::spawn_claude,
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application FAKT");
}
