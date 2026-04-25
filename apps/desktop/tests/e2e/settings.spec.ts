/**
 * Spec E2E — Settings (6 onglets).
 *
 * User journeys :
 *   17. Settings Identity — édition profil
 *   18. Settings Certificate — info cert
 *   19. Settings Backend — toggle mode 1 / mode 2
 *   20. Settings ClaudeCli
 */

import { expect, test } from "./helpers/test.js";

test.describe("Settings — navigation entre onglets", () => {
  test("l'onglet Identity affiche le SIRET du workspace seedé", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("settings-tab-identity").click();
    // Le SIRET est pré-rempli dans l'input identity-siret.
    await expect(page.getByTestId("settings-identity-siret")).toHaveValue(
      /73282932000074|732 829 320 00074/
    );
  });

  test("l'onglet Backend permet de voir le mode courant", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("settings-tab-backend").click();
    // En mode 1 (sidecar local), le radio "Local" doit être visible.
    await expect(page.getByTestId("settings-backend-mode-local")).toBeVisible({ timeout: 5_000 });
  });

  test("l'onglet Certificate affiche les infos du cert (ou un CTA pour en générer un)", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("settings-tab-certificate").click();
    // Soit un cert existe (testid `settings-certificate-rotate`), soit un CTA "Générer"
    // (testid `settings-certificate-generate`). On accepte les deux.
    const rotateBtn = page.getByTestId("settings-certificate-rotate");
    const generateBtn = page.getByTestId("settings-certificate-generate");
    const rotateVisible = await rotateBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const generateVisible = await generateBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(rotateVisible || generateVisible).toBe(true);
  });
});
