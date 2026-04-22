/**
 * Cycle complet de vie d'un devis : draft → sent → signed → invoiced,
 * et transitions invalides → 422.
 */

import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

const CLIENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const QUOTE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ITEM_ID = "11111111-2222-4333-8444-555555555555";

async function setup() {
  const { app, authHeaders } = createTestApp();
  await app.request("/api/clients", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id: CLIENT_ID, name: "Client X", email: "x@test.fr" }),
  });
  await app.request("/api/quotes", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      id: QUOTE_ID,
      clientId: CLIENT_ID,
      title: "Cycle test",
      totalHtCents: 100000,
      items: [
        {
          id: ITEM_ID,
          position: 1,
          description: "Prestation",
          quantity: 1000,
          unitPriceCents: 100000,
          unit: "forfait",
          lineTotalCents: 100000,
          serviceId: null,
        },
      ],
    }),
  });
  return { app, authHeaders };
}

describe("Quote lifecycle", () => {
  it("draft → sent (issue attribue numéro)", async () => {
    const { app, authHeaders } = await setup();
    const res = await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      number: string | null;
      year: number | null;
      sequence: number | null;
      issuedAt: number | null;
    };
    expect(body.status).toBe("sent");
    expect(body.number).toMatch(/^D\d{4}-001$/);
    expect(body.sequence).toBe(1);
    expect(body.issuedAt).not.toBe(null);
  });

  it("sent → signed (mark-signed set signedAt)", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/mark-signed`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; signedAt: number | null };
    expect(body.status).toBe("signed");
    expect(body.signedAt).not.toBe(null);
  });

  it("signed → invoiced", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    await app.request(`/api/quotes/${QUOTE_ID}/mark-signed`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/mark-invoiced`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("invoiced");
  });

  it("sent → expired", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/expire`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("expired");
  });

  it("sent → refused (cancel)", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("refused");
  });
});

describe("Quote lifecycle — transitions invalides (422)", () => {
  it("issue sur quote déjà sent → 422", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  it("mark-signed sur draft → 422", async () => {
    const { app, authHeaders } = await setup();
    const res = await app.request(`/api/quotes/${QUOTE_ID}/mark-signed`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
  });

  it("mark-invoiced sur draft → 422", async () => {
    const { app, authHeaders } = await setup();
    const res = await app.request(`/api/quotes/${QUOTE_ID}/mark-invoiced`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
  });

  it("expire sur draft → 422", async () => {
    const { app, authHeaders } = await setup();
    const res = await app.request(`/api/quotes/${QUOTE_ID}/expire`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
  });

  it("cancel signed → 422 (pas de transition signed→refused)", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    await app.request(`/api/quotes/${QUOTE_ID}/mark-signed`, {
      method: "POST",
      headers: authHeaders(),
    });
    const res = await app.request(`/api/quotes/${QUOTE_ID}/cancel`, {
      method: "POST",
      headers: authHeaders(),
    });
    expect(res.status).toBe(422);
  });

  it("issue sur quote absent → 404", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request(
      "/api/quotes/99999999-9999-4999-8999-999999999999/issue",
      { method: "POST", headers: authHeaders() }
    );
    expect(res.status).toBe(404);
  });
});

describe("Quote lifecycle — numérotation par issue", () => {
  it("2 quotes issues → sequences 1 et 2", async () => {
    const { app, authHeaders } = await setup();
    await app.request(`/api/quotes/${QUOTE_ID}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });

    const Q2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const I2 = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
    await app.request("/api/quotes", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: Q2,
        clientId: CLIENT_ID,
        title: "Q2",
        totalHtCents: 50000,
        items: [
          {
            id: I2,
            position: 1,
            description: "x",
            quantity: 1000,
            unitPriceCents: 50000,
            unit: "forfait",
            lineTotalCents: 50000,
            serviceId: null,
          },
        ],
      }),
    });
    const res = await app.request(`/api/quotes/${Q2}/issue`, {
      method: "POST",
      headers: authHeaders(),
    });
    const body = (await res.json()) as { number: string | null; sequence: number | null };
    expect(body.sequence).toBe(2);
    expect(body.number).toMatch(/^D\d{4}-002$/);
  });
});
