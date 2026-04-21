import { describe, it, expect } from "vitest";
import {
  computeInvoiceTotal,
  computeDepositAmount,
  computeBalanceAmount,
  checkTotalConsistency,
} from "@fakt/core";

describe("computeInvoiceTotal et helpers acompte/solde", () => {
  const baseItems = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      position: 0,
      description: "L1",
      quantity: 1000,
      unitPriceCents: 50000,
      unit: "jour" as const,
      lineTotalCents: 50000,
      serviceId: null,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      position: 1,
      description: "L2",
      quantity: 2000,
      unitPriceCents: 30000,
      unit: "jour" as const,
      lineTotalCents: 60000,
      serviceId: null,
    },
  ];

  it("computeInvoiceTotal somme les lineTotalCents", () => {
    expect(computeInvoiceTotal({ items: baseItems })).toBe(110000);
  });

  it("computeInvoiceTotal retourne 0 pour items vides", () => {
    expect(computeInvoiceTotal({ items: [] })).toBe(0);
  });

  it("computeDepositAmount 30% = floor(total*30/100)", () => {
    expect(computeDepositAmount(110000, 30)).toBe(33000);
    expect(computeDepositAmount(12345, 30)).toBe(3703); // floor
  });

  it("computeDepositAmount throw si percent hors bornes", () => {
    expect(() => computeDepositAmount(100, -1)).toThrow(RangeError);
    expect(() => computeDepositAmount(100, 101)).toThrow(RangeError);
  });

  it("computeBalanceAmount = total - acompte", () => {
    expect(computeBalanceAmount(100000, 30000)).toBe(70000);
  });

  it("computeBalanceAmount throw si acompte > total", () => {
    expect(() => computeBalanceAmount(100, 200)).toThrow(RangeError);
  });

  it("checkTotalConsistency retourne le delta", () => {
    expect(checkTotalConsistency(110000, baseItems)).toBe(0);
    expect(checkTotalConsistency(100000, baseItems)).toBe(10000);
  });
});
