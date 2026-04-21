/**
 * Test critique (CGI art. 289) : numérotation séquentielle facture sans trou.
 * Simule 10 créations consécutives et vérifie F{YYYY}-001 à F{YYYY}-010.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  formatInvoiceNumber,
  isValidInvoiceNumber,
  parseDocumentNumber,
} from "@fakt/core";
import { invoiceApi } from "../../features/doc-editor/index.js";
import { installInvoiceMockApis } from "./__test-helpers__/mockInvoiceApis.js";

describe("Numérotation facture séquentielle CGI art. 289", () => {
  let mocks: ReturnType<typeof installInvoiceMockApis>;

  beforeEach(() => {
    mocks = installInvoiceMockApis();
  });

  afterEach(() => {
    mocks.reset();
  });

  it("formate les numéros sur 3 chiffres (F2026-001)", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("F2026-001");
    expect(formatInvoiceNumber(2026, 10)).toBe("F2026-010");
    expect(formatInvoiceNumber(2026, 123)).toBe("F2026-123");
  });

  it("10 créations consécutives produisent F2026-001 à F2026-010 sans trou", async () => {
    const expected: string[] = [];
    const year = new Date().getFullYear();

    for (let i = 1; i <= 10; i++) {
      const created = await invoiceApi.create({
        clientId: "client-1",
        kind: "independent",
        title: `Facture ${i}`,
        totalHtCents: 10000,
        legalMentions: "TVA non applicable, art. 293 B du CGI",
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
      expected.push(formatInvoiceNumber(year, i));
      expect(created.number).toBe(expected[i - 1]);
    }

    const all = await invoiceApi.list();
    const numbers = all
      .map((inv) => inv.number)
      .filter((n): n is string => n !== null)
      .sort();
    expect(numbers).toHaveLength(10);
    expect(numbers).toEqual(expected);
  });

  it("validation du format des numéros facture", () => {
    expect(isValidInvoiceNumber("F2026-001")).toBe(true);
    expect(isValidInvoiceNumber("F2026-042")).toBe(true);
    expect(isValidInvoiceNumber("D2026-001")).toBe(false);
    expect(isValidInvoiceNumber("F26-001")).toBe(false);
  });

  it("parse correctement année + séquence facture", () => {
    const parsed = parseDocumentNumber("F2026-042");
    expect(parsed).toEqual({ year: 2026, sequence: 42 });
  });

  it("les drafts ne reçoivent PAS de numéro (pas de trou au brouillon)", async () => {
    const draft = await invoiceApi.create({
      clientId: "client-1",
      kind: "independent",
      title: "Draft",
      totalHtCents: 0,
      legalMentions: "TVA non applicable, art. 293 B du CGI",
      items: [],
      issueNumber: false,
    });
    expect(draft.number).toBeNull();
    expect(draft.sequence).toBeNull();

    const issued = await invoiceApi.create({
      clientId: "client-1",
      kind: "independent",
      title: "Issued",
      totalHtCents: 10000,
      legalMentions: "TVA non applicable, art. 293 B du CGI",
      items: [],
      issueNumber: true,
    });
    const parsed = parseDocumentNumber(issued.number ?? "");
    expect(parsed?.sequence).toBe(1);
  });
});
