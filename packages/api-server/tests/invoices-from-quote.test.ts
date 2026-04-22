import { CLIENT_ID_1, WORKSPACE_ID, seedClient } from "@fakt/db/__tests__/helpers";
import type { TestDb } from "@fakt/db/__tests__/helpers";
import { createQuote, updateQuoteStatus } from "@fakt/db/queries";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

const QUOTE_ID = "aaaa0000-0000-4000-8000-000000000001";
const INVOICE_ID_1 = "bbbb0000-0000-4000-8000-000000000001";
const INVOICE_ID_2 = "bbbb0000-0000-4000-8000-000000000002";
const INVOICE_ID_3 = "bbbb0000-0000-4000-8000-000000000003";
const ITEM_ID = "cccc0000-0000-4000-8000-000000000001";

const LEGAL = "TVA non applicable, art. 293 B du CGI.";

/** Seed un devis signed avec un montant total connu. */
function seedSignedQuote(db: TestDb, totalHtCents = 100_000): void {
  createQuote(db, {
    id: QUOTE_ID,
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID_1,
    title: "Devis test",
    totalHtCents,
    items: [
      {
        id: ITEM_ID,
        position: 0,
        description: "Ligne unique",
        quantity: 10,
        unitPriceCents: Math.floor(totalHtCents / 10),
        unit: "jour",
        lineTotalCents: totalHtCents,
      },
    ],
  });
  // draft → sent → signed
  updateQuoteStatus(db, QUOTE_ID, "sent");
  updateQuoteStatus(db, QUOTE_ID, "signed");
}

