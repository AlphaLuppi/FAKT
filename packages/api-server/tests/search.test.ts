import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

const CLIENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUOTE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function seed(
  app: ReturnType<typeof createTestApp>["app"],
  headers: Record<string, string>,
): Promise<void> {
  await app.request("/api/clients", {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: CLIENT_ID,
      name: "Atelier Mercier",
      email: "tom@mercier.fr",
    }),
  });
  await app.request("/api/quotes", {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: QUOTE_ID,
      clientId: CLIENT_ID,
      title: "Refonte site vitrine",
      totalHtCents: 100000,
      items: [
        {
          id: ITEM_ID,
          position: 1,
          description: "Design",
          quantity: 1000,
          unitPriceCents: 100000,
          unit: "forfait",
          lineTotalCents: 100000,
          serviceId: null,
        },
      ],
    }),
  });
}

describe("GET /api/search", () => {
  it("200 + hits agreges par query (client nom)", async () => {
    const { app, authHeaders } = createTestApp();
    await seed(app, authHeaders());

    const res = await app.request("/api/search?q=Mercier", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      q: string;
      count: number;
      clients: number;
      items: Array<{ kind: string; label: string }>;
    };
    expect(body.q).toBe("Mercier");
    expect(body.clients).toBeGreaterThanOrEqual(1);
    expect(body.items.some((h) => h.kind === "client" && h.label.includes("Mercier"))).toBe(
      true,
    );
  });

  it("200 + hits devis par titre", async () => {
    const { app, authHeaders } = createTestApp();
    await seed(app, authHeaders());

    const res = await app.request("/api/search?q=Refonte", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      quotes: number;
      items: Array<{ kind: string; label: string }>;
    };
    expect(body.quotes).toBeGreaterThanOrEqual(1);
    expect(body.items.some((h) => h.kind === "quote" && h.label.includes("Refonte"))).toBe(true);
  });

  it("200 + array vide si aucun match", async () => {
    const { app, authHeaders } = createTestApp();
    await seed(app, authHeaders());

    const res = await app.request("/api/search?q=zzz_nomatch", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; items: unknown[] };
    expect(body.count).toBe(0);
    expect(body.items).toHaveLength(0);
  });

  it("400 si q absent", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/search", { headers: authHeaders() });
    expect(res.status).toBe(400);
  });
});
