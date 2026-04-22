/**
 * Test critique (CGI art. 289) : numérotation séquentielle sans trou.
 * Simule 10 créations consécutives et vérifie D{YYYY}-001 à D{YYYY}-010.
 */

import { formatQuoteNumber, isValidQuoteNumber, parseDocumentNumber } from "@fakt/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { quotesApi } from "../../features/doc-editor/index.js";
import { installMockApis } from "./__test-helpers__/mockApis.js";

describe("Numérotation séquentielle CGI art. 289", () => {
  let mocks: ReturnType<typeof installMockApis>;

  beforeEach(() => {
    mocks = installMockApis();
  });

  afterEach(() => {
    mocks.reset();
  });

  it("formate les numéros sur 3 chiffres (D2026-001)", () => {
    expect(formatQuoteNumber(2026, 1)).toBe("D2026-001");
    expect(formatQuoteNumber(2026, 10)).toBe("D2026-010");
    expect(formatQuoteNumber(2026, 123)).toBe("D2026-123");
  });

  it("10 créations consécutives produisent des numéros sans trou", async () => {
    const expected: string[] = [];
    const year = new Date().getFullYear();

    for (let i = 1; i <= 10; i++) {
      const created = await quotesApi.create({
        clientId: "client-1",
        title: `Devis ${i}`,
        conditions: null,
        validityDate: null,
        notes: null,
        totalHtCents: 10000,
        items: [
          {
            id: `item-${i}`,
            position: 0,
            description: "Test",
            quantity: 1000,
            unitPriceCents: 10000,
            unit: "jour",
            lineTotalCents: 10000,
            serviceId: null,
          },
        ],
        issueNumber: true,
      });
      expect(created.number).not.toBeNull();
      expected.push(formatQuoteNumber(year, i));
      expect(created.number).toBe(expected[i - 1]);
    }

    const all = await quotesApi.list();
    const numbers = all
      .map((q) => q.number)
      .filter((n): n is string => n !== null)
      .sort();
    expect(numbers).toHaveLength(10);
    expect(numbers).toEqual(expected);
  });

  it("validation du format des numéros", () => {
    expect(isValidQuoteNumber("D2026-001")).toBe(true);
    expect(isValidQuoteNumber("D2026-042")).toBe(true);
    expect(isValidQuoteNumber("F2026-001")).toBe(false);
    expect(isValidQuoteNumber("D26-001")).toBe(false);
    expect(isValidQuoteNumber("2026-001")).toBe(false);
  });

  it("parse correctement année + séquence", () => {
    const parsed = parseDocumentNumber("D2026-042");
    expect(parsed).toEqual({ year: 2026, sequence: 42 });
  });

  it("les drafts ne reçoivent PAS de numéro (pas de trou au brouillon)", async () => {
    const draft = await quotesApi.create({
      clientId: "client-1",
      title: "Draft",
      conditions: null,
      validityDate: null,
      notes: null,
      totalHtCents: 0,
      items: [],
      issueNumber: false,
    });
    expect(draft.number).toBeNull();
    expect(draft.sequence).toBeNull();

    // Créer un vrai devis derrière : doit obtenir séquence = 1, pas 2.
    const issued = await quotesApi.create({
      clientId: "client-1",
      title: "Issued",
      conditions: null,
      validityDate: null,
      notes: null,
      totalHtCents: 10000,
      items: [],
      issueNumber: true,
    });
    const parsed = parseDocumentNumber(issued.number ?? "");
    expect(parsed?.sequence).toBe(1);
  });
});
