import { afterEach, describe, expect, it, vi } from "vitest";
import { __setPdfjsForTests, parsePdfFile } from "../../src/file-parsers/pdf.ts";

function makePdfFile(content = new Uint8Array([0x25, 0x50, 0x44, 0x46])): File {
  return new File([content], "doc.pdf", { type: "application/pdf" });
}

afterEach(() => {
  __setPdfjsForTests(null);
});

describe("parsePdfFile — timeout & robustesse", () => {
  it("extrait le texte concaténé d'un PDF multi-pages (mock résolvant rapidement)", async () => {
    const pageTexts = [
      ["Page", "un"],
      ["Page", "deux"],
      ["Page", "trois"],
    ];
    __setPdfjsForTests({
      GlobalWorkerOptions: { workerSrc: "worker" },
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
    const result = await parsePdfFile(makePdfFile());
    expect(result).toContain("Page un");
    expect(result).toContain("Page deux");
    expect(result).toContain("Page trois");
  });

  it("throw rapidement si getDocument pend (timeout)", async () => {
    // Promise qui ne résout jamais — simule le hang observé en Tauri.
    __setPdfjsForTests({
      GlobalWorkerOptions: { workerSrc: "worker" },
      getDocument: () => ({
        promise: new Promise(() => {
          /* never resolves */
        }),
        destroy: () => Promise.resolve(),
      }),
    });

    vi.useFakeTimers();
    const parsePromise = parsePdfFile(makePdfFile()).catch((e: unknown) => e);
    // Avance au-delà du timeout de chargement (15s).
    await vi.advanceTimersByTimeAsync(20_000);
    vi.useRealTimers();
    const err = await parsePromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Timeout/i);
    expect((err as Error).message).toMatch(/chargement du PDF/i);
  });

  it("throw clairement si le PDF est protégé par mot de passe", async () => {
    type OnPasswordCb = (updatePw: (pw: string) => void, reason: number) => void;
    let onPasswordCb: OnPasswordCb | null = null;

    const taskRaw: Record<string, unknown> = {
      promise: new Promise<never>(() => {
        /* pending tant qu'onPassword n'est pas appelé */
      }),
      destroy: () => Promise.resolve(),
    };
    // Simule pdfjs qui déclenche onPassword de manière asynchrone.
    Object.defineProperty(taskRaw, "onPassword", {
      configurable: true,
      get: () => onPasswordCb,
      set: (cb: OnPasswordCb) => {
        onPasswordCb = cb;
        // Appel asynchrone pour laisser Promise.race s'installer.
        queueMicrotask(() => cb(() => {}, 1));
      },
    });

    // Cast via unknown pour injecter un task mock qui ne résout jamais sa
    // promise — on teste que onPassword fait rejeter correctement.
    const fakeLib = {
      GlobalWorkerOptions: { workerSrc: "worker" },
      getDocument: () => taskRaw,
    };
    __setPdfjsForTests(fakeLib as unknown as Parameters<typeof __setPdfjsForTests>[0]);

    const err = await parsePdfFile(makePdfFile()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/mot de passe/i);
  });

  it("throw si une page pend (timeout individuel)", async () => {
    __setPdfjsForTests({
      GlobalWorkerOptions: { workerSrc: "worker" },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: () =>
            new Promise(() => {
              /* never */
            }),
          destroy: () => Promise.resolve(),
        }),
      }),
    });
    vi.useFakeTimers();
    const parsePromise = parsePdfFile(makePdfFile()).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(35_000);
    vi.useRealTimers();
    const err = await parsePromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Timeout/i);
  });
});
