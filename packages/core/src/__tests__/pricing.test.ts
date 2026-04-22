import type { DocumentLine } from "@fakt/shared";
import { describe, expect, it } from "vitest";
import {
  checkTotalConsistency,
  computeBalanceAmount,
  computeDepositAmount,
  computeLineTotal,
  computeLinesTotal,
} from "../pricing/compute.js";

const makeLine = (
  quantity: number,
  unitPriceCents: number,
  overrides: Partial<DocumentLine> = {}
): DocumentLine => ({
  id: "00000000-0000-0000-0000-000000000001",
  position: 0,
  description: "Test ligne",
  quantity,
  unitPriceCents,
  unit: "forfait",
  lineTotalCents: computeLineTotal(quantity, unitPriceCents),
  serviceId: null,
  ...overrides,
});

describe("computeLineTotal", () => {
  it("calcule correctement un forfait entier", () => {
    // 1 forfait × 1000€ = 1000€
    expect(computeLineTotal(1000, 100000)).toBe(100000);
  });

  it("calcule correctement une quantité décimale", () => {
    // 1.5 jours × 500€ = 750€
    expect(computeLineTotal(1500, 50000)).toBe(75000);
  });

  it("arrondit correctement au centime", () => {
    // 1.333 × 100 = 133.3 → 133 centimes
    expect(computeLineTotal(1333, 100)).toBe(133);
  });

  it("retourne 0 pour une quantité nulle", () => {
    expect(computeLineTotal(0, 100000)).toBe(0);
  });

  it("gère les montants en centimes", () => {
    // 2 heures × 80€/h = 160€ = 16000 centimes
    expect(computeLineTotal(2000, 8000)).toBe(16000);
  });
});

describe("computeLinesTotal", () => {
  it("calcule la somme de plusieurs lignes", () => {
    const lines: DocumentLine[] = [
      makeLine(1000, 100000), // 1000€
      makeLine(2000, 50000), // 1000€
      makeLine(500, 80000), // 400€
    ];
    expect(computeLinesTotal(lines)).toBe(240000); // 2400€
  });

  it("retourne 0 pour une liste vide", () => {
    expect(computeLinesTotal([])).toBe(0);
  });

  it("calcule correctement une seule ligne", () => {
    const lines: DocumentLine[] = [makeLine(1000, 50000)];
    expect(computeLinesTotal(lines)).toBe(50000);
  });
});

describe("computeDepositAmount", () => {
  it("calcule 30% d'acompte correctement", () => {
    // 30% de 5000€ = 1500€ = 150000 centimes
    expect(computeDepositAmount(500000, 30)).toBe(150000);
  });

  it("calcule 50% d'acompte", () => {
    expect(computeDepositAmount(200000, 50)).toBe(100000);
  });

  it("arrondit à l'inférieur (conservateur)", () => {
    // 30% de 1333 = 399.9 → 399 (floor)
    expect(computeDepositAmount(1333, 30)).toBe(399);
  });

  it("calcule 0%", () => {
    expect(computeDepositAmount(100000, 0)).toBe(0);
  });

  it("calcule 100%", () => {
    expect(computeDepositAmount(100000, 100)).toBe(100000);
  });

  it("lève une erreur si le pourcentage est invalide", () => {
    expect(() => computeDepositAmount(100000, -1)).toThrow(RangeError);
    expect(() => computeDepositAmount(100000, 101)).toThrow(RangeError);
  });
});

describe("computeBalanceAmount", () => {
  it("calcule correctement le solde", () => {
    expect(computeBalanceAmount(500000, 150000)).toBe(350000);
  });

  it("retourne 0 si l'acompte est égal au total", () => {
    expect(computeBalanceAmount(100000, 100000)).toBe(0);
  });

  it("lève une erreur si l'acompte excède le total", () => {
    expect(() => computeBalanceAmount(100000, 100001)).toThrow(RangeError);
  });
});

describe("checkTotalConsistency", () => {
  it("retourne 0 si le total stocké est cohérent", () => {
    const lines: DocumentLine[] = [makeLine(1000, 100000)];
    expect(checkTotalConsistency(100000, lines)).toBe(0);
  });

  it("retourne le delta positif si le total stocké est trop bas", () => {
    const lines: DocumentLine[] = [makeLine(1000, 100000)];
    expect(checkTotalConsistency(90000, lines)).toBe(10000);
  });

  it("retourne le delta négatif si le total stocké est trop haut", () => {
    const lines: DocumentLine[] = [makeLine(1000, 100000)];
    expect(checkTotalConsistency(110000, lines)).toBe(-10000);
  });
});
