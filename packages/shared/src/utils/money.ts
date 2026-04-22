import type { Cents, QuantityMilli } from "../types/domain.js";

/** Formate un montant en centimes en euros avec séparateurs FR (ex: 1 234,56 €). */
export function formatEur(cents: Cents): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Formate un montant en centimes sans symbole €. */
export function formatEurRaw(cents: Cents): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Convertit une quantité en millièmes vers un nombre décimal (1500 → 1.5). */
export function quantityFromMilli(milli: QuantityMilli): number {
  return milli / 1000;
}

/** Convertit un nombre décimal en millièmes (1.5 → 1500). Arrondi au plus proche. */
export function quantityToMilli(value: number): QuantityMilli {
  return Math.round(value * 1000);
}

/**
 * Calcule le total d'une ligne (quantité × prix unitaire).
 * Utilise des entiers pour éviter les erreurs de virgule flottante.
 */
export function computeLineTotal(quantityMilli: QuantityMilli, unitPriceCents: Cents): Cents {
  // (q/1000) * price = (q * price) / 1000 — arrondi au centime
  return Math.round((quantityMilli * unitPriceCents) / 1000);
}

/** Parse une chaîne de montant FR (ex: "1 234,56") en centimes. Retourne null si invalide. */
export function parseEurInput(raw: string): Cents | null {
  // Supprime espaces et remplace virgule par point
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}
