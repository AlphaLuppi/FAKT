import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

describe("auth middleware sur /api/*", () => {
  it("401 si header X-FAKT-Token absent", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/workspace");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("401 si token erroné", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/workspace", {
      headers: { "X-FAKT-Token": "wrong-token-value-1234567890" },
    });
    expect(res.status).toBe(401);
  });

  it("401 même si le token fourni est plus court (pas de fuite de longueur)", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/workspace", {
      headers: { "X-FAKT-Token": "short" },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/workspace", () => {
  it("200 + body workspace avec auth valide", async () => {
    const { app, authHeaders, workspaceId } = createTestApp();
    const res = await app.request("/api/workspace", { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; name: string };
    expect(body.id).toBe(workspaceId);
    expect(body.name).toBe("Tom Andrieu Test");
  });

  it("404 si workspace non initialisé", async () => {
    const { app, authHeaders } = createTestApp({ seedWorkspaceDefault: false });
    const res = await app.request("/api/workspace", { headers: authHeaders() });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/workspace", () => {
  it("201 à l'onboarding (aucun workspace)", async () => {
    const { app, authHeaders } = createTestApp({ seedWorkspaceDefault: false });
    const res = await app.request("/api/workspace", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: "Atelier Mercier",
        legalForm: "Micro-entreprise",
        siret: "73282932000074",
        address: "1 rue de la Paix, 84000 Avignon",
        email: "tom@example.fr",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string; tvaMention: string };
    expect(body.name).toBe("Atelier Mercier");
    expect(body.tvaMention).toMatch(/293 B/);
  });

  it("409 si workspace déjà initialisé", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: "Duplicate",
        legalForm: "Micro-entreprise",
        siret: "73282932000074",
        address: "ici",
        email: "x@y.fr",
      }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CONFLICT");
  });

  it("400 si SIRET invalide (Luhn)", async () => {
    const { app, authHeaders } = createTestApp({ seedWorkspaceDefault: false });
    const res = await app.request("/api/workspace", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: "Bad SIRET",
        legalForm: "Micro-entreprise",
        siret: "12345678901234",
        address: "adresse",
        email: "x@y.fr",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/SIRET/i);
  });

  it("400 si email invalide", async () => {
    const { app, authHeaders } = createTestApp({ seedWorkspaceDefault: false });
    const res = await app.request("/api/workspace", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: "Bad email",
        legalForm: "Micro-entreprise",
        siret: "73282932000074",
        address: "adresse",
        email: "pas-un-email",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400 si body JSON absent", async () => {
    const { app, authHeaders } = createTestApp({ seedWorkspaceDefault: false });
    const res = await app.request("/api/workspace", {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/workspace", () => {
  it("200 + nouveau nom", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Nouveau Nom" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("Nouveau Nom");
  });

  it("400 si body vide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("404 si workspace pas initialisé", async () => {
    const { app, authHeaders } = createTestApp({ seedWorkspaceDefault: false });
    const res = await app.request("/api/workspace", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.status).toBe(404);
  });

  it("200 avec legalForm=EI (statut FR post-réforme 15/05/2022)", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ legalForm: "EI" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { legalForm: string };
    expect(body.legalForm).toBe("EI");
  });
});
