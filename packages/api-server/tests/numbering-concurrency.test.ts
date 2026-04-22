/**
 * Test bloquant CGI art. 289 : 100 appels POST /api/numbering/next en parallèle
 * doivent produire les séquences 1..100 sans trou ni doublon.
 *
 * Repose sur BEGIN IMMEDIATE SQLite (nextNumberAtomic dans queries/numbering.ts).
 * Si un agent modifie le code-path pour lire last_sequence hors transaction, ce test casse.
 */

import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

describe("POST /api/numbering/next — concurrence 100× parallèles (CGI art. 289)", () => {
  it("100 appels parallèles → séquences 1..100 uniques et contiguës", async () => {
    const { app, authHeaders } = createTestApp();

    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        app.request("/api/numbering/next", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ type: "quote" }),
        })
      )
    );

    for (const r of responses) {
      expect(r.status).toBe(200);
    }

    const payloads = (await Promise.all(responses.map((r) => r.json()))) as Array<{
      sequence: number;
      formatted: string;
      year: number;
    }>;

    const sequences = payloads.map((p) => p.sequence);
    const uniq = new Set(sequences);

    expect(uniq.size).toBe(100);
    expect(Math.min(...sequences)).toBe(1);
    expect(Math.max(...sequences)).toBe(100);

    const sorted = [...sequences].sort((a, b) => a - b);
    for (let i = 0; i < 100; i++) {
      expect(sorted[i]).toBe(i + 1);
    }

    const years = new Set(payloads.map((p) => p.year));
    expect(years.size).toBe(1);
  });

  it("500 appels parallèles quote+invoice mixés → séquences distinctes par type", async () => {
    const { app, authHeaders } = createTestApp();

    const mix = Array.from({ length: 500 }, (_, i) => ({
      type: i % 2 === 0 ? "quote" : "invoice",
    }));

    const responses = await Promise.all(
      mix.map((body) =>
        app.request("/api/numbering/next", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        })
      )
    );

    const payloads = (await Promise.all(responses.map((r) => r.json()))) as Array<{
      sequence: number;
      formatted: string;
    }>;

    const qSeqs = payloads
      .filter((_, i) => i % 2 === 0)
      .map((p) => p.sequence);
    const iSeqs = payloads
      .filter((_, i) => i % 2 === 1)
      .map((p) => p.sequence);

    expect(new Set(qSeqs).size).toBe(250);
    expect(new Set(iSeqs).size).toBe(250);
  });
});
