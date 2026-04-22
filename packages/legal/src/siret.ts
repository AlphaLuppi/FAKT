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
