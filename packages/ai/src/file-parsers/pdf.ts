/**
 * Parser .pdf : extraction texte côté client via pdfjs-dist.
 *
 * Note runtime :
 * - pdfjs-dist est volumineux. Il est importé dynamiquement à la demande.
 * - On utilise le build "legacy/build/pdf.mjs" qui passe l'ES target bas.
 * - Deux stratégies worker tentées séquentiellement :
 *     1. Worker réel via `pdfjs-dist/legacy/build/pdf.worker.min.mjs?url` (Vite
 *        émet un fichier statique servi depuis le bundle). C'est la voie
 *        "propre" recommandée par Mozilla.
 *     2. Fallback `disableWorker: true` (exécution inline) si le worker
 *        réel n'est pas résolvable (ex: environnement de test Node/jsdom,
 *        ou cas où le webview Tauri ne peut pas instancier un Worker).
 * - Toute opération est wrappée dans un timeout global (30 s par défaut) pour
 *   ne JAMAIS laisser la promise pendre indéfiniment — y compris sur un PDF
 *   corrompu, protégé par mot de passe, ou piégeant pdfjs.
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
interface PdfGetDocumentTask {
  promise: Promise<PdfDocumentProxy>;
  destroy?: () => Promise<void>;
  onPassword?: (updatePassword: (pw: string) => void, reason: number) => void;
}
interface PdfjsLib {
  getDocument(args: {
    data: Uint8Array;
    disableWorker?: boolean;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
    disableAutoFetch?: boolean;
    disableStream?: boolean;
    stopAtErrors?: boolean;
  }): PdfGetDocumentTask;
  GlobalWorkerOptions: { workerSrc: string };
}

let _cachedLib: PdfjsLib | null = null;
let _workerConfigured = false;

/** Timeout global avant de considérer le PDF bloqué. */
const PDF_PARSE_TIMEOUT_MS = 30_000;
/** Timeout pour le seul chargement du doc (avant la boucle pages). */
const PDF_LOAD_TIMEOUT_MS = 15_000;

/**
 * Configure pdfjs GlobalWorkerOptions.workerSrc de manière best-effort.
 * - Essaye d'importer le worker en tant qu'URL via Vite (`?url`).
 * - Si ça échoue (test jsdom, build sans Vite), retourne `false` et on
 *   basculera sur `disableWorker: true`.
 */
async function configureWorker(pdfjs: PdfjsLib): Promise<boolean> {
  if (_workerConfigured) return pdfjs.GlobalWorkerOptions.workerSrc !== "";
  _workerConfigured = true;
  // Pattern Vite / pdfjs-dist 4.x : import `?url` → Vite émet un asset et
  // retourne l'URL publique. En environnement de test (jsdom) cet import
  // peut throw car Vite ne tourne pas. Dans ce cas on fallback.
  try {
    const workerMod = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")) as {
      default?: string;
    };
    if (typeof workerMod.default === "string" && workerMod.default.length > 0) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
      console.info("[pdf] worker configured via Vite ?url:", workerMod.default);
      return true;
    }
  } catch (err) {
    console.info("[pdf] worker Vite ?url indisponible, fallback disableWorker:", err);
  }
  // Fallback : on laisse la workerSrc vide (pdfjs logguera un warning) ;
  // l'appelant passera `disableWorker: true` dans getDocument args.
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  return false;
}

/**
 * Charge pdfjs-dist à la demande et configure le worker.
 * Throw si la lib n'est pas installée ou si l'import ESM échoue.
 */
