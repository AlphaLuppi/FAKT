/**
 * Spec E2E — Gestion des clients.
 *
 * User journeys :
 *   02. Créer client (CRUD)
 *   03. Éditer client
 *   04. Supprimer client
 */

import { expect, test } from "./helpers/test.js";

test.describe("Clients — liste + CRUD", () => {
  test("affiche les clients seedés (Acme SAS, Beta Studio EURL)", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.locator("body")).toContainText(/Acme SAS/i);
    await expect(page.locator("body")).toContainText(/Beta Studio EURL/i);
  });

  test("ouvrir le détail d'un client affiche son adresse", async ({ page }) => {
    // La modale de détail s'ouvre par clic ligne — il n'existe pas de route /clients/:id.
    await page.goto("/clients");
    await page
      .getByText(/Acme SAS/i)
      .first()
      .click();
    await expect(page.getByTestId("client-detail-edit")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("body")).toContainText(/Champs-Élysées/);
  });

  test("créer un client → apparaît dans la liste", async ({ page, mockState }) => {
    await page.goto("/clients");
    await page.getByTestId("client-list-new").click();
    await expect(page.getByTestId("client-form")).toBeVisible();

    await page.getByTestId("client-form-name").fill("Gamma Tech SARL");
    await page.getByTestId("client-form-email").fill("contact@gamma.tech");
    await page.getByTestId("client-form-address").fill("99 rue de la Paix\n75002 Paris");

    await page.getByTestId("client-form-submit").click();

    // Le formulaire ferme et le mock state encaisse la création.
    await expect
      .poll(() => mockState.clients.length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(3);
    expect(mockState.clients.some((c) => c.name === "Gamma Tech SARL")).toBe(true);
  });

  test("supprimer (archiver) un client retire la ligne de la liste active", async ({
    page,
    mockState,
  }) => {
    await page.goto("/clients");

    // Ouvre la modale détail puis utilise client-detail-archive.
    await page
      .getByText(/Acme SAS/i)
      .first()
      .click();
    const archiveBtn = page.getByTestId("client-detail-archive");
    await expect(archiveBtn).toBeVisible({ timeout: 5_000 });
    await archiveBtn.click();

    // Le sidecar réel fait un soft-delete (archivedAt set), pas un hard-delete.
    // On vérifie donc que les clients ACTIFS (non archivés) sont passés < 2.
    await expect
      .poll(() => mockState.clients.filter((c) => c.archivedAt === null).length, {
        timeout: 5_000,
      })
      .toBeLessThan(2);
  });
});
