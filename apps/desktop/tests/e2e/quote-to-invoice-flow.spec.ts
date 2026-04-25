/**
 * Spec E2E — Workflow complet devis → facture → paiement.
 *
 * User journey :
 *   27. Wizard setup → new quote → fill → render PDF → sign → email → convert
 *       → invoice → mark-paid
 *
 * C'est le scénario "happy path" du métier freelance. Si ce test passe, la
 * grosse boucle marche. Les sub-tests (signature crypto réelle, etc.) sont
 * dans leurs specs dédiées.
 */

import { expect, test } from "./helpers/test.js";

test.describe("Workflow complet — devis créé → facturé → marqué payé", () => {
  test("D2026-001 → conversion → F2026-XXX → mark paid", async ({ page, mockState }) => {
    // 1. Visiter le devis seedé.
    await page.goto("/quotes/q-001");
    await expect(page.getByTestId("quote-detail-back")).toBeVisible({ timeout: 5_000 });

    // 2. Forcer le status "accepted" via l'API mockée pour débloquer la conversion.
    await page.evaluate(() =>
      fetch("http://127.0.0.1:65000/api/quotes/q-001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      })
    );

    // 3. Conversion en facture via la route dédiée /invoices/new?from=quote.
    const initial = mockState.invoices.length;
    await page.goto("/invoices/new?from=quote");
    await page.getByTestId("quote-picker").selectOption({ value: "q-001" });
    await expect(page.getByTestId("invoice-create-and-issue")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("invoice-create-and-issue").click();

    await expect
      .poll(() => mockState.invoices.length, { timeout: 10_000 })
      .toBeGreaterThan(initial);
    const newInvoice = mockState.invoices[mockState.invoices.length - 1];
    expect(newInvoice.number).toMatch(/^F2026-\d{3}$/);

    // 4. Marquer la facture payée via l'UI (modal mark-paid).
    await page.goto(`/invoices/${newInvoice.id}`);
    await expect(page.getByTestId("invoice-detail-mark-paid")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("invoice-detail-mark-paid").click();
    await expect(page.getByTestId("invoice-mark-paid-modal")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("mark-paid-confirm").click();

    await expect
      .poll(() => mockState.invoices.find((i) => i.id === newInvoice.id)?.status, {
        timeout: 5_000,
      })
      .toBe("paid");
  });
});
