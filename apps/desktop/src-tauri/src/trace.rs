//! Traceur d'exécution persistant pour diagnostiquer les crashes silencieux
//! sous `windows_subsystem = "windows"` où stderr est avalé.
//!
//! Écrit dans `app_data_dir/logs/fakt-trace.log` quand on a un `AppHandle`,
//! sinon fallback dans `%TEMP%/fakt-trace.log` (utile pour les panics très
//! tôt dans `run()` avant que Tauri n'ait ouvert son path resolver).
//!
//! Tous les helpers sont `infallible` — un I/O error est silencieusement
//! ignoré pour ne jamais propager un problème de log en panic runtime.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;

/// Path du fichier log une fois résolu via `AppHandle`. None → fallback %TEMP%.
static LOG_PATH: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

fn lock() -> &'static Mutex<Option<PathBuf>> {
    LOG_PATH.get_or_init(|| Mutex::new(None))
}

/// Fallback early : %TEMP%/fakt-trace.log. Utilisé avant que le path resolver
/// Tauri ne soit dispo (ex : panic hook à l'extérieur du setup).
fn fallback_path() -> PathBuf {
    std::env::temp_dir().join("fakt-trace.log")
}

/// Chemin effectif du log : soit le `app_data_dir/logs` promu, soit %TEMP%.
fn current_path() -> PathBuf {
    lock().lock().clone().unwrap_or_else(fallback_path)
}

/// Appelé une fois dans `setup()` quand on a accès au `AppHandle`.
/// Bascule les futurs logs vers `app_data_dir/logs/fakt-trace.log` et
/// crée le dossier si besoin. Idempotent.
pub fn promote_log_dir(app_data_dir: &Path) {
    let logs_dir = app_data_dir.join("logs");
    let _ = std::fs::create_dir_all(&logs_dir);
    let target = logs_dir.join("fakt-trace.log");
    *lock().lock() = Some(target);
}

/// Écrit une ligne `[ts_ms] stage` dans le fichier log courant.
/// Infallible : erreurs I/O ignorées.
pub fn log(stage: &str) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let msg = format!("[{}ms] {}\n", ts, stage);
    write_line(&msg);
}

/// Écrit un panic info (avec backtrace) dans le fichier log courant.
pub fn log_panic(info: &std::panic::PanicHookInfo<'_>) {
    let backtrace = std::backtrace::Backtrace::force_capture();
    let msg = format!(
        "PANIC: {}\nLocation: {:?}\nBacktrace:\n{}\n---\n",
        info,
        info.location(),
        backtrace
    );
    write_line(&msg);
}

fn write_line(msg: &str) {
    let path = current_path();
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .and_then(|mut f| f.write_all(msg.as_bytes()));
}
