import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { createTestApp } from "./helpers.js";

const QUOTE_ID = "00000000-0000-4000-8000-000000000abc";
const EV_ID_1 = "eeeeeeee-0000-4000-8000-000000000001";
const EV_ID_2 = "eeeeeeee-0000-4000-8000-000000000002";
const EV_ID_3 = "eeeeeeee-0000-4000-8000-000000000003";
const DOC_ID = "ffffffff-0000-4000-8000-000000000001";
const EVENT_LINK_ID = "ffffffff-0000-4000-8000-000000000010";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// Canonicalisation identique à la route (ordre alphabétique, null explicites)
function serializeEvent(e: {
  id: string;
  documentType: string;
  documentId: string;
  signerName: string;
  signerEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: number;
  docHashBefore: string;
  docHashAfter: string;
  signaturePngBase64: string;
  tsaProvider: string | null;
  tsaResponse: string | null;
}): string {
  return JSON.stringify({
    docHashAfter: e.docHashAfter,
    docHashBefore: e.docHashBefore,
    documentId: e.documentId,
    documentType: e.documentType,
    id: e.id,
    ipAddress: e.ipAddress,
    signaturePngBase64: e.signaturePngBase64,
    signerEmail: e.signerEmail,
    signerName: e.signerName,
    timestamp: e.timestamp,
    tsaProvider: e.tsaProvider,
    tsaResponse: e.tsaResponse,
    userAgent: e.userAgent,
  });
}

function eventBody(id: string, ts: number, prevHash: string | null, hashAfter?: string) {
  return {
    id,
    documentType: "quote" as const,
    documentId: QUOTE_ID,
    signerName: "Alice Dupont",
    signerEmail: "alice@test.fr",
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    timestamp: ts,
    docHashBefore: "0".repeat(64),
    docHashAfter: hashAfter ?? "a".repeat(64),
    signaturePngBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    previousEventHash: prevHash,
    tsaProvider: null,
    tsaResponse: null,
  };
}

describe("POST /api/signature-events", () => {
  it("201 + retourne l'event append-only", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EV_ID_1, 1_700_000_000_000, null)),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; previousEventHash: string | null };
    expect(body.id).toBe(EV_ID_1);
    expect(body.previousEventHash).toBeNull();
  });

  it("400 si docHashAfter pas 64 chars hex", async () => {
    const { app, authHeaders } = createTestApp();
    const bad = { ...eventBody(EV_ID_1, 1, null), docHashAfter: "abc" };
    const res = await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(bad),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/signature-events", () => {
  it("retourne la chaîne ordonnée par timestamp asc", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EV_ID_2, 2_000, null)),
    });
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EV_ID_1, 1_000, null)),
    });

    const res = await app.request(
      `/api/signature-events?documentType=quote&documentId=${QUOTE_ID}`,
      { headers: authHeaders() }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: { id: string; timestamp: number }[] };
    expect(body.events).toHaveLength(2);
    expect(body.events[0]?.timestamp).toBe(1000);
    expect(body.events[1]?.timestamp).toBe(2000);
  });

  it("400 si documentType invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(
      `/api/signature-events?documentType=wrong&documentId=${QUOTE_ID}`,
      { headers: authHeaders() }
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/signature-events/verify — chaîne SHA-256", () => {
  it("chainOk=true si tous les previousEventHash correspondent", async () => {
    const { app, authHeaders } = createTestApp();
    const e1 = eventBody(EV_ID_1, 1000, null);
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(e1),
    });

    // hash(e1) = previousEventHash de e2
    const h1 = sha256Hex(serializeEvent(e1));
    const e2 = eventBody(EV_ID_2, 2000, h1);
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(e2),
    });

    const h2 = sha256Hex(serializeEvent(e2));
    const e3 = eventBody(EV_ID_3, 3000, h2);
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(e3),
    });

    const res = await app.request(
      `/api/signature-events/verify?documentType=quote&documentId=${QUOTE_ID}`,
      { headers: authHeaders() }
    );
    const body = (await res.json()) as {
      chainOk: boolean;
      chainLength: number;
      brokenChainIndices: number[];
    };
    expect(body.chainOk).toBe(true);
    expect(body.chainLength).toBe(3);
    expect(body.brokenChainIndices).toEqual([]);
  });

  it("chainOk=false si un previousEventHash est incorrect (tampered)", async () => {
    const { app, authHeaders } = createTestApp();
    const e1 = eventBody(EV_ID_1, 1000, null);
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(e1),
    });

    // hash arbitraire ne correspondant pas à hash(e1)
    const fakeHash = "f".repeat(64);
    const e2 = eventBody(EV_ID_2, 2000, fakeHash);
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(e2),
    });

    const res = await app.request(
      `/api/signature-events/verify?documentType=quote&documentId=${QUOTE_ID}`,
      { headers: authHeaders() }
    );
    const body = (await res.json()) as {
      chainOk: boolean;
      chainLength: number;
      brokenChainIndices: number[];
    };
    expect(body.chainOk).toBe(false);
    expect(body.chainLength).toBe(2);
    expect(body.brokenChainIndices).toEqual([1]);
  });

  it("chainOk=true si aucun event (chainLength=0)", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(
      `/api/signature-events/verify?documentType=quote&documentId=${QUOTE_ID}`,
      { headers: authHeaders() }
    );
    const body = (await res.json()) as {
      chainOk: boolean;
      chainLength: number;
    };
    expect(body.chainOk).toBe(true);
    expect(body.chainLength).toBe(0);
  });
});

