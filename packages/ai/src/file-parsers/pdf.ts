/**
 * Parser .pdf : extraction texte côté client via pdfjs-dist.
 *
 * Note runtime :
 * - pdfjs-dist est volumineux. Il est importé dynamiquement à la demande.
 * - On utilise le build "legacy/build/pdf.mjs" qui fonctionne sans worker
 *   (disableWorker: true), permettant d'éviter la gymnastique worker
 *   côté Vite/Tauri.
 * - L'objet pdfjs est tolérant à l'absence de worker, mais affiche un
 *   warning console — on le silence en réglant workerSrc à une valeur factice.
 */

import { readFileAsArrayBuffer } from "./text.ts";

// Minimal types pour éviter de dépendre de pdfjs-dist au typecheck global.
interface PdfTextItem {
  str: string;
}
interface PdfTextContent {
  items: ReadonlyArray<PdfTextItem>;
}
interface PdfPageProxy {
  getTextContent(): Promise<PdfTextContent>;
}
interface PdfDocumentProxy {
  numPages: number;
  getPage(n: number): Promise<PdfPageProxy>;
  destroy?: () => Promise<void>;
}
interface PdfjsLib {
  getDocument(args: {
    data: Uint8Array;
    disableWorker?: boolean;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
  }): { promise: Promise<PdfDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

let _cachedLib: PdfjsLib | null = null;

/**
 * Charge pdfjs-dist à la demande et configure un mode "no worker".
 * Throw si la lib n'est pas installée — géré en amont par le caller.
 */
async function loadPdfjs(): Promise<PdfjsLib> {
  if (_cachedLib !== null) return _cachedLib;
  // Import dynamique résolu par Vite au build (chunk séparé). Le specifier
  // doit être en dur pour que l'analyseur statique le retrouve — si on
  // passe par une variable avec /* @vite-ignore */, le browser reçoit un
  // specifier nu non résolvable.
  // @ts-expect-error — pdfjs-dist est installé côté apps/desktop, pas dans
  // @fakt/ai (évite de forcer la dep pour les consommateurs headless).
  const mod = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfjsLib;
  if (mod.GlobalWorkerOptions) {
    mod.GlobalWorkerOptions.workerSrc = "data:application/javascript,";
  }
  _cachedLib = mod;
  return mod;
}

/** Concatène le texte de toutes les pages d'un PDF. */
export async function parsePdfFile(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const buf = await readFileAsArrayBuffer(file);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  try {
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str).join(" ");
      pages.push(text);
    }
    return pages
      .join("\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  } finally {
    try {
      await doc.destroy?.();
    } catch {
      // destroy peut throw si déjà libéré — on ignore.
    }
  }
}

/** Exposé pour les tests : permet d'injecter une lib mock. */
export function __setPdfjsForTests(mock: PdfjsLib | null): void {
  _cachedLib = mock;
}