describe("POST /api/invoices/from-quote/:quoteId — 3 modes", () => {
  it("deposit30 : crée facture acompte 30% du total devis (kind=deposit)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: INVOICE_ID_1,
        mode: "deposit30",
        legalMentions: LEGAL,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      kind: string;
      depositPercent: number | null;
      totalHtCents: number;
      quoteId: string;
    };
    expect(body.kind).toBe("deposit");
    expect(body.depositPercent).toBe(30);
    expect(body.totalHtCents).toBe(30_000);
    expect(body.quoteId).toBe(QUOTE_ID);
  });

  it("full : crée facture totale 100% du devis (kind=total)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: INVOICE_ID_1,
        mode: "full",
        legalMentions: LEGAL,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      kind: string;
      totalHtCents: number;
    };
    expect(body.kind).toBe("total");
    expect(body.totalHtCents).toBe(100_000);
  });

  it("balance après deposit30 émis : facture solde = total - acompte", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    // Step 1 : acompte 30% — DOIT être émis (draft→sent) pour compter dans le balance
    //          (P0-A : seuls status sent|paid|overdue sont soustraits)
    const dep = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "deposit30", legalMentions: LEGAL }),
    });
    expect(dep.status).toBe(201);
    const issueRes = await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(issueRes.status).toBe(200);

    // Step 2 : balance (doit = 100_000 - 30_000 = 70_000)
    const bal = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_2, mode: "balance", legalMentions: LEGAL }),
    });
    expect(bal.status).toBe(201);
    const body = (await bal.json()) as { kind: string; totalHtCents: number };
    expect(body.kind).toBe("balance");
    expect(body.totalHtCents).toBe(70_000);
  });

  it("balance sans deposit : facture solde = total intégral", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_3, mode: "balance", legalMentions: LEGAL }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { totalHtCents: number };
    expect(body.totalHtCents).toBe(100_000);
  });

  it("balance quand acomptes émis >= total → 422 INVALID_TRANSITION", async () => {
    // 4 deposits de 30_000 créés ET émis (draft→sent) = 120_000 > 100_000 du devis
    // → balance = 100_000 - 120_000 = -20_000 → throw balance <= 0 → 422.
    // P0-A : émission nécessaire pour que les deposits comptent dans le calcul.
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    for (let i = 0; i < 4; i++) {
      const id = `dddd0000-0000-4000-8000-00000000000${i}`;
      const create = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id, mode: "deposit30", legalMentions: LEGAL }),
      });
      expect(create.status).toBe(201);
      const issued = await app.request(`/api/invoices/${id}/issue`, {
        method: "POST",
        headers: authHeaders(),
      });
      expect(issued.status).toBe(200);
    }

    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: "dddd0000-0000-4000-8000-00000000000a",
        mode: "balance",
        legalMentions: LEGAL,
      }),
    });
    expect(res.status).toBe(422);
  });

  it("404 si quote inconnu", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);

    const res = await app.request("/api/invoices/from-quote/99999999-0000-4000-8000-999999999999", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "full", legalMentions: LEGAL }),
    });
    expect(res.status).toBe(404);
  });

  it("422 si quote pas signé (status=draft)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Non signé",
      totalHtCents: 50_000,
      items: [
        {
          id: ITEM_ID,
          position: 0,
          description: "x",
          quantity: 1,
          unitPriceCents: 50_000,
          unit: "forfait",
          lineTotalCents: 50_000,
        },
      ],
    });
    // statut draft, non signé
    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "full", legalMentions: LEGAL }),
    });
    expect(res.status).toBe(422);
  });

  it("400 si mode invalide", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);
    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "unknown", legalMentions: LEGAL }),
    });
    expect(res.status).toBe(400);
  });

  it("400 si id invoice manquant ou pas UUID", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);
    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: "bad", mode: "full", legalMentions: LEGAL }),
    });
    expect(res.status).toBe(400);
  });

  /* ─── P0-A régression ──────────────────────────────────────────────────────
   * Bug historique : balance soustrayait aussi les acomptes cancelled/draft
   * → le freelance perdait de l'argent. Fix : filtrer status IN sent|paid|overdue.
   */
  it("P0-A : balance ignore un deposit30 en statut cancelled — solde = 100 % du total", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    // 1) Émettre deposit30 (30_000) → draft→sent (cet acompte compte)
    const dep = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "deposit30", legalMentions: LEGAL }),
    });
    expect(dep.status).toBe(201);
    const issueRes = await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(issueRes.status).toBe(200);

    // 2) Créer un second deposit draft puis le cancel (seule transition draft→cancelled
    //    autorisée depuis P0-C).
    const depDraftId = "bbbb0000-0000-4000-8000-000000000099";
    const depDraft = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: depDraftId, mode: "deposit30", legalMentions: LEGAL }),
    });
    expect(depDraft.status).toBe(201);
    const cancelRes = await app.request(`/api/invoices/${depDraftId}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(cancelRes.status).toBe(200); // draft → cancelled OK

    // 3) balance : soustrait seulement le deposit sent (30_000), pas celui cancelled
    //    → totalHtCents = 100_000 - 30_000 = 70_000 (pas 40_000 = -2× 30_000)
    const bal = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_2, mode: "balance", legalMentions: LEGAL }),
    });
    expect(bal.status).toBe(201);
    const body = (await bal.json()) as { totalHtCents: number };
    expect(body.totalHtCents).toBe(70_000);
  });

  it("P0-A : balance ignore un deposit30 resté en draft (pas encore émis) — solde = 100 %", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    // deposit30 créé mais jamais émis (reste draft, pas de numéro légal)
    await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "deposit30", legalMentions: LEGAL }),
    });
    // PAS d'issue → reste draft

    const bal = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_2, mode: "balance", legalMentions: LEGAL }),
    });
    expect(bal.status).toBe(201);
    const body = (await bal.json()) as { totalHtCents: number };
    // un deposit draft n'a pas d'existence légale → doit être ignoré
    expect(body.totalHtCents).toBe(100_000);
  });

  /* ─── P0-B régression ──────────────────────────────────────────────────────
   * Bug historique : Math.floor pour totalHtCents + Math.round sur lignes
   * → Σ lignes ≠ totalHtCents sur devis non divisibles par 30.
   * Fix : Math.round pour totalHtCents + redistribution écart cents sur dernière ligne.
   * Invariant : Σ lines.lineTotalCents === totalHtCents
   */
  it.each([
    { label: "1 cent", totalHtCents: 1 },
    { label: "99,99 € (9999 cents)", totalHtCents: 9_999 },
    { label: "33,33 € (3333 cents)", totalHtCents: 3_333 },
    { label: "100,03 € (10003 cents)", totalHtCents: 10_003 },
    { label: "100,01 € (10001 cents)", totalHtCents: 10_001 },
  ])("P0-B : deposit30 invariant Σ lines = totalHtCents sur $label", async ({ totalHtCents }) => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, totalHtCents);

    const res = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: INVOICE_ID_1,
        mode: "deposit30",
        legalMentions: LEGAL,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      totalHtCents: number;
      items: { lineTotalCents: number }[];
    };
    const expected = Math.round((totalHtCents * 30) / 100);
    expect(body.totalHtCents).toBe(expected);
    const sum = body.items.reduce((s, i) => s + i.lineTotalCents, 0);
    // Invariant strict — sinon le PDF Typst affichera Σ ≠ total.
    expect(sum).toBe(body.totalHtCents);
  });

  it("P0-B : balance invariant Σ lines = totalHtCents sur devis 10003 cents après deposit sent", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 10_003);

    // deposit30 = round(10003*30/100) = round(3000.9) = 3001
    const dep = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "deposit30", legalMentions: LEGAL }),
    });
    expect(dep.status).toBe(201);
    const depBody = (await dep.json()) as { totalHtCents: number };
    expect(depBody.totalHtCents).toBe(3_001);
    // Émettre pour qu'il soit compté dans le balance (filter status sent|paid|overdue)
    await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });

    const bal = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_2, mode: "balance", legalMentions: LEGAL }),
    });
    expect(bal.status).toBe(201);
    const body = (await bal.json()) as {
      totalHtCents: number;
      items: { lineTotalCents: number }[];
    };
    expect(body.totalHtCents).toBe(10_003 - 3_001); // 7002
    const sum = body.items.reduce((s, i) => s + i.lineTotalCents, 0);
    expect(sum).toBe(body.totalHtCents);
  });

  it("full : transitionne le quote parent en 'invoiced' (best-effort)", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "full", legalMentions: LEGAL }),
    });

    const qr = await app.request(`/api/quotes/${QUOTE_ID}`, { headers: authHeaders() });
    const q = (await qr.json()) as { status: string };
    expect(q.status).toBe("invoiced");
  });
});
