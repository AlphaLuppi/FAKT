import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";
import { seedClient, CLIENT_ID_1 } from "@fakt/db/__tests__/helpers";

const INVOICE_ID_1 = "11110000-0000-4000-8000-000000000001";
const INVOICE_ID_2 = "11110000-0000-4000-8000-000000000002";
const ITEM_ID_1 = "22220000-0000-4000-8000-000000000001";
const ITEM_ID_2 = "22220000-0000-4000-8000-000000000002";

const LEGAL = "TVA non applicable, art. 293 B du CGI. Pénalités 10%, indemnité forfaitaire 40€.";

function invoicePayload(id = INVOICE_ID_1, overrides: Record<string, unknown> = {}) {
  return {
    id,
    clientId: CLIENT_ID_1,
    kind: "independent",
    title: "Prestation Q1",
    totalHtCents: 100_000,
    legalMentions: LEGAL,
    items: [
      {
        id: ITEM_ID_1,
        position: 0,
        description: "Développement",
        quantity: 5,
        unitPriceCents: 20_000,
        unit: "jour",
        lineTotalCents: 100_000,
      },
    ],
    ...overrides,
  };
}

function setupWithClient() {
  const handle = createTestApp();
  seedClient(handle.db);
  return handle;
}

describe("POST /api/invoices", () => {
  it("201 + draft indépendante créée", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      status: string;
      kind: string;
      number: string | null;
    };
    expect(body.id).toBe(INVOICE_ID_1);
    expect(body.status).toBe("draft");
    expect(body.kind).toBe("independent");
    expect(body.number).toBeNull();
  });

  it("400 si items vide", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload(INVOICE_ID_1, { items: [] })),
    });
    expect(res.status).toBe(400);
  });

  it("400 si id pas UUID", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload("not-uuid")),
    });
    expect(res.status).toBe(400);
  });

  it("400 si legalMentions vide", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload(INVOICE_ID_1, { legalMentions: "" })),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/invoices", () => {
  it("liste avec pagination", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request("/api/invoices?limit=10&offset=0", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string }[];
      pagination: { limit: number; count: number };
    };
    expect(body.items).toHaveLength(1);
    expect(body.pagination.limit).toBe(10);
  });

  it("filtre par status=draft", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request("/api/invoices?status=draft", { headers: authHeaders() });
    const body = (await res.json()) as { items: { status: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.status).toBe("draft");
  });

  it("filtre par clientId", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices?clientId=${CLIENT_ID_1}`, {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("400 si limit > 10000", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices?limit=10001", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/invoices/:id", () => {
  it("200 + items joints", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; items: unknown[] };
    expect(body.id).toBe(INVOICE_ID_1);
    expect(body.items).toHaveLength(1);
  });

  it("404 si inconnu", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request(
      "/api/invoices/99999999-0000-4000-8000-999999999999",
      { headers: authHeaders() }
    );
    expect(res.status).toBe(404);
  });

  it("400 si id pas UUID", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices/not-uuid", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/invoices/:id", () => {
  it("200 + titre mis à jour (draft)", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ title: "Titre modifié" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Titre modifié");
  });

  it("404 si inconnu", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request(
      "/api/invoices/99999999-0000-4000-8000-999999999999",
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ title: "X" }),
      }
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/invoices/:id/issue", () => {
  it("200 + status=sent + number attribué", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      number: string;
      year: number;
      sequence: number;
    };
    expect(body.status).toBe("sent");
    expect(body.number).toBeTruthy();
    expect(body.sequence).toBeGreaterThan(0);
  });

  it("422 si invoice déjà sent (transition invalide)", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
  });
});

describe("POST /api/invoices/:id/mark-paid", () => {
  it("200 + status=paid avec méthode + notes", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request(`/api/invoices/${INVOICE_ID_1}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        paidAt: 1_700_000_000_000,
        method: "wire",
        notes: "REF 12345",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      paymentMethod: string;
      paidAt: number;
      paymentNotes: string;
    };
    expect(body.status).toBe("paid");
    expect(body.paymentMethod).toBe("wire");
    expect(body.paidAt).toBe(1_700_000_000_000);
    expect(body.paymentNotes).toBe("REF 12345");
  });

  it("422 si facture en draft (transition invalide)", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ paidAt: 1_700_000_000_000, method: "wire" }),
    });
    expect(res.status).toBe(422);
  });

  it("400 si method invalide", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/mark-paid`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ paidAt: 1, method: "bitcoin" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/invoices/:id/archive", () => {
  it("200 + archivedAt set", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/archive`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { archivedAt: number | null };
    expect(body.archivedAt).not.toBeNull();
  });
});

describe("POST /api/invoices/:id/cancel", () => {
  it("200 + status=cancelled depuis draft", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    const res = await app.request(`/api/invoices/${INVOICE_ID_1}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("cancelled");
  });
});

describe("GET /api/invoices/search", () => {
  it("200 + match partiel sur titre", async () => {
    const { app, authHeaders } = setupWithClient();
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(invoicePayload()),
    });
    await app.request("/api/invoices", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(
        invoicePayload(INVOICE_ID_2, {
          title: "Autre chose",
          items: [
            {
              id: ITEM_ID_2,
              position: 0,
              description: "Service X",
              quantity: 1,
              unitPriceCents: 1000,
              unit: "forfait",
              lineTotalCents: 1000,
            },
          ],
          totalHtCents: 1000,
        })
      ),
    });
    const res = await app.request("/api/invoices/search?q=Prestation", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(INVOICE_ID_1);
  });

  it("400 si q absent", async () => {
    const { app, authHeaders } = setupWithClient();
    const res = await app.request("/api/invoices/search", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});
