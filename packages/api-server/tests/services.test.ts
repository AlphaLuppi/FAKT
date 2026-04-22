import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

const SVC_ID = "33333333-3333-4333-8333-333333333333";
const SVC_ID_2 = "44444444-4444-4444-8444-444444444444";

function svcPayload(id = SVC_ID, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: "Développement React",
    description: "Implémentation UI",
    unit: "jour",
    unitPriceCents: 50000,
    tags: ["frontend", "react"],
    ...overrides,
  };
}

describe("POST /api/services", () => {
  it("201 + retourne service créé", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      unit: string;
      tags: string[] | null;
    };
    expect(body.id).toBe(SVC_ID);
    expect(body.name).toBe("Développement React");
    expect(body.tags).toEqual(["frontend", "react"]);
  });

  it("400 si id pas UUID", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload("not-a-uuid")),
    });
    expect(res.status).toBe(400);
  });

  it("400 si unit hors enum", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload(SVC_ID, { unit: "decennie" })),
    });
    expect(res.status).toBe(400);
  });

  it("400 si unitPriceCents négatif", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload(SVC_ID, { unitPriceCents: -100 })),
    });
    expect(res.status).toBe(400);
  });

  it("400 si body absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });

  it("401 sans token", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/services", {
      method: "POST",
      body: JSON.stringify(svcPayload()),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("201 sans description ni tags (defaults null)", async () => {
    const { app, authHeaders } = createTestApp();
    const payload = svcPayload();
    (payload as Record<string, unknown>).description = undefined;
    (payload as Record<string, unknown>).tags = undefined;
    const res = await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { description: string | null; tags: unknown };
    expect(body.description).toBe(null);
    expect(body.tags).toBe(null);
  });
});

describe("GET /api/services", () => {
  it("liste + pagination", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request("/api/services?limit=10&offset=0", {
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

  it("search filter sur name", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload(SVC_ID_2, { name: "Design Figma" })),
    });
    const res = await app.request("/api/services?search=React", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: { name: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toContain("React");
  });

  it("includeSoftDeleted=true inclut archivés", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    await app.request(`/api/services/${SVC_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const res = await app.request("/api/services?includeSoftDeleted=true", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: { id: string; archivedAt: number | null }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.archivedAt).not.toBe(null);
  });
});

describe("GET /api/services/:id", () => {
  it("200 si trouvé", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request(`/api/services/${SVC_ID}`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
  });

  it("404 inexistant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services/99999999-9999-4999-8999-999999999999", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("400 id pas UUID", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services/not-uuid", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/services/:id", () => {
  it("200 + champs mis à jour", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request(`/api/services/${SVC_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Nouveau nom", unitPriceCents: 60000 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; unitPriceCents: number };
    expect(body.name).toBe("Nouveau nom");
    expect(body.unitPriceCents).toBe(60000);
  });

  it("PATCH tags null clears", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request(`/api/services/${SVC_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ tags: null }),
    });
    const body = (await res.json()) as { tags: string[] | null };
    expect(body.tags).toBe(null);
  });

  it("404 si absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services/99999999-9999-4999-8999-999999999999", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });

  it("400 si body vide", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request(`/api/services/${SVC_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE + restore /api/services/:id", () => {
  it("204 + 404 re-delete + 200 restore", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const del = await app.request(`/api/services/${SVC_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(del.status).toBe(204);

    const redel = await app.request(`/api/services/${SVC_ID}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(redel.status).toBe(404);

    const restore = await app.request(`/api/services/${SVC_ID}/restore`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(restore.status).toBe(200);
    const body = (await restore.json()) as { archivedAt: number | null };
    expect(body.archivedAt).toBe(null);
  });

  it("404 restore non archivé", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request(`/api/services/${SVC_ID}/restore`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("404 restore id inexistant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services/99999999-9999-4999-8999-999999999999/restore", {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("404 DELETE id inexistant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services/99999999-9999-4999-8999-999999999999", {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/services/search", () => {
  it("200 + items", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/services", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(svcPayload()),
    });
    const res = await app.request("/api/services/search?q=React", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { name: string }[] };
    expect(body.items).toHaveLength(1);
  });

  it("400 q absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/services/search", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });
});
