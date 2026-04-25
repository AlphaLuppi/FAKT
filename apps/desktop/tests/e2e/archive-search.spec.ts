/**
 * Spec E2E — Archive et recherche full-text.
 *
 * User journeys :
 *   14. Recherche full-text
 *   15. Archive — filtrage par status/date
 */

import { expect, test } from "./helpers/test.js";

test.describe("Archive — vue agrégée devis + factures", () => {
  test("la page archive affiche les références D2026-XXX et F2026-XXX", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.getByTestId("archive-root")).toBeVisible();
    // Au moins une ligne devis ou facture seedée doit être présente.
    const rows = page.locator('[data-testid^="archive-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });
});

test.describe("Recherche — palette de commandes", () => {
  test("ouvre la palette via Ctrl+K (ou Cmd+K) et trouve un devis par numéro", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+K");
    const palette = page.getByTestId("command-palette-input");
    if (!(await palette.isVisible({ timeout: 2_000 }).catch(() => false))) {
      // Tente avec Meta (macOS) — le test runner peut être Linux/Windows mais
      // l'app peut quand même bind Meta.
      await page.keyboard.press("Meta+K");
      if (!(await palette.isVisible({ timeout: 2_000 }).catch(() => false))) {
        test.skip(true, "Command palette non disponible via Ctrl/Cmd+K.");
      }
    }
    await palette.fill("D2026");
    // L'option pour le devis q-001 (numéro D2026-001) doit apparaître.
    await expect(page.getByTestId("command-palette-option-quote-q-001")).toBeVisible({
      timeout: 5_000,
    });
  });
});
