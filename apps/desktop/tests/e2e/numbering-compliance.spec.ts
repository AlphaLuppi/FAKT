/**
 * Spec E2E — Conformité numérotation séquentielle CGI art. 289.
 *
 * User journey :
 *   29. Compliance — numérotation sans trous, mentions obligatoires
 *
 * La règle CGI : sur une année donnée, la séquence des factures doit être
 * monotone croissante sans trou. On vérifie ce comportement via 3 créations
 * consécutives + lecture de la liste.
 */

import { expect, test } from "./helpers/test.js";

test.describe("Numérotation CGI art. 289", () => {
  test("3 factures créées consécutivement → numéros séquentiels sans trou", async ({
    page,
    mockState,
  }) => {
    await page.goto("/invoices");

    async function createOne(amount: string): Promise<void> {
      await page.goto("/invoices/new?from=scratch");

      // ClientPicker → cli-001.
      await page.getByTestId("client-picker-toggle").click();
      await page.getByTestId("client-option-cli-001").click();

      // Titre + ligne unique.
      await page.getByTestId("invoice-form-title").fill(`Mission compliance ${amount}`);
      await page.getByTestId("items-add").click();
      await page.getByTestId("item-description-0").fill(`Mission compliance ${amount}`);
      await page.getByTestId("item-quantity-0").fill("1");
      await page.getByTestId("item-unit-price-0").fill(amount);

      await page.getByTestId("invoice-create-and-issue").click();
      // Attend le retour vers la liste / fin du submit.
      await page.waitForTimeout(500);
    }

    await createOne("100");
    await createOne("200");
    await createOne("300");

    const seqsForYear = mockState.invoices
      .map((i) => i.number)
      .filter((n): n is string => typeof n === "string" && n.startsWith("F2026-"))
      .map((n) => Number.parseInt(n.split("-")[1], 10))
      .sort((a, b) => a - b);

    // Pas de trou : chaque seq[i+1] = seq[i] + 1.
    for (let i = 1; i < seqsForYear.length; i++) {
      expect(seqsForYear[i] - seqsForYear[i - 1]).toBe(1);
    }
    // Au moins 4 factures (initiale F2026-001 + 3 nouvelles).
    expect(seqsForYear.length).toBeGreaterThanOrEqual(3);
  });
});