async function loadPdfjs(): Promise<{ pdfjs: PdfjsLib; hasWorker: boolean }> {
  if (_cachedLib !== null) {
    return { pdfjs: _cachedLib, hasWorker: _cachedLib.GlobalWorkerOptions.workerSrc !== "" };
  }
  console.info("[pdf] loading pdfjs-dist module…");
  let mod: PdfjsLib;
  try {
    // Import dynamique : Vite le résout au build en chunk séparé. Le specifier
    // doit être littéral (pas de variable, pas de @vite-ignore), sinon Vite
    // laisse le specifier nu et le browser échoue à le résoudre.
    mod = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfjsLib;
  } catch (err) {
    console.error("[pdf] ESM import failed:", err);
    throw new Error(
      `Chargement de pdfjs-dist impossible : ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const hasWorker = await configureWorker(mod);
  _cachedLib = mod;
  console.info("[pdf] pdfjs-dist loaded (worker=", hasWorker, ")");
  return { pdfjs: mod, hasWorker };
}

/**
 * Race une promise contre un timeout. Throw Error("timeout:<label>") si la
 * promise n'a pas résolu à temps. Le timer est annulé si la promise résout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout (${ms}ms) sur ${label}`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== null) clearTimeout(timeoutId);
  });
}

/** Concatène le texte de toutes les pages d'un PDF. */
export async function parsePdfFile(file: File): Promise<string> {
  console.info("[pdf] parsePdfFile start:", file.name, `(${file.size} bytes)`);
  const { pdfjs, hasWorker } = await loadPdfjs();
  const buf = await readFileAsArrayBuffer(file);
  console.info("[pdf] buffer ready, opening document…");

  const task = pdfjs.getDocument({
    data: new Uint8Array(buf),
    // Si pas de worker réel résolu, on passe en mode inline. Sinon on laisse
    // pdfjs utiliser son worker (plus stable sur gros PDF).
    disableWorker: !hasWorker,
    isEvalSupported: false,
    useSystemFonts: true,
    // Désactive le streaming/auto-fetch : on a déjà tout le buffer en mémoire,
    // ces options forcent pdfjs à ne pas tenter d'ouvrir un canal réseau
    // (comportement qui peut pendre en Tauri / webview fileSystem).
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
  });

  // Intercepte les PDF protégés : sinon pdfjs appelle `onPassword` et attend
  // indéfiniment une réponse. On race contre une promise rejetée pour
  // propager l'erreur à l'UI (throw sync dans un callback callback-style ne
  // remonterait pas jusqu'au await ci-dessous).
  const passwordReject = new Promise<never>((_, reject) => {
    task.onPassword = (): void => {
      reject(new Error("PDF protégé par mot de passe — extraction impossible"));
    };
  });

  let doc: PdfDocumentProxy;
  try {
    doc = await withTimeout(
      Promise.race([task.promise, passwordReject]),
      PDF_LOAD_TIMEOUT_MS,
      "chargement du PDF"
    );
  } catch (err) {
    console.error("[pdf] getDocument failed:", err);
    // Nettoyage du task pour libérer le worker.
    try {
      await task.destroy?.();
    } catch {
      /* noop */
    }
    throw err;
  }

  console.info("[pdf] document opened,", doc.numPages, "pages");

  try {
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const remainingBudget = Math.max(5_000, PDF_PARSE_TIMEOUT_MS - PDF_LOAD_TIMEOUT_MS);
      const perPageBudget = Math.max(2_000, Math.floor(remainingBudget / doc.numPages));
      const page = await withTimeout(doc.getPage(pageNum), perPageBudget, `page ${pageNum}`);
      const content = await withTimeout(
        page.getTextContent(),
        perPageBudget,
        `texte page ${pageNum}`
      );
      const text = content.items.map((it) => it.str).join(" ");
      pages.push(text);
      if (pageNum <= 3 || pageNum === doc.numPages) {
        console.info(`[pdf] page ${pageNum}/${doc.numPages} extracted (${text.length} chars)`);
      }
    }
    const joined = pages
      .join("\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    console.info("[pdf] parsePdfFile done:", file.name, `(${joined.length} chars)`);
    return joined;
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
  // Quand on set un mock, considère le worker comme "configuré" (évite l'import).
  _workerConfigured = mock !== null;
  if (mock !== null && mock.GlobalWorkerOptions.workerSrc === "") {
    // Le mock teste le chemin disableWorker.
  }
}
