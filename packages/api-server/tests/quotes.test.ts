import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

const CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUOTE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const QUOTE_ID_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function clientPayload(id = CLIENT_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Acme SAS",
    email: `acme+${id.slice(0, 8)}@test.fr`,
    ...overrides,
  };
}

function itemPayload(id = ITEM_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    position: 1,
    description: "Design UI",
    quantity: 3000,
    unitPriceCents: 50000,
    unit: "jour",
    lineTotalCents: 150000,
    serviceId: null,
    ...overrides,
  };
}

function quotePayload(id = QUOTE_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    clientId: CLIENT_ID,
    title: "Refonte site",
    conditions: "Paiement 30 jours",
    validityDate: 1_750_000_000_000,
    notes: null,
    totalHtCents: 150000,
    items: [itemPayload()],
    ...overrides,
  };
}

async function createClient(app: ReturnType<typeof createTestApp>["app"], headers: Record<string, string>) {
  const res = await app.request("/api/clients", {
    method: "POST",
    headers,
    body: JSON.stringify(clientPayload()),
  });
  expect(res.status).toBe(201);
}

describe("POST /api/quotes", () => {
  it("201 crée quote en draft, number=null", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());

    const res = await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      status: string;
      number: string | null;
      items: unknown[];
    };
    expect(body.id).toBe(QUOTE_ID);
    expect(body.status).toBe("draft");
    expect(body.number).toBe(null);
    expect(body.items).toHaveLength(1);
  });

  it("400 si items vide", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    const res = await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload(QUOTE_ID, { items: [] })),
    });
    expect(res.status).toBe(400);
  });

  it("409 si clientId inexistant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CONFLICT");
  });

  it("400 si title absent", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    const bad = quotePayload();
    delete (bad as Record<string, unknown>)["title"];
    const res = await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(bad),
    });
    expect(res.status).toBe(400);
  });

  it("401 sans token", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/quotes", {
      method: "POST",
      body: JSON.stringify(quotePayload()),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("201 avec quote minimal (sans conditions/validityDate/notes)", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    const res = await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: QUOTE_ID,
        clientId: CLIENT_ID,
        title: "Minimal",
        totalHtCents: 50000,
        items: [itemPayload()],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      conditions: string | null;
      validityDate: number | null;
      notes: string | null;
    };
    expect(body.conditions).toBe(null);
    expect(body.validityDate).toBe(null);
    expect(body.notes).toBe(null);
  });

  it("PATCH peut modifier items, validityDate, conditions, notes", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const newItem = "22222222-3333-4444-8555-666666666666";
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        conditions: "Nouvelles conditions",
        validityDate: 1_800_000_000_000,
        notes: "notes maj",
        clientId: CLIENT_ID,
        totalHtCents: 200000,
        items: [
          {
            id: newItem,
            position: 1,
            description: "new",
            quantity: 2000,
            unitPriceCents: 100000,
            unit: "forfait",
            lineTotalCents: 200000,
            serviceId: null,
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      conditions: string | null;
      validityDate: number | null;
      notes: string | null;
      items: unknown[];
    };
    expect(body.conditions).toBe("Nouvelles conditions");
    expect(body.validityDate).toBe(1_800_000_000_000);
    expect(body.notes).toBe("notes maj");
    expect(body.items).toHaveLength(1);
  });
});

describe("GET /api/quotes", () => {
  it("200 + items paginés", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request("/api/quotes?limit=10", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string }[];
      pagination: { limit: number };
    };
    expect(body.items).toHaveLength(1);
    expect(body.pagination.limit).toBe(10);
  });

  it("filtre status=draft", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request("/api/quotes?status=draft", { headers: authHeaders() });
    const body = (await res.json()) as { items: { status: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.status).toBe("draft");
  });

  it("filtre status csv multi", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request("/api/quotes?status=draft,sent", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("filtre clientId", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request(`/api/quotes?clientId=${CLIENT_ID}`, {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: { clientId: string }[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("GET /api/quotes/:id", () => {
  it("200 avec items", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("404 absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(`/api/quotes/${QUOTE_ID_2}`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("400 id invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/quotes/not-uuid", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/quotes/:id", () => {
  it("200 modifie draft", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ title: "Nouveau titre" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Nouveau titre");
  });

  it("422 si quote non draft (sent)", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ title: "X" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  it("404 si quote absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(`/api/quotes/${QUOTE_ID_2}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ title: "X" }),
    });
    expect(res.status).toBe(404);
  });

  it("400 body vide", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/quotes/:id", () => {
  it("204 si draft", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(204);

    const after = await app.request(`/api/quotes/${QUOTE_ID}`, {
      headers: authHeaders(),
    });
    expect(after.status).toBe(404);
  });

  it("422 si non draft", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
  });

  it("404 si absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(`/api/quotes/${QUOTE_ID_2}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/quotes/search", () => {
  it("200 + items par titre", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request("/api/quotes/search?q=Refonte", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { title: string }[] };
    expect(body.items).toHaveLength(1);
  });

  it("400 q absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/quotes/search", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/quotes/:id/preview-next-number", () => {
  it("200 + format D2026-001", async () => {
    const { app, authHeaders } = createTestApp();
    await createClient(app, authHeaders());
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(quotePayload()),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/preview-next-number`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sequence: number; formatted: string };
    expect(body.sequence).toBe(1);
    expect(body.formatted).toMatch(/^D\d{4}-001$/);
  });
});
