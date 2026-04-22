import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";
import { seedClient, CLIENT_ID_1, WORKSPACE_ID } from "@fakt/db/__tests__/helpers";
import { createQuote, updateQuoteStatus } from "@fakt/db/queries";
import type { TestDb } from "@fakt/db/__tests__/helpers";

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

  it("balance après deposit30 : facture solde = total - acompte", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    // Step 1 : acompte 30%
    const dep = await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "deposit30", legalMentions: LEGAL }),
    });
    expect(dep.status).toBe(201);

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

  it("balance quand acomptes >= total → 422 INVALID_TRANSITION", async () => {
    const { app, authHeaders, db } = createTestApp();
    seedClient(db);
    seedSignedQuote(db, 100_000);

    // 2 acomptes de 30% → 60_000 ; puis "full" facture totale 100_000
    await app.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: INVOICE_ID_1, mode: "full", legalMentions: LEGAL }),
    });
    // Là balance ne doit pas être calculable (total - 0 acompte = 100k, mais il reste 0 à facturer
    // en conceptuel ; cependant la logique DB ne regarde que les deposits pas les 'total')
    // Pour déclencher 422 : on fait 4 deposits de 30_000 (si possible) puis balance
    // Simpler : mettre un quote 100k puis 4 deposits de 30k = 120k > 100k
    const { app: app2, authHeaders: auth2, db: db2 } = createTestApp();
    seedClient(db2);
    seedSignedQuote(db2, 100_000);
    for (let i = 0; i < 4; i++) {
      const id = `dddd0000-0000-4000-8000-00000000000${i}`;
      await app2.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
        method: "POST",
        headers: auth2(),
        body: JSON.stringify({ id, mode: "deposit30", legalMentions: LEGAL }),
      });
    }
    const res = await app2.request(`/api/invoices/from-quote/${QUOTE_ID}`, {
      method: "POST",
      headers: auth2(),
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

    const res = await app.request(
      "/api/invoices/from-quote/99999999-0000-4000-8000-999999999999",
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: INVOICE_ID_1, mode: "full", legalMentions: LEGAL }),
      }
    );
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
