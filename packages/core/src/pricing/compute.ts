import type { DocumentLine, Quote, Invoice } from "@fakt/shared";
import type { Cents, QuantityMilli } from "@fakt/shared";

/**
 * Calcule le total HT d'une ligne (quantité × prix unitaire).
 * Arithmétique entière pour éviter les erreurs de virgule flottante.
 * Quantité en millièmes : 1.5 j = 1500.
 */
export function computeLineTotal(
  quantityMilli: QuantityMilli,
  unitPriceCents: Cents
): Cents {
  return Math.round((quantityMilli * unitPriceCents) / 1000);
}

/** Calcule le total HT d'un ensemble de lignes. */
export function computeLinesTotal(lines: DocumentLine[]): Cents {
  return lines.reduce(
    (sum, line) => sum + computeLineTotal(line.quantity, line.unitPriceCents),
    0
  );
}

/** Calcule le total HT d'un devis depuis ses lignes. */
export function computeQuoteTotal(quote: Pick<Quote, "items">): Cents {
  return computeLinesTotal(quote.items);
}

/** Calcule le total HT d'une facture depuis ses lignes. */
export function computeInvoiceTotal(invoice: Pick<Invoice, "items">): Cents {
  return computeLinesTotal(invoice.items);
}

/**
 * Calcule le montant d'acompte en centimes.
 * Arrondi au centime inférieur (conservateur pour le freelance).
 */
export function computeDepositAmount(totalHtCents: Cents, percent: number): Cents {
  if (percent < 0 || percent > 100) {
    throw new RangeError(`Le pourcentage d'acompte doit être entre 0 et 100, reçu : ${percent}`);
  }
  return Math.floor((totalHtCents * percent) / 100);
}

/** Calcule le montant du solde (total - acompte versé). */
export function computeBalanceAmount(totalHtCents: Cents, depositPaidCents: Cents): Cents {
  const balance = totalHtCents - depositPaidCents;
  if (balance < 0) {
    throw new RangeError("Le montant du solde est négatif — l'acompte excède le total.");
  }
  return balance;
}

/**
 * Vérifie que la somme des lignes est cohérente avec le total stocké.
 * Retourne le delta en centimes (0 = cohérent).
 */
export function checkTotalConsistency(
  storedTotalCents: Cents,
  lines: DocumentLine[]
): number {
  const computed = computeLinesTotal(lines);
  return computed - storedTotalCents;
}
