/**
 * Validation et formatage du SIRET (Système d'Identification du Répertoire des Établissements).
 * 14 chiffres, contrôle par l'algorithme de Luhn.
 *
 * Réglementation : INSEE, décret n° 73-314 du 14 mars 1973.
 */

/** Supprime tous les espaces d'un SIRET saisi par l'utilisateur. */
export function normalizeSiret(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/-/g, "");
}

/** Formate un SIRET brut en XXX XXX XXX XXXXX (lisibilité). */
export function formatSiret(siret: string): string {
  const n = normalizeSiret(siret);
  if (n.length !== 14) return siret;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9, 14)}`;
}

/**
 * Valide un SIRET par l'algorithme de Luhn.
 * Retourne true si le SIRET est structurellement valide.
 */
export function validateSiret(raw: string): boolean {
  const siret = normalizeSiret(raw);

  if (siret.length !== 14) return false;
  if (!/^\d{14}$/.test(siret)) return false;

  // Exception Luhn : SIRET commençant par 356 000 000 (La Poste)
  if (siret.startsWith("356000000")) return true;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = Number.parseInt(siret[13 - i] as string, 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/** Extrait le SIREN (9 premiers chiffres) depuis un SIRET. */
export function siretToSiren(siret: string): string {
  return normalizeSiret(siret).slice(0, 9);
}

export type SiretIssue = "empty" | "too-short" | "too-long" | "non-digit" | "luhn-mismatch";

export interface SiretExplanation {
  raw: string;
  normalized: string;
  length: number;
  hasCorrectLength: boolean;
  hasOnlyDigits: boolean;
  luhnSum: number | null;
  isLuhnValid: boolean;
  actualLastDigit: number | null;
  expectedLastDigit: number | null;
  isLaPosteException: boolean;
  isValid: boolean;
  issue: SiretIssue | null;
}

/**
 * Analyse un SIRET et retourne le diagnostic détaillé : longueur, chiffres,
 * somme Luhn et clé de contrôle attendue. Utilisé pour guider l'utilisateur
 * quand sa saisie échoue (affichage pédagogique en UI).
 */
export function explainSiret(raw: string): SiretExplanation {
  const normalized = normalizeSiret(raw);
  const length = normalized.length;
  const hasOnlyDigits = length > 0 && /^\d+$/.test(normalized);
  const hasCorrectLength = length === 14;
  const isLaPosteException =
    hasCorrectLength && hasOnlyDigits && normalized.startsWith("356000000");

  let luhnSum: number | null = null;
  let isLuhnValid = false;
  let actualLastDigit: number | null = null;
  let expectedLastDigit: number | null = null;

  if (hasCorrectLength && hasOnlyDigits) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let digit = Number.parseInt(normalized[13 - i] as string, 10);
      if (i % 2 !== 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    luhnSum = sum;
    isLuhnValid = sum % 10 === 0;
    actualLastDigit = Number.parseInt(normalized[13] as string, 10);
    // Le 14ᵉ chiffre est pondéré *1 (i=0 pair). On en déduit la clé attendue
    // à partir de la somme des 13 premiers chiffres pondérés.
    const sumOfFirst13 = sum - actualLastDigit;
    expectedLastDigit = (10 - (sumOfFirst13 % 10)) % 10;
  }

  const isValid = hasCorrectLength && hasOnlyDigits && (isLuhnValid || isLaPosteException);

  let issue: SiretIssue | null = null;
  if (!isValid) {
    if (length === 0) issue = "empty";
    else if (!hasOnlyDigits) issue = "non-digit";
    else if (length < 14) issue = "too-short";
    else if (length > 14) issue = "too-long";
    else issue = "luhn-mismatch";
  }

  return {
    raw,
    normalized,
    length,
    hasCorrectLength,
    hasOnlyDigits,
    luhnSum,
    isLuhnValid,
    actualLastDigit,
    expectedLastDigit,
    isLaPosteException,
    isValid,
    issue,
  };
}
