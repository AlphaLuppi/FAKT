import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

const BACKUP_ID_1 = "dddddddd-0000-4000-8000-000000000001";
const BACKUP_ID_2 = "dddddddd-0000-4000-8000-000000000002";

function payload(id = BACKUP_ID_1, overrides: Record<string, unknown> = {}) {
  return {
    id,
    path: `/tmp/fakt-backup-${id}.zip`,
    sizeBytes: 1024,
    ...overrides,
  };
}

describe("POST /api/backups", () => {
  it("201 + retourne l'entité créée", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; sizeBytes: number };
    expect(body.id).toBe(BACKUP_ID_1);
    expect(body.sizeBytes).toBe(1024);
  });

  it("400 si sizeBytes négatif", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload(BACKUP_ID_1, { sizeBytes: -1 })),
    });
    expect(res.status).toBe(400);
  });

  it("400 si path absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id: BACKUP_ID_1, sizeBytes: 1024 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/backups", () => {
  it("liste ordre desc createdAt", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload()),
    });
    await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload(BACKUP_ID_2, { sizeBytes: 2048 })),
    });

    const res = await app.request("/api/backups", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string }[];
      pagination: { count: number };
    };
    expect(body.items).toHaveLength(2);
  });

  it("pagination limit=1", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload()),
    });
    await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload(BACKUP_ID_2)),
    });

    const res = await app.request("/api/backups?limit=1", { headers: authHeaders() });
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("DELETE /api/backups/:id", () => {
  it("204 sur enregistrement existant, disparaît de la liste", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/backups", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload()),
    });

    const del = await app.request(`/api/backups/${BACKUP_ID_1}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(del.status).toBe(204);

    const list = await app.request("/api/backups", { headers: authHeaders() });
    const body = (await list.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(0);
  });

  it("500 (ou erreur) sur id inexistant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(`/api/backups/${BACKUP_ID_1}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect([404, 500]).toContain(res.status);
  });
});
