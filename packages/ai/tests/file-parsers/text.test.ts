import { describe, expect, it } from "vitest";
import { parseEmlText, parseTextFile, readFileAsText } from "../../src/file-parsers/text.ts";

function makeFile(name: string, content: string | ArrayBuffer, type = "text/plain"): File {
  return new File([content], name, { type });
}

describe("readFileAsText", () => {
  it("décode un fichier UTF-8 simple", async () => {
    const f = makeFile("hello.txt", "Bonjour à tous — café");
    const text = await readFileAsText(f);
    expect(text).toBe("Bonjour à tous — café");
  });

  it("préserve les caractères accentués UTF-8", async () => {
    const f = makeFile("note.md", "# Été\n\nclients : déjà réglés ✅");
    const text = await readFileAsText(f);
    expect(text).toContain("Été");
    expect(text).toContain("déjà");
    expect(text).toContain("✅");
  });
});

describe("parseTextFile", () => {
  it("retourne le contenu brut d'un .txt", async () => {
    const f = makeFile("brief.txt", "Mission : refonte site Maison Berthe\nBudget 8k€");
    const text = await parseTextFile(f);
    expect(text).toContain("Maison Berthe");
    expect(text).toContain("8k€");
  });

  it("retourne le contenu d'un .md (headings préservés)", async () => {
    const f = makeFile("brief.md", "# Brief\n\n- Page d'accueil\n- Shop");
    const text = await parseTextFile(f);
    expect(text).toContain("# Brief");
    expect(text).toContain("- Page d'accueil");
  });
});

describe("parseEmlText", () => {
  it("extrait Subject, From et body simple (non multipart)", () => {
    const raw = [
      "Subject: Nouveau brief",
      "From: Marie <marie@berthe.fr>",
      "To: tom@fakt.fr",
      "Date: Tue, 23 Apr 2026 10:00:00 +0200",
      "",
      "Salut Tom,",
      "",
      "On aimerait un e-shop pour la pâtisserie.",
    ].join("\n");
    const out = parseEmlText(raw);
    expect(out).toContain("Sujet : Nouveau brief");
    expect(out).toContain("De : Marie <marie@berthe.fr>");
    expect(out).toContain("Salut Tom,");
    expect(out).toContain("e-shop pour la pâtisserie");
  });

  it("gère les CRLF Windows", () => {
    const raw = "Subject: CRLF\r\nFrom: a@b.fr\r\n\r\nContenu sur\r\nplusieurs lignes\r\n";
    const out = parseEmlText(raw);
    expect(out).toContain("Sujet : CRLF");
    expect(out).toContain("Contenu sur");
    expect(out).toContain("plusieurs lignes");
  });

  it("extrait la première partie text/plain d'un email multipart", () => {
    const raw = [
      "Subject: Multipart",
      "From: a@b.fr",
      'Content-Type: multipart/alternative; boundary="BOUND"',
      "",
      "--BOUND",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Texte brut du mail",
      "--BOUND",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Version HTML</p>",
      "--BOUND--",
      "",
    ].join("\n");
    const out = parseEmlText(raw);
    expect(out).toContain("Texte brut du mail");
    expect(out).not.toContain("Version HTML");
  });

  it("tombe sur text/html si pas de text/plain (multipart)", () => {
    const raw = [
      "Subject: HTML only",
      "From: a@b.fr",
      'Content-Type: multipart/mixed; boundary="X"',
      "",
      "--X",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Hello <b>world</b></p>",
      "--X--",
      "",
    ].join("\n");
    const out = parseEmlText(raw);
    expect(out).toContain("Hello world");
    expect(out).not.toContain("<p>");
  });

  it("gère un email sans Subject/From (body seulement)", () => {
    const raw = "Content-Type: text/plain\n\nJuste du texte.";
    const out = parseEmlText(raw);
    expect(out.trim()).toBe("Juste du texte.");
  });
});
