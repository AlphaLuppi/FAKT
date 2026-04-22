import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID_2 = "22222222-2222-4222-8222-222222222222";

function clientPayload(id = CLIENT_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Acme SAS",
    legalForm: "SAS",
    siret: "73282932000074",
    address: "1 rue de la paix",
    contactName: "Alice",
    email: "alice@acme.fr",
    sector: "Conseil",
    firstCollaboration: null,
    note: null,
    ...overrides,
  };
}

describe("POST /api/clients", () => {
  it("201 + retourne l'entité créée", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string; workspaceId: string };
    expect(body.id).toBe(CLIENT_ID);
    expect(body.name).toBe("Acme SAS");
  });

  it("400 si id pas un UUID", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload("not-a-uuid")),
    });
    expect(res.status).toBe(400);
  });

  it("400 si SIRET invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload(CLIENT_ID, { siret: "99999999999999" })),
    });
    expect(res.status).toBe(400);
  });

  it("400 si name absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: CLIENT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("409 si email dupliqué (contrainte UNIQUE workspace+email)", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload(CLIENT_ID_2)),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CONFLICT");
  });
});

describe("GET /api/clients", () => {
  it("liste les clients avec pagination", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const res = await app.request("/api/clients?limit=10&offset=0", {
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

  it("filtre par search sur le nom", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload(CLIENT_ID_2, { name: "Beta Corp", email: "b@b.fr" })),
    });
    const res = await app.request("/api/clients?search=Acme", { headers: authHeaders() });
    const body = (await res.json()) as { items: { name: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toBe("Acme SAS");
  });

  it("400 si limit > 200", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients?limit=500", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/clients/:id", () => {
  it("200 si trouvé", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const res = await app.request(`/api/clients/${CLIENT_ID}`, { headers: authHeaders() });
    expect(res.status).toBe(200);
  });

  it("404 si inexistant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(
      "/api/clients/99999999-9999-4999-8999-999999999999",
      { headers: authHeaders() }
    );
    expect(res.status).toBe(404);
  });

  it("400 si id pas UUID", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients/not-uuid", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/clients/:id", () => {
  it("200 + champs mis à jour", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const res = await app.request(`/api/clients/${CLIENT_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Renamed" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("Renamed");
  });

  it("404 si client absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(
      "/api/clients/99999999-9999-4999-8999-999999999999",
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: "X" }),
      }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/clients/:id + restore", () => {
  it("204 + 404 sur re-delete + restore 200", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const del = await app.request(`/api/clients/${CLIENT_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(del.status).toBe(204);

    const redel = await app.request(`/api/clients/${CLIENT_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(redel.status).toBe(404);

    const restore = await app.request(`/api/clients/${CLIENT_ID}/restore`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(restore.status).toBe(200);
    const body = (await restore.json()) as { archivedAt: number | null };
    expect(body.archivedAt).toBe(null);
  });

  it("404 sur restore si non archivé", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const res = await app.request(`/api/clients/${CLIENT_ID}/restore`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/clients/search", () => {
  it("200 + items matching q", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/clients", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(clientPayload()),
    });
    const res = await app.request("/api/clients/search?q=Acme", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { name: string }[] };
    expect(body.items).toHaveLength(1);
  });

  it("400 si q absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/clients/search", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});

describe("settings endpoints", () => {
  it("PUT puis GET /api/settings/:key retourne valeur", async () => {
    const { app, authHeaders } = createTestApp();
    const put = await app.request("/api/settings/theme", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ value: "dark" }),
    });
    expect(put.status).toBe(200);

    const get = await app.request("/api/settings/theme", { headers: authHeaders() });
    expect(get.status).toBe(200);
    const body = (await get.json()) as { key: string; value: string };
    expect(body.value).toBe("dark");
  });

  it("GET /api/settings/:key retourne 404 si absente", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/settings/unknown", { headers: authHeaders() });
    expect(res.status).toBe(404);
  });

  it("PUT avec clé invalide → 400", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/settings/bad key with spaces", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ value: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/settings liste tout", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/settings/a", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ value: "1" }),
    });
    await app.request("/api/settings/b", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ value: "2" }),
    });
    const res = await app.request("/api/settings", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { settings: { key: string; value: string }[] };
    expect(body.settings).toHaveLength(2);
  });
});

describe("route non existante", () => {
  it("404 avec body JSON structuré", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/does-not-exist", { headers: authHeaders() });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
