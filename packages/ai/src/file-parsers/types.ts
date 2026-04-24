/**
 * Types communs pour les parsers de fichiers utilisés par la Dropzone IA.
 *
 * Chaque parser prend un File (Web API) et retourne le texte brut extrait.
 * Les parsers lourds (pdf, docx) sont importés dynamiquement pour ne pas
 * charger leur code côté Node / env de test non concernés.
 */

export type SupportedExt = "txt" | "md" | "markdown" | "eml" | "pdf" | "docx";

export interface ParsedFile {
  /** Nom original du fichier (ex: "brief.pdf"). */
  filename: string;
  /** Extension détectée. */
  ext: SupportedExt;
  /** Texte extrait, concaténé si multi-pages. Jamais null — peut être vide. */
  text: string;
}

export class UnsupportedFileError extends Error {
  constructor(filename: string, ext: string) {
    super(`Format de fichier non supporté : ${ext} (${filename})`);
    this.name = "UnsupportedFileError";
  }
}

export class FileParseError extends Error {
  constructor(filename: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Impossible de lire ${filename} : ${msg}`);
    this.name = "FileParseError";
  }
}

export const SUPPORTED_EXTS: ReadonlyArray<SupportedExt> = [
  "txt",
  "md",
  "markdown",
  "eml",
  "pdf",
  "docx",
];

export const SUPPORTED_ACCEPT: ReadonlyArray<string> = [
  ".txt",
  ".md",
  ".markdown",
  ".eml",
  ".pdf",
  ".docx",
];

export function detectExt(filename: string): SupportedExt | null {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = lower.slice(dot + 1);
  if ((SUPPORTED_EXTS as ReadonlyArray<string>).includes(ext)) {
    return ext as SupportedExt;
  }
  return null;
}
