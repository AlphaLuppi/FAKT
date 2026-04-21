import { describe, it, expect } from "vitest";
import { buildEml } from "../eml-builder.js";

describe("buildEml", () => {
  it("produit les en-têtes RFC 5322 requis", () => {
    const eml = buildEml({
      from: "test@example.com",
      to: "client@example.com",
      subject: "Test subject",
      bodyPlain: "Bonjour.",
      boundarySeed: "test",
    });

    expect(eml).toContain("From: test@example.com");
    expect(eml).toContain("To: client@example.com");
    expect(eml).toContain("Subject: Test subject");
    expect(eml).toContain("MIME-Version: 1.0");
    expect(eml).toContain("Content-Type: multipart/mixed; boundary=");
    expect(eml).toContain("Content-Type: text/plain; charset=utf-8");
    expect(eml).toContain("Bonjour.");
  });

  it("encode MIME word pour les sujets avec accents", () => {
    const eml = buildEml({
      from: "test@example.com",
      to: "client@example.com",
      subject: "Devis D2026-001 — Maëlle Dupont",
      bodyPlain: "Corps.",
      boundarySeed: "accent-test",
    });
    expect(eml).toContain("=?utf-8?B?");
  });

  it("intègre un attachment PDF base64", () => {
    const pdfB64 = btoa("fake-pdf-bytes");
    const eml = buildEml({
      from: "from@x.com",
      to: "to@x.com",
      subject: "Facture",
      bodyPlain: "Corps.",
      attachments: [
        {
          filename: "F2026-001.pdf",
          contentType: "application/pdf",
          contentBase64: pdfB64,
        },
      ],
      boundarySeed: "pdf-attach",
    });

    expect(eml).toContain("Content-Type: application/pdf");
    expect(eml).toContain("Content-Transfer-Encoding: base64");
    expect(eml).toContain('Content-Disposition: attachment; filename="F2026-001.pdf"');
    expect(eml).toContain(pdfB64);
  });

  it("wrap base64 à 76 chars par ligne", () => {
    const longB64 = "A".repeat(200);
    const eml = buildEml({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Wrap test",
      bodyPlain: "x",
      attachments: [
        { filename: "doc.pdf", contentType: "application/pdf", contentBase64: longB64 },
      ],
      boundarySeed: "wrap",
    });
    const lines = eml.split("\r\n");
    const b64Lines = lines.filter((l) => /^[A-Za-z0-9+/=]+$/.test(l) && l.length > 0);
    for (const line of b64Lines) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });

  it("inclut la partie HTML si fournie", () => {
    const eml = buildEml({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Test HTML",
      bodyPlain: "Plain.",
      bodyHtml: "<p>HTML.</p>",
      boundarySeed: "html-test",
    });
    expect(eml).toContain("Content-Type: text/html; charset=utf-8");
    expect(eml).toContain("<p>HTML.</p>");
  });

  it("utilise un boundary déterministe avec seed", () => {
    const eml1 = buildEml({
      from: "a@b.com",
      to: "c@d.com",
      subject: "S",
      bodyPlain: "B",
      boundarySeed: "stable-seed",
    });
    const eml2 = buildEml({
      from: "a@b.com",
      to: "c@d.com",
      subject: "S",
      bodyPlain: "B",
      boundarySeed: "stable-seed",
    });
    const boundaryLine1 = eml1.split("\r\n").find((l) => l.startsWith("Content-Type: multipart/mixed"));
    const boundaryLine2 = eml2.split("\r\n").find((l) => l.startsWith("Content-Type: multipart/mixed"));
    expect(boundaryLine1).toBe(boundaryLine2);
  });

  it("encode le nom de fichier avec accents en MIME word", () => {
    const eml = buildEml({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Test",
      bodyPlain: "Body.",
      attachments: [
        { filename: "Devis-Maëlle.pdf", contentType: "application/pdf", contentBase64: "abc=" },
      ],
      boundarySeed: "fname",
    });
    expect(eml).toContain("=?utf-8?B?");
  });
});
