pub mod ai;
pub mod backend_config;
pub mod commands;
pub mod crypto;
mod pdf;
pub mod sidecar;
pub mod trace;
pub mod win_console;

use std::sync::Arc;

use backend_config::BackendConfig;
use commands::AppState;
use parking_lot::Mutex;
use sidecar::{
    initialization_script, initialization_script_remote, shutdown as sidecar_shutdown,
    spawn_api_server, ApiContext,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Entry point. Boucle complete : panic hook -> setup -> run loop. Aucun
/// `expect`/`unwrap` ne doit etre atteint sous `panic = "abort"` (release),
/// sinon crash silencieux 0xc0000409. On preferera toujours logger + exit code
/// non-zero au panic.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    trace::log("run() start");

    // Hook panic global -> ecrit dans le fichier de trace avant abort.
    // Sous panic=abort, ce hook est notre seule visibilite sur les crashes.
    std::panic::set_hook(Box::new(|info| {
        trace::log_panic(info);
    }));
    trace::log("panic hook installed");

    // Le catch_unwind ne capture rien sous panic=abort, mais c'est utile en
    // dev (panic=unwind) pour logger explicitement les retours de run_inner.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(run_inner));
    trace::log(&format!(
        "run_inner returned: panic={}",
        result.is_err()
    ));

    // Si run_inner retourne Err sans panic (cas Tauri Builder qui retourne
    // proprement), on exit non-zero pour signaler l'echec a l'OS.
    if matches!(result, Ok(Err(_)) | Err(_)) {
        std::process::exit(1);
    }
}

/// Wrapped pour pouvoir retourner Result et logger l'erreur sans `.expect()`.
/// Sous panic=abort, tout `.expect()` produit un crash silencieux 0xc0000409
/// non rattrapable — donc on convertit explicitement en `Result` + log.
fn run_inner() -> Result<(), String> {
    trace::log("run_inner start");

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Updater : desktop seulement. Le check() est explicitement
            // déclenché par le front (UpdaterContext) au mount du Shell, pas
            // ici, pour ne pas bloquer le boot sur un timeout réseau.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())
                .map_err(|e| format!("updater plugin: {}", e))?;
            trace::log("setup start");

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir: {}", e))?;
            // Promote le log vers app_data_dir/logs/ (persistant, pas %TEMP%).
            trace::promote_log_dir(&app_data_dir);
            trace::log(&format!("app_data_dir = {:?}", app_data_dir));

            let state =
                AppState::new(&app_data_dir).map_err(|e| format!("AppState: {}", e))?;
            trace::log("AppState ok");
            app.manage(state);

            // Lit le mode backend persisté (default = local sauf override compile-time).
            let backend_cfg = BackendConfig::load(&app_data_dir);
            trace::log(&format!("backend mode = {:?}", backend_cfg.mode));

            // Mode 2 (remote) : skip spawn sidecar, injecte URL distante + mode=2.
            let (init_js, api_ctx_for_cleanup): (String, Option<Arc<ApiContext>>) =
                if backend_cfg.is_remote() {
                    let url = backend_cfg
                        .remote_url()
                        .ok_or_else(|| "mode remote sans URL".to_string())?;
                    trace::log(&format!("remote backend → skip sidecar, url={}", url));
                    let placeholder_ctx = Arc::new(ApiContext {
                        port: 0,
                        token: String::new(),
                        child: Mutex::new(None),
                        crash_timestamps: Mutex::new(Vec::new()),
                    });
                    app.manage(Arc::clone(&placeholder_ctx));
                    (initialization_script_remote(url), None)
                } else {
                    let handle = app.handle().clone();
                    trace::log("calling spawn_api_server");
                    let api_ctx: Arc<ApiContext> = tauri::async_runtime::block_on(async move {
                        spawn_api_server(&handle).await
                    })
                    .map_err(|e| format!("spawn api-server: {}", e))?;
                    trace::log(&format!("spawn_api_server ok port={}", api_ctx.port));
                    let js = initialization_script(api_ctx.port, &api_ctx.token);
                    // Garder une copie de l'Arc avant manage() pour pouvoir kill le
                    // sidecar si la fenetre echoue a s'ouvrir (sinon zombie process).
                    let cleanup = Arc::clone(&api_ctx);
                    app.manage(api_ctx);
                    (js, Some(cleanup))
                };
            trace::log("calling WebviewWindowBuilder::build");

            let window_result = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("FAKT")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .resizable(true)
                .initialization_script(&init_js)
                .build();

            if let Err(e) = window_result {
                // Sidecar a deja ete spawne ; on doit le kill avant de
                // remonter l'erreur sinon le child process Bun reste zombie
                // avec son port pris (cf. P1-1 audit Rust).
                trace::log(&format!(
                    "window build FAILED, killing sidecar: {}",
                    e
                ));
                if let Some(ctx) = api_ctx_for_cleanup.as_ref() {
                    sidecar_shutdown(ctx);
                }
                return Err(format!("window build: {}", e).into());
            }
            trace::log("setup complete");
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
            commands::backend::get_backend_mode,
            commands::backend::set_backend_mode,
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
            commands::write_pdf_file,
            ai::cli::check_claude_cli,
            ai::cli::spawn_claude,
            ai::sessions::list_ai_sessions,
            ai::sessions::clear_ai_sessions_history,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        trace::log(&format!("tauri::Builder::run() FAILED: {}", e));
        return Err(format!("tauri run: {}", e));
    }
    trace::log("run_inner finished cleanly");
    Ok(())
}
