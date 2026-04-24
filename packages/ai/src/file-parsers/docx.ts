/**
 * Parser .docx : extraction texte via la lib `mammoth`.
 * `mammoth.extractRawText` retourne uniquement le texte (pas de HTML).
 * Import dynamique pour ne pas forcer mammoth dans les bundles qui n'en ont pas besoin.
 */

import { readFileAsArrayBuffer } from "./text.ts";

interface MammothExtractResult {
  value: string;
  messages: ReadonlyArray<unknown>;
}
interface MammothLib {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<MammothExtractResult>;
}

let _cachedLib: MammothLib | null = null;

async function loadMammoth(): Promise<MammothLib> {
  if (_cachedLib !== null) return _cachedLib;
  // /* @vite-ignore */ : laisser Vite résoudre à l'exécution (mammoth est
  // une optionalDep de l'app, pas de @fakt/ai — évite le fail de pré-bundle
  // côté tests Vite).
  const modName = "mammoth/mammoth.browser.js";
  const mod = (await import(/* @vite-ignore */ modName)) as unknown as MammothLib;
  _cachedLib = mod;
  return mod;
}

export async function parseDocxFile(file: File): Promise<string> {
  const mammoth = await loadMammoth();
  const buf = await readFileAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}

/** Exposé pour les tests : permet d'injecter une lib mock. */
export function __setMammothForTests(mock: MammothLib | null): void {
  _cachedLib = mock;
}
