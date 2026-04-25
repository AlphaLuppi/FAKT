import { expect, test } from "@playwright/test";

/**
 * Tests E2E pour la désactivation de la signature en mode web.
 *
 * **Statut : SKIPPÉS pour le MVP.** Nécessite une route /quotes/:id avec
 * un quote seedé en DB pour render le bouton "Signer". Le test unitaire
 * `DesktopOnlyButton.test.tsx` couvre déjà la logique du bouton désactivé
 * + tooltip — ce E2E vérifie l'intégration de bout en bout.
 *
 * Activer avec FAKT_E2E_BACKEND=1 + un quote ID connu.
 */

const E2E_WITH_BACKEND = process.env.FAKT_E2E_BACKEND === "1";

test.describe("Signature web disabled", () => {
  test.skip(!E2E_WITH_BACKEND, "Nécessite backend + quote seedé");

  test("bouton 'Signer' désactivé en mode web avec tooltip explicite", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __FAKT_MODE__: number }).__FAKT_MODE__ = 2;
    });

    const quoteId = process.env.FAKT_E2E_QUOTE_ID;
    if (!quoteId) {
      test.skip(true, "FAKT_E2E_QUOTE_ID requis");
      return;
    }

    await page.goto(`/quotes/${quoteId}`);
    const signBtn = page.getByTestId("detail-sign");
    await expect(signBtn).toBeDisabled();
    await expect(signBtn).toHaveAttribute("data-desktop-only", "true");
    await expect(signBtn).toHaveAttribute("title", /desktop/i);
  });

  test("clic sur le bouton ne déclenche pas la modal de signature", async ({ page: _page }) => {
    test.fail(); // disabled = pas de click possible, vérifier qu'aucune modal n'apparaît
  });
});