describe("Append-only trigger enforcement — signature_events", () => {
  it("sqlite.prepare('UPDATE signature_events ...') est bloqué par le trigger SQL", async () => {
    const { app, authHeaders, sqlite } = createTestApp();
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EV_ID_1, 1000, null)),
    });

    expect(() =>
      sqlite
        .prepare("UPDATE signature_events SET signer_name = 'tampered' WHERE id = ?")
        .run(EV_ID_1)
    ).toThrow(/append-only/i);
  });

  it("sqlite.prepare('DELETE FROM signature_events ...') est bloqué par le trigger SQL", async () => {
    const { app, authHeaders, sqlite } = createTestApp();
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EV_ID_1, 1000, null)),
    });

    expect(() =>
      sqlite.prepare("DELETE FROM signature_events WHERE id = ?").run(EV_ID_1)
    ).toThrow(/append-only/i);
  });
});

describe("signed-documents", () => {
  it("POST /api/signed-documents (upsert) + GET /api/signed-documents/:type/:id", async () => {
    const { app, authHeaders } = createTestApp();

    // Prérequis : un event de signature existe (FK morale dans l'appli)
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EVENT_LINK_ID, 5000, null)),
    });

    const payload = {
      documentType: "quote",
      documentId: DOC_ID,
      path: "/home/user/.fakt/signed/abc.pdf",
      padesLevel: "B-T",
      tsaProvider: "freetsa.org",
      signedAt: 5000,
      signatureEventId: EVENT_LINK_ID,
    };
    const upsert = await app.request("/api/signed-documents", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    expect(upsert.status).toBe(201);

    const get = await app.request(`/api/signed-documents/quote/${DOC_ID}`, {
      headers: authHeaders(),
    });
    expect(get.status).toBe(200);
    const body = (await get.json()) as { padesLevel: string; tsaProvider: string | null };
    expect(body.padesLevel).toBe("B-T");
    expect(body.tsaProvider).toBe("freetsa.org");
  });

  it("POST /api/signed-documents deux fois = update (upsert)", async () => {
    const { app, authHeaders } = createTestApp();
    await app.request("/api/signature-events", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(eventBody(EVENT_LINK_ID, 5000, null)),
    });

    const base = {
      documentType: "quote",
      documentId: DOC_ID,
      path: "/old/path.pdf",
      padesLevel: "B",
      signedAt: 5000,
      signatureEventId: EVENT_LINK_ID,
    };
    await app.request("/api/signed-documents", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(base),
    });
    const r2 = await app.request("/api/signed-documents", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...base, path: "/new/path.pdf", padesLevel: "B-T" }),
    });
    expect(r2.status).toBe(201);

    const get = await app.request(`/api/signed-documents/quote/${DOC_ID}`, {
      headers: authHeaders(),
    });
    const body = (await get.json()) as { path: string; padesLevel: string };
    expect(body.path).toBe("/new/path.pdf");
    expect(body.padesLevel).toBe("B-T");
  });

  it("GET /api/signed-documents/:type/:id → 404 si aucun", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(`/api/signed-documents/quote/${DOC_ID}`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/signed-documents/:type/:id → 400 si type invalide", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(`/api/signed-documents/wrong/${DOC_ID}`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });
});
