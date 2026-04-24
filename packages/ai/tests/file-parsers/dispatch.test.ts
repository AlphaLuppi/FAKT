import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FileParseError,
  UnsupportedFileError,
  __setMammothForTests,
  __setPdfjsForTests,
  detectExt,
  parseFile,
} from "../../src/file-parsers/index.ts";

function makeFile(name: string, content: BlobPart = "x"): File {
  return new File([content], name, { type: "application/octet-stream" });
}

afterEach(() => {
  __setPdfjsForTests(null);
  __setMammothForTests(null);
});

describe("detectExt", () => {
  it("détecte les extensions supportées insensiblement à la casse", () => {
    expect(detectExt("brief.TXT")).toBe("txt");
    expect(detectExt("note.MD")).toBe("md");
    expect(detectExt("readme.Markdown")).toBe("markdown");
    expect(detectExt("mail.EML")).toBe("eml");
    expect(detectExt("doc.PDF")).toBe("pdf");
    expect(detectExt("contrat.DOCX")).toBe("docx");
  });

  it("retourne null pour un format non supporté ou sans extension", () => {
    expect(detectExt("img.png")).toBeNull();
    expect(detectExt("sansextension")).toBeNull();
    expect(detectExt(".hidden")).toBeNull();
  });
});

describe("parseFile — dispatching", () => {
  it("parse un .txt et retourne { filename, ext, text }", async () => {
    const f = makeFile("brief.txt", "contenu bref");
    const result = await parseFile(f);
    expect(result.filename).toBe("brief.txt");
    expect(result.ext).toBe("txt");
    expect(result.text).toBe("contenu bref");
  });

  it("parse un .md", async () => {
    const f = makeFile("notes.md", "# Titre\nligne");
    const result = await parseFile(f);
    expect(result.ext).toBe("md");
    expect(result.text).toContain("# Titre");
  });

  it("parse un .eml", async () => {
    const raw = "Subject: Test\nFrom: a@b\n\nbody text";
    const f = makeFile("mail.eml", raw);
    const result = await parseFile(f);
    expect(result.ext).toBe("eml");
    expect(result.text).toContain("Sujet : Test");
    expect(result.text).toContain("body text");
  });

  it("throw UnsupportedFileError pour un format inconnu", async () => {
    const f = makeFile("image.png");
    await expect(parseFile(f)).rejects.toBeInstanceOf(UnsupportedFileError);
  });

  it("parse un .pdf en utilisant le mock pdfjs injecté", async () => {
    const pageTexts = [
      ["Page", "un"],
      ["Page", "deux"],
    ];
    __setPdfjsForTests({
      GlobalWorkerOptions: { workerSrc: "" },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: pageTexts.length,
          getPage: (n: number) =>
            Promise.resolve({
              getTextContent: () =>
                Promise.resolve({
                  items: (pageTexts[n - 1] ?? []).map((str) => ({ str })),
                }),
            }),
          destroy: () => Promise.resolve(),
        }),
      }),
    });
    const f = makeFile("doc.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer);
    const result = await parseFile(f);
    expect(result.ext).toBe("pdf");
    expect(result.text).toContain("Page un");
    expect(result.text).toContain("Page deux");
  });

  it("wrap erreur pdfjs en FileParseError", async () => {
    __setPdfjsForTests({
      GlobalWorkerOptions: { workerSrc: "" },
      getDocument: () => ({
        promise: Promise.reject(new Error("invalid PDF")),
      }),
    });
    const f = makeFile("bad.pdf");
    const err = await parseFile(f).catch((e) => e);
    expect(err).toBeInstanceOf(FileParseError);
    expect((err as Error).message).toContain("invalid PDF");
  });

  it("parse un .docx via le mock mammoth", async () => {
    __setMammothForTests({
      extractRawText: vi.fn().mockResolvedValue({
        value: "Texte du docx\nLigne 2",
        messages: [],
      }),
    });
    const f = makeFile("contrat.docx");
    const result = await parseFile(f);
    expect(result.ext).toBe("docx");
    expect(result.text).toContain("Texte du docx");
  });
});
