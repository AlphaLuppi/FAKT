/**
 * Spec E2E — Catalogue de prestations / services.
 *
 * User journey :
 *   22. Services library — créer template, réutiliser dans devis
 */

import { expect, test } from "./helpers/test.js";

test.describe("Services — catalogue de prestations", () => {
  test("affiche les prestations seedées", async ({ page }) => {
    await page.goto("/services");
    await expect(page.locator("body")).toContainText(/Développement web/i);
    await expect(page.locator("body")).toContainText(/Audit technique/i);
  });

  test("créer un service → apparaît dans la liste", async ({ page, mockState }) => {
    await page.goto("/services");
    await page.getByTestId("service-list-new").click();
    await expect(page.getByTestId("service-form")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("service-form-name").fill("Coaching produit — heure");
    await page.getByTestId("service-form-description").fill("Séance d'1h");
    // Le prix est en euros côté UI ; le form le convertit en cents avant submit.
    await page.getByTestId("service-form-unit-price").fill("150");

    await page.getByTestId("service-form-submit").click();

    await expect
      .poll(() => mockState.services.length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(3);
  });
});
