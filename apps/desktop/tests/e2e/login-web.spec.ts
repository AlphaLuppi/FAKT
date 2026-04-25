import { expect, test } from "@playwright/test";

/**
 * Smoke E2E mode web (mode 2 self-host) — vérifie que la page de login
 * se charge correctement quand le bundle est servi en mode web pur (pas
 * de runtime Tauri).
 *
 * Le webServer Playwright (cf. playwright.config.ts) lance `bun run --cwd
 * apps/desktop dev` (mode tauri par défaut). En mode web, on devrait avoir
 * `dev:web`. Pour le moment ce test fonctionne aussi sur dev car la page
 * Login s'affiche dans les deux cas (RequireAuth redirige en mode remote).
 *
 * Pour le vrai test mode 2 (sans backend) : injection __FAKT_MODE__=2 +
 * nav vers /login.
 */

test.describe("FAKT Login (mode web)", () => {
  test("la page /login se charge avec champs email + password", async ({ page }) => {
    // Inject FAKT_MODE=2 (remote) AVANT le chargement de la page pour forcer
    // le mode remote → RequireAuth redirige vers /login.
    await page.addInitScript(() => {
      (window as unknown as { __FAKT_MODE__: number }).__FAKT_MODE__ = 2;
    });

    await page.goto("/login");

    // Le titre de l'app
    await expect(page).toHaveTitle(/FAKT/, { timeout: 10_000 });

    // Wrapper de la page login
    await expect(page.getByTestId("login")).toBeVisible({ timeout: 10_000 });

    // Champs du form
    await expect(page.getByTestId("login-email")).toBeVisible();
    await expect(page.getByTestId("login-password")).toBeVisible();

    // Bouton submit
    await expect(page.getByTestId("login-submit")).toBeVisible();
  });

  test("le form login est responsive sur mobile (375x812)", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __FAKT_MODE__: number }).__FAKT_MODE__ = 2;
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");

    // Pas d'overflow horizontal
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 5); // +5 pour scrollbar tolérance

    // La carte de login est visible et le form fonctionnel
    await expect(page.getByTestId("login-email")).toBeVisible();
  });
});
