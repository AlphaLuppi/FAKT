/**
 * Tests légaux FR — contraintes non négociables :
 * - DELETE facture émise → 409 CONFLICT (archivage 10 ans, CGI art. 289)
 * - Le trigger SQL `invoices_no_hard_delete_issued` bloque aussi au niveau DB
 * - Numérotation séquentielle sans trou (CGI art. 289)
 * - Numérotation immutable une fois attribuée
 */

import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";
import { seedClient, CLIENT_ID_1 } from "@fakt/db/__tests__/helpers";

const INVOICE_ID = "33330000-0000-4000-8000-000000000001";
const INVOICE_ID_2 = "33330000-0000-4000-8000-000000000002";
const ITEM_ID = "44440000-0000-4000-8000-000000000001";
const ITEM_ID_2 = "44440000-0000-4000-8000-000000000002";

const LEGAL = "TVA non applicable, art. 293 B du CGI. Pénalités 10%, indemnité forfaitaire 40€.";

function invoicePayload(id = INVOICE_ID, itemId = ITEM_ID) {
  return {
    id,
    clientId: CLIENT_ID_1,
    kind: "independent",
    title: "Prestation",
    totalHtCents: 50_000,
    legalMentions: LEGAL,
    items: [
      {
        id: itemId,
        position: 0,
        description: "Dev",
        quantity: 1,
        unitPriceCents: 50_000,
        unit: "forfait",
        lineTotalCents: 50_000,
      },
    ],
  };
}

describe("DELETE /api/invoices/:id — conformité archivage 10 ans", () => {
  it("204 si status=draft (suppression autorisée avant émission)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const del = await app.request(`/api/invoices/${INVOICE_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(del.status).toBe(204);
  });

  it("409 CONFLICT si facture émise (sent) — CGI art. 289", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    // Issue : draft → sent
    await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });

    const res = await app.request(`/api/invoices/${INVOICE_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("CONFLICT");
    // Message doit signaler la contrainte légale
    expect(body.error.message).toMatch(/archiv|CGI|10 ans/i);
  });

  it("409 si facture payée (paid) — même règle", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ paidAt: 1_700_000_000_000, method: "wire" }),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(409);
  });

  it("Trigger SQL `invoices_no_hard_delete_issued` bloque même en contournant l'API", async () => {
    const { app, authHeaders, db, sqlite } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });

    // Tentative directe via sqlite : doit être interceptée par le trigger
    expect(() =>
      sqlite.prepare("DELETE FROM invoices WHERE id = ?").run(INVOICE_ID)
    ).toThrow(/cannot hard-delete/i);
  });
});

describe("Numérotation séquentielle sans trou — CGI art. 289", () => {
  it("2 factures issued → sequences 1 puis 2", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);

    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload(INVOICE_ID, ITEM_ID)),
    });
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload(INVOICE_ID_2, ITEM_ID_2)),
    });

    const r1 = await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const r2 = await app.request(`/api/invoices/${INVOICE_ID_2}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const b1 = (await r1.json()) as { sequence: number; number: string };
    const b2 = (await r2.json()) as { sequence: number; number: string };
    expect(b2.sequence).toBe(b1.sequence + 1);
  });

  it("Trigger SQL `invoices_immutable_number` empêche la modification du numéro", async () => {
    const { app, authHeaders, db, sqlite } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });

    expect(() =>
      sqlite
        .prepare("UPDATE invoices SET number = 'TAMPERED' WHERE id = ?")
        .run(INVOICE_ID)
    ).toThrow(/immutable/i);
  });
});

describe("Mention légale TVA micro-entreprise — stockée dans legalMentions", () => {
  it("Le champ legalMentions est bien renvoyé intact", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID}`, { headers: authHeaders() });
    const body = (await res.json()) as { legalMentions: string };
    expect(body.legalMentions).toContain("TVA non applicable, art. 293 B du CGI");
  });
});

/* ─── P0-C régression ───────────────────────────────────────────────────────
 * CGI art. 289-I-4 : une facture émise ne peut pas être annulée — elle doit
 * être remplacée par un avoir (facture négative avec son propre numéro).
 * Autoriser sent→cancelled créerait un trou dans la séquence visible par
 * l'URSSAF/le fisc.
 */
describe("POST /api/invoices/:id/cancel — conformité CGI art. 289-I-4", () => {
  it("200 si draft → cancelled (brouillon jamais émis, autorisé)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("cancelled");
  });

  it("422 INVALID_TRANSITION si sent → cancelled (facture émise : avoir obligatoire)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    // draft → sent (numéro légal attribué)
    const issueRes = await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(issueRes.status).toBe(200);

    // cancel → 422 avec mention CGI art. 289-I-4 + "avoir"
    const res = await app.request(`/api/invoices/${INVOICE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_TRANSITION");
    expect(body.error.message).toMatch(/CGI art\. 289-I-4/i);
    expect(body.error.message).toMatch(/avoir/i);
  });

  it("422 INVALID_TRANSITION si paid → cancelled", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ paidAt: 1_700_000_000_000, method: "wire" }),
    });

    const res = await app.request(`/api/invoices/${INVOICE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_TRANSITION");
    expect(body.error.message).toMatch(/CGI art\. 289-I-4/i);
  });

  it("200 idempotent si déjà cancelled (re-cancel ne throw pas)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
  });
});
