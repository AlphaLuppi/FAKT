import { describe, expect, it } from "vitest";
import { formatRelative } from "./relative.js";

const NOW = 1_714_000_000_000;

describe("formatRelative", () => {
  it("moins de 5 secondes → à l'instant", () => {
    expect(formatRelative(NOW - 1000, NOW)).toMatch(/instant/i);
  });

  it("30 secondes → il y a 30 s", () => {
    expect(formatRelative(NOW - 30_000, NOW)).toMatch(/30\s*s/);
  });

  it("5 minutes → il y a 5 min", () => {
    expect(formatRelative(NOW - 5 * 60_000, NOW)).toMatch(/5\s*min/);
  });

  it("3 heures → il y a 3 h", () => {
    expect(formatRelative(NOW - 3 * 3_600_000, NOW)).toMatch(/3\s*h/);
  });

  it("2 jours → il y a 2 jours", () => {
    expect(formatRelative(NOW - 2 * 86_400_000, NOW)).toMatch(/2\s+jour/);
  });

  it("hier → hier ou il y a 1 jour", () => {
    expect(formatRelative(NOW - 86_400_000, NOW)).toMatch(/hier|1\s+jour/);
  });
});
