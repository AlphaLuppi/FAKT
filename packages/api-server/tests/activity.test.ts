import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

const EV_ID_1 = "aaaaaaaa-0000-4000-8000-000000000001";
const EV_ID_2 = "aaaaaaaa-0000-4000-8000-000000000002";
const ENTITY_ID = "bbbbbbbb-0000-4000-8000-000000000001";

function eventPayload(id = EV_ID_1, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "email.drafted",
    entityType: "invoice",
    entityId: ENTITY_ID,
    payload: JSON.stringify({ to: "alice@acme.fr" }),
    ...overrides,
  };
}

describe("POST /api/activity", () => {
  it("201 + retourne l'event créé", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload()),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; type: string };
    expect(body.id).toBe(EV_ID_1);
    expect(body.type).toBe("email.drafted");
  });

  it("400 si id pas un UUID", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload("not-uuid")),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/activity", () => {
  it("liste ordre desc createdAt", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload()),
    });
    await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload(EV_ID_2, { type: "client.created" })),
    });

    const res = await app.request("/api/activity", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string; type: string }[];
      pagination: { count: number };
    };
    expect(body.items).toHaveLength(2);
    expect(body.pagination.count).toBe(2);
  });

  it("filtre par entityType", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload()),
    });
    await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload(EV_ID_2, { entityType: "client" })),
    });

    const res = await app.request("/api/activity?entityType=invoice", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: { entityType: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.entityType).toBe("invoice");
  });

  it("filtre par type + entityId", async () => {
    const { app, authHeaders } = createTestApp();
    const OTHER_ENTITY = "bbbbbbbb-0000-4000-8000-000000000002";
    await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventPayload()),
    });
    await app.request("/api/activity", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(
        eventPayload(EV_ID_2, {
          type: "client.created",
          entityType: "client",
          entityId: OTHER_ENTITY,
        })
      ),
    });

    const r1 = await app.request("/api/activity?type=email.drafted", {
      headers: authHeaders(),
    });
    const b1 = (await r1.json()) as { items: { type: string }[] };
    expect(b1.items).toHaveLength(1);
    expect(b1.items[0]?.type).toBe("email.drafted");

    const r2 = await app.request(`/api/activity?entityId=${ENTITY_ID}`, {
      headers: authHeaders(),
    });
    const b2 = (await r2.json()) as { items: { entityId: string }[] };
    expect(b2.items).toHaveLength(1);
    expect(b2.items[0]?.entityId).toBe(ENTITY_ID);
  });

  it("pagination limit/offset", async () => {
    const { app, authHeaders } = createTestApp();
    for (let i = 0; i < 3; i++) {
      const id = `cccccccc-0000-4000-8000-00000000000${i}`;
      await app.request("/api/activity", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(eventPayload(id)),
      });
    }
    const res = await app.request("/api/activity?limit=2&offset=0", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);
  });

  it("400 si limit > 200", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/activity?limit=999", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});
