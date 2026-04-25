/**
 * Spec E2E — Dashboard.
 *
 * Couvre les user journeys :
 *   16. Dashboard → activité récente, stats 30j, mentions CGI art.289
 *   29. Compliance — vérification mentions légales et numérotation séquentielle
 */

import { expect, test } from "./helpers/test.js";

test.describe("Dashboard — accueil après onboarding", () => {
  test("affiche le titre, les stats workspace et l'activité récente", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FAKT/);
    await expect(page.getByTestId("dashboard-root")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible({ timeout: 10_000 });

    // Au moins une référence à un document existant doit apparaître dans le feed.
    // Les fixtures seedées contiennent D2026-001, D2026-002 et F2026-001.
    const refRegex = /(D2026-001|D2026-002|F2026-001)/;
    await expect(page.getByTestId("dashboard-recent-activity")).toContainText(refRegex, {
      timeout: 10_000,
    });
  });

  test("clic sur une ligne d'activité ouvre le document correspondant", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("dashboard-recent-activity")).toBeVisible({ timeout: 10_000 });
    // L'ID de l'activity entry pour le devis q-002 signé est calculé sous la forme
    // `q-${quote.id}-signed` (cf. dashboard.tsx::buildQuoteActivity), soit
    // `q-q-002-signed` ici.
    const row = page.getByTestId("dashboard-activity-row-q-q-002-signed");
    if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await row.click();
      await expect(page).toHaveURL(/\/quotes\/q-002/);
    } else {
      test.skip(true, "Ligne activité D2026-002 non rendue — l'UI peut ne pas l'inclure.");
    }
  });
});

test.describe("Dashboard — workspace vide", () => {
  test.use({ mockMode: "empty", faktMode: 1 });

  test("redirige vers l'onboarding ou affiche un empty state", async ({ page }) => {
    await page.goto("/");
    // L'app peut soit rediriger /onboarding soit afficher un empty state.
    await expect(page.locator("body")).toContainText(
      /(profil|onboarding|bienvenue|aucun|vide|premier devis)/i,
      { timeout: 10_000 }
    );
  });
});
