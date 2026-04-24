/**
 * Entry point des parsers de fichiers utilisés par la Dropzone brief IA.
 *
 * Usage :
 *   import { parseFile, SUPPORTED_ACCEPT } from "@fakt/ai/file-parsers";
 *   const result = await parseFile(file);
 *   brief += result.text;
 *
 * Comportement :
 * - Détecte l'extension côté nom de fichier (insensible à la casse).
 * - Dispatch vers le parser dédié (texte natif, pdfjs-dist, mammoth).
 * - Retourne ParsedFile avec texte normalisé ; throw FileParseError si échec.
 */

import { parseDocxFile } from "./docx.ts";
import { parsePdfFile } from "./pdf.ts";
import { parseEmlFile, parseTextFile } from "./text.ts";
import {
  FileParseError,
  type ParsedFile,
  type SupportedExt,
  UnsupportedFileError,
  detectExt,
} from "./types.ts";

export {
  FileParseError,
  SUPPORTED_ACCEPT,
  SUPPORTED_EXTS,
  UnsupportedFileError,
  detectExt,
} from "./types.ts";
export type { ParsedFile, SupportedExt } from "./types.ts";

export {
  parseEmlFile,
  parseEmlText,
  parseTextFile,
  readFileAsArrayBuffer,
  readFileAsText,
} from "./text.ts";
export { parsePdfFile, __setPdfjsForTests } from "./pdf.ts";
export { parseDocxFile, __setMammothForTests } from "./docx.ts";

/**
 * Parse un File quelconque. Lance UnsupportedFileError si l'extension n'est
 * pas supportée ; FileParseError si la lib sous-jacente throw.
 */
export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = detectExt(file.name);
  if (ext === null) {
    throw new UnsupportedFileError(file.name, file.name.split(".").pop() ?? "?");
  }
  try {
    const text = await dispatchParser(ext, file);
    return { filename: file.name, ext, text };
  } catch (err) {
    // Si c'est déjà un UnsupportedFileError, on le relève tel quel.
    if (err instanceof UnsupportedFileError) throw err;
    throw new FileParseError(file.name, err);
  }
}

async function dispatchParser(ext: SupportedExt, file: File): Promise<string> {
  switch (ext) {
    case "txt":
    case "md":
    case "markdown":
      return parseTextFile(file);
    case "eml":
      return parseEmlFile(file);
    case "pdf":
      return parsePdfFile(file);
    case "docx":
      return parseDocxFile(file);
    default: {
      // Exhaustive check.
      const _never: never = ext;
      void _never;
      throw new UnsupportedFileError(file.name, ext);
    }
  }
}
