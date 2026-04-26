//! Préparation de l'installation d'un update — kill explicite du sidecar
//! avant que NSIS écrase `fakt-api.exe` côté Windows.
//!
//! Sans cet appel, `update.install()` du plugin Tauri lance NSIS qui tente
//! d'écrire le binaire pendant que le sidecar Bun le tient ouvert : Windows
//! refuse l'écriture (`Error opening file for writing`) et bloque l'install
//! avec une dialog Abandonner/Recommencer/Ignorer pour l'utilisateur.
//!
//! La sleep finale (~1.2s) laisse à Windows le temps de libérer effectivement
//! les file handles après `TerminateProcess`. C'est un compromis empirique :
//! pas de wait API exposée par tauri-plugin-shell, et pas de logique
//! cross-platform robuste pour vérifier qu'un PID est bien terminé.

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::sidecar::{ApiContext, shutdown};

/// Délai après `child.kill()` avant de rendre la main au front, qui va alors
/// déclencher `update.install()`. Empirique : 1500ms couvre les cas où le
/// process Bun met du temps à libérer ses file handles sous Windows. Sur
/// macOS/Linux le sidecar est déjà mort instantanément, le sleep est inutile
/// mais inoffensif (~1s d'attente pour redémarrer une app, l'utilisateur ne
/// le perçoit pas vs le download précédent).
const FILE_HANDLE_RELEASE_DELAY: Duration = Duration::from_millis(1500);

/// Tue proprement le sidecar et attend que les file handles soient libérés.
/// Appelée par le front juste avant `update.install()` quand l'utilisateur
/// clique sur « Redémarrer maintenant » dans la bannière.
///
/// Noop en mode remote (pas de sidecar) ou si le child a déjà été pris par
/// un précédent shutdown.
#[tauri::command]
pub async fn prepare_for_install(app: AppHandle) -> Result<(), String> {
    if let Some(ctx) = app.try_state::<Arc<ApiContext>>() {
        shutdown(ctx.inner());
    }
    tokio::time::sleep(FILE_HANDLE_RELEASE_DELAY).await;
    Ok(())
}
