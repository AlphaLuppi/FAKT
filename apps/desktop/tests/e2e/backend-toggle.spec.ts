import { test } from "@playwright/test";

/**
 * Tests E2E pour la bascule Settings Backend (local ↔ remote).
 *
 * **Statut : SKIPPÉS pour le MVP.** Nécessite l'app Tauri lancée (pas Vite seul)
 * pour tester les Tauri commands set_backend_mode/get_backend_mode + le
 * file persistence dans app_data_dir/backend.json. Activer avec
 * `FAKT_E2E_TAURI=1` et tauri-driver configuré.
 */

const E2E_WITH_TAURI = process.env.FAKT_E2E_TAURI === "1";

test.describe("Settings Backend toggle (local ↔ remote)", () => {
  test.skip(!E2E_WITH_TAURI, "Nécessite tauri-driver + app Tauri lancée");

  test("la modal Backend persiste le mode local", async ({ page: _page }) => {
    test.fail(); // À implémenter avec tauri-driver
  });

  test("bascule local → remote → ping /health → badge connecté", async ({ page: _page }) => {
    test.fail();
  });

  test("URL invalide → message d'erreur dans le tab Backend", async ({ page: _page }) => {
    test.fail();
  });
});
