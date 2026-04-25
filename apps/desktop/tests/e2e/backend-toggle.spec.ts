import { test } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

/**
 * Tests E2E pour la bascule Settings Backend (local ↔ remote).
 *
 * **Statut : SKIPPÉS pour le MVP.** Nécessite l'app Tauri lancée (pas Vite seul)
 * pour tester les Tauri commands set_backend_mode/get_backend_mode + le
 * file persistence dans app_data_dir/backend.json. Activer avec
 * `FAKT_E2E_TAURI=1` et tauri-driver configuré.
 *
 * Selectors : `settings-backend-*` testids stables, garantis par
 * `apps/desktop/src/routes/settings/tabs/BackendTab.tsx`. Le scénario réel
 * est encore en `test.fail()` mais les squelettes ci-dessous montrent les
 * testids à utiliser au moment du dé-skip.
 */

const E2E_WITH_TAURI = process.env.FAKT_E2E_TAURI === "1";

test.describe("Settings Backend toggle (local ↔ remote)", () => {
  test.skip(!E2E_WITH_TAURI, "Nécessite tauri-driver + app Tauri lancée");

  test("la modal Backend persiste le mode local", async ({ page }) => {
    await page.goto("/settings");
    // Cible : page.getByTestId("settings-backend-mode-local") puis submit.
    void page; // évite le lint unused tant que la suite est test.fail()
    test.fail(); // À implémenter avec tauri-driver
  });

  test("bascule local → remote → ping /health → badge connecté", async ({ page }) => {
    await page.goto("/settings");
    // Cible : settings-backend-mode-remote → settings-backend-url.fill(...)
    // → settings-backend-submit → assertion sur le badge connecté.
    void page;
    test.fail();
  });

  test("URL invalide → message d'erreur dans le tab Backend", async ({ page }) => {
    await page.goto("/settings");
    // Cible : settings-backend-mode-remote → fill URL invalide →
    // settings-backend-submit → assertion sur le message d'erreur.
    void page;
    test.fail();
  });
});
