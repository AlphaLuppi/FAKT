/**
 * Smoke test E2E minimal — lance l'app Tauri et vérifie que la fenêtre
 * principale est disponible avec le bon titre.
 *
 * Dette v0.1.1 : couvrir le flow complet créer-devis → signer → draft-email
 * sur les 3 OS via tauri-driver. Ce smoke vérifie uniquement le démarrage.
 *
 * Prérequis CI :
 *   - `bun run build` doit avoir été exécuté (dist/ existant)
 *   - tauri-driver installé (devDep @tauri-apps/cli v2 + webdriver)
 *   - Linux : DISPLAY ou xvfb-run requis
 */

import { test, expect } from "@playwright/test";

// En l'absence de tauri-driver configuré, ce smoke valide que Playwright
// peut charger la page en mode devUrl (développement local).
// En CI avec tauri-driver, remplacer le `page.goto` par la connexion WebDriver.
test.describe("FAKT — smoke tests", () => {
  test("la page principale se charge et contient FAKT dans le titre", async ({
    page,
  }) => {
    // Mode développement : valider que le frontend React se charge correctement.
    // En CI tauri-driver, ce test sera remplacé par un vrai launch natif.
    await page.goto("http://localhost:1420");

    // Attendre que l'app soit prête (titre de la fenêtre ou heading visible)
    await expect(page).toHaveTitle(/FAKT/, { timeout: 10_000 });
  });

  test("la page charge sans erreurs JavaScript console critiques", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("http://localhost:1420");
    // Laisser 3s pour que les erreurs potentielles de montage React remontent
    await page.waitForTimeout(3_000);

    // Aucune erreur console critique — les warnings sont tolérés en v0.1
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("ResizeObserver") && // Non-critique, fréquent en dev
        !e.includes("favicon"), // Favicon manquant toléré
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
