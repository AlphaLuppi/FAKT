/**
 * Spec E2E — Wizard onboarding 4 étapes.
 *
 * User journey :
 *   01. Setup wizard : Identity → Claude CLI → Certificate → Recap → finish
 */

import { fillIdentityStep } from "./helpers/actions.js";
import { expect, test } from "./helpers/test.js";

test.describe("Onboarding — wizard 4 étapes (workspace vide)", () => {
  test.use({ mockMode: "empty", faktMode: 1 });

  test("étape 1 : profil entreprise — submit désactivé tant que invalide", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByTestId("wizard")).toBeVisible({ timeout: 5_000 });
    const submit = page.getByTestId("wizard-next");
    await expect(submit).toBeDisabled();
  });

  test("étape 1 : remplir le profil entreprise active le bouton suivant", async ({ page }) => {
    await page.goto("/onboarding");
    await fillIdentityStep(page, {
      name: "Atelier Test",
      siret: "73282932000074",
      address: "12 rue de la République\n13001 Marseille",
      email: "test@example.fr",
      phone: "0612345678",
    });
    const submit = page.getByTestId("wizard-next");
    await expect(submit).toBeEnabled({ timeout: 5_000 });
  });

  test("SIRET trop court remonte une erreur de validation Zod", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByTestId("wizard-identity-siret").fill("123");
    await page.getByTestId("wizard-identity-name").click();
    // Le hint passe en mode erreur — on accepte plusieurs textes possibles.
    await expect(page.locator("body")).toContainText(/(14 chiffres|invalide|requis)/i);
  });
});
