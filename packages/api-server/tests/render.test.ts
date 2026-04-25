import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

/**
 * Tests de l'endpoint POST /api/render/pdf.
 *
 * On ne teste QUE la validation côté serveur ici — l'invocation Typst CLI
 * elle-même n'est pas testée (le binaire n'est pas garanti installé en CI).
 * La validation est suffisante pour s'assurer qu'aucune requête mal formée
 * ne va shell-out, ce qui est le risque sécurité principal.
 *
 * Tests E2E avec Typst CLI : à faire dans un job CI dédié avec image qui
 * a typst installé (cf. packages/api-server/Dockerfile).
 */

describe("POST /api/render/pdf — validation", () => {
  it("401 sans token (auth required)", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/render/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: "quote", dataJson: "{}" }),
    });
    expect(res.status).toBe(401);
  });

  it("400 si body JSON invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/render/pdf", {
      method: "POST",
      headers: authHeaders(),
      body: "not-json{",
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 si docType inconnu", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/render/pdf", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ docType: "purchase-order", dataJson: "{}" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 si dataJson manquant", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/render/pdf", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ docType: "quote" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 si dataJson n'est pas du JSON parsable", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/render/pdf", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ docType: "quote", dataJson: "not-valid-json{" }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.message).toMatch(/JSON/i);
  });

  it("accepte docType=quote et docType=invoice (validation passe)", async () => {
    // On ne vérifie pas la 200 : Typst peut ne pas être installé, ce qui
    // donnerait 500 BinaryNotFound. On vérifie juste que la validation laisse passer.
    const { app, authHeaders } = createTestApp();
    for (const docType of ["quote", "invoice"]) {
      const res = await app.request("/api/render/pdf", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ docType, dataJson: '{"kind":"' + docType + '"}' }),
      });
      // 200 si Typst dispo, 500 sinon (BinaryNotFound) — pas 400.
      expect([200, 500]).toContain(res.status);
    }
  });
});
