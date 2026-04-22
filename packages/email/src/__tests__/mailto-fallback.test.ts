import { describe, expect, it } from "vitest";
import { buildMailtoUrl } from "../mailto-fallback.js";

describe("buildMailtoUrl", () => {
  it("construit une URL mailto: basique", () => {
    const url = buildMailtoUrl({
      to: "client@example.com",
      subject: "Test",
      body: "Bonjour.",
    });
    expect(url).toMatch(/^mailto:/);
    expect(url).toContain("subject=Test");
    expect(url).toContain("body=Bonjour.");
  });

  it("encode les espaces dans le sujet", () => {
    const url = buildMailtoUrl({
      to: "a@b.com",
      subject: "Devis 2026 001",
      body: "Corps.",
    });
    expect(url).toContain("Devis");
    expect(url).not.toContain("subject=Devis 2026 001");
  });

  it("encode les accents dans le corps", () => {
    const url = buildMailtoUrl({
      to: "a@b.com",
      subject: "S",
      body: "Maëlle Dupont — Facture N°001",
    });
    expect(url).not.toContain("ë");
    expect(url).toContain("body=");
  });

  it("encode le destinataire", () => {
    const url = buildMailtoUrl({
      to: "cli+test@example.com",
      subject: "S",
      body: "B",
    });
    expect(url).toContain("mailto:");
  });

  it("format général : mailto:to?subject=...&body=...", () => {
    const url = buildMailtoUrl({ to: "x@y.com", subject: "Sub", body: "B" });
    const [proto, rest] = url.split("?");
    expect(proto).toContain("mailto:");
    expect(rest).toContain("subject=");
    expect(rest).toContain("body=");
  });
});
