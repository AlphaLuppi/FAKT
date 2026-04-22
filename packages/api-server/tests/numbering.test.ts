import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

describe("GET /api/numbering/peek", () => {
  it("200 + séquence 1 sur premier appel (quote)", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/numbering/peek?type=quote", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      year: number;
      sequence: number;
      formatted: string;
    };
    expect(body.sequence).toBe(1);
    expect(body.formatted).toMatch(/^D\d{4}-001$/);
  });

  it("200 + séquence 1 invoice", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/numbering/peek?type=invoice", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { formatted: string; sequence: number };
    expect(body.formatted).toMatch(/^F\d{4}-001$/);
    expect(body.sequence).toBe(1);
  });

  it("peek ne modifie PAS la séquence", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/numbering/peek?type=quote", { headers: authHeaders() });
    await app.request("/api/numbering/peek?type=quote", { headers: authHeaders() });
    const res = await app.request("/api/numbering/peek?type=quote", {
      headers: authHeaders(),
    });
    const body = (await res.json()) as { sequence: number };
    expect(body.sequence).toBe(1);
  });

  it("400 si type absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/numbering/peek", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });

  it("400 si type invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/numbering/peek?type=bogus", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });

  it("401 sans token", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/numbering/peek?type=quote");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/numbering/next", () => {
  it("200 + incrémente séquence (quote)", async () => {
    const { app, authHeaders } = createTestApp();
    const r1 = await app.request("/api/numbering/next", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type: "quote" }),
    });
    expect(r1.status).toBe(200);
    const b1 = (await r1.json()) as { sequence: number; formatted: string };
    expect(b1.sequence).toBe(1);
    expect(b1.formatted).toMatch(/^D\d{4}-001$/);

    const r2 = await app.request("/api/numbering/next", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type: "quote" }),
    });
    const b2 = (await r2.json()) as { sequence: number; formatted: string };
    expect(b2.sequence).toBe(2);
    expect(b2.formatted).toMatch(/^D\d{4}-002$/);
  });

  it("séquences quote et invoice indépendantes", async () => {
    const { app, authHeaders } = createTestApp();
    const rq = await app.request("/api/numbering/next", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type: "quote" }),
    });
    const ri = await app.request("/api/numbering/next", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type: "invoice" }),
    });
    const bq = (await rq.json()) as { sequence: number };
    const bi = (await ri.json()) as { sequence: number };
    expect(bq.sequence).toBe(1);
    expect(bi.sequence).toBe(1);
  });

  it("400 body invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/numbering/next", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("400 type invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/numbering/next", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type: "neither" }),
    });
    expect(res.status).toBe(400);
  });

  it("401 sans token", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/numbering/next", {
      method: "POST",
      body: JSON.stringify({ type: "quote" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });
});
