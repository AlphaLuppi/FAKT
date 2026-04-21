import { describe, it, expect } from "vitest";
import {
  formatQuoteNumber,
  formatInvoiceNumber,
  isValidQuoteNumber,
  isValidInvoiceNumber,
  parseDocumentNumber,
} from "../numbering/format.js";

describe("formatQuoteNumber", () => {
  it("formate correctement un numéro de devis", () => {
    expect(formatQuoteNumber(2026, 1)).toBe("D2026-001");
    expect(formatQuoteNumber(2026, 42)).toBe("D2026-042");
    expect(formatQuoteNumber(2026, 999)).toBe("D2026-999");
    expect(formatQuoteNumber(2026, 1000)).toBe("D2026-1000");
  });

  it("gère les années différentes", () => {
    expect(formatQuoteNumber(2027, 1)).toBe("D2027-001");
  });
});

describe("formatInvoiceNumber", () => {
  it("formate correctement un numéro de facture", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("F2026-001");
    expect(formatInvoiceNumber(2026, 100)).toBe("F2026-100");
  });
});

describe("isValidQuoteNumber", () => {
  it("valide les numéros de devis corrects", () => {
    expect(isValidQuoteNumber("D2026-001")).toBe(true);
    expect(isValidQuoteNumber("D2026-042")).toBe(true);
    expect(isValidQuoteNumber("D2026-1000")).toBe(true);
  });

  it("rejette les numéros de devis invalides", () => {
    expect(isValidQuoteNumber("F2026-001")).toBe(false);
    expect(isValidQuoteNumber("D2026")).toBe(false);
    expect(isValidQuoteNumber("D26-001")).toBe(false);
    expect(isValidQuoteNumber("")).toBe(false);
    expect(isValidQuoteNumber("D2026-01")).toBe(false);
  });
});

describe("isValidInvoiceNumber", () => {
  it("valide les numéros de facture corrects", () => {
    expect(isValidInvoiceNumber("F2026-001")).toBe(true);
    expect(isValidInvoiceNumber("F2026-999")).toBe(true);
  });

  it("rejette les numéros de facture invalides", () => {
    expect(isValidInvoiceNumber("D2026-001")).toBe(false);
    expect(isValidInvoiceNumber("F2026-01")).toBe(false);
  });
});

describe("parseDocumentNumber", () => {
  it("extrait année et séquence d'un numéro de devis", () => {
    expect(parseDocumentNumber("D2026-042")).toEqual({ year: 2026, sequence: 42 });
    expect(parseDocumentNumber("F2026-001")).toEqual({ year: 2026, sequence: 1 });
  });

  it("retourne null pour un format invalide", () => {
    expect(parseDocumentNumber("invalid")).toBeNull();
    expect(parseDocumentNumber("")).toBeNull();
    expect(parseDocumentNumber("D2026")).toBeNull();
  });
});
