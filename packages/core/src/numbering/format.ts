/**
 * Formatage des numéros de documents.
 * Format devis : D{YYYY}-{NNN} (ex: D2026-001)
 * Format factures : F{YYYY}-{NNN} (ex: F2026-042)
 */

export function formatQuoteNumber(year: number, sequence: number): string {
  return `D${year}-${padSequence(sequence)}`;
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `F${year}-${padSequence(sequence)}`;
}

/**
 * Formate un numéro de séquence avec zéros de remplissage.
 * La norme FR n'impose pas de largeur — on utilise 3 chiffres min pour lisibilité.
 */
function padSequence(seq: number): string {
  return seq.toString().padStart(3, "0");
}

/** Valide le format d'un numéro de devis. */
export function isValidQuoteNumber(number: string): boolean {
  return /^D\d{4}-\d{3,}$/.test(number);
}

/** Valide le format d'un numéro de facture. */
export function isValidInvoiceNumber(number: string): boolean {
  return /^F\d{4}-\d{3,}$/.test(number);
}

/** Extrait l'année et la séquence d'un numéro formaté. */
export function parseDocumentNumber(number: string): { year: number; sequence: number } | null {
  const match = number.match(/^[DF](\d{4})-(\d+)$/);
  if (!match) return null;
  return {
    year: Number.parseInt(match[1] as string, 10),
    sequence: Number.parseInt(match[2] as string, 10),
  };
}
