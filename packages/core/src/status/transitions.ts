import type { InvoiceStatus, QuoteStatus } from "@fakt/shared";

/**
 * Transitions valides pour les devis.
 *
 * Note 2026-04-24 : `sent -> draft` est une transition reversible legitime.
 * L'utilisateur peut "annuler envoi" s'il a coche par erreur "Marque comme
 * envoye" (aucun email n'a ete envoye cote app MVP, donc le rollback est sans
 * consequence legale). Le devis conserve son numero d'emission attribue.
 */
const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "signed", "refused", "expired", "invoiced", "draft"],
  viewed: ["signed", "refused", "expired"],
  signed: ["invoiced"],
  invoiced: [],
  refused: [],
  expired: [],
};

/**
 * Transitions valides pour les factures.
 * Note CGI art. 289-I-4 : une facture émise (sent|paid|overdue) ne peut pas
 * être annulée — elle doit être remplacée par un avoir (facture négative avec
 * son propre numéro). Seul draft → cancelled est autorisé (brouillon jamais émis).
 */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["paid", "overdue"],
  paid: [],
  overdue: ["paid"],
  cancelled: [],
};

/** Vérifie si une transition de statut devis est valide. */
export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return (QUOTE_TRANSITIONS[from] ?? []).includes(to);
}

/** Vérifie si une transition de statut facture est valide. */
export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return (INVOICE_TRANSITIONS[from] ?? []).includes(to);
}

/** Indique si un devis peut être converti en facture. */
export function canCreateInvoiceFromQuote(quoteStatus: QuoteStatus): boolean {
  return quoteStatus === "signed";
}

/** Indique si un devis peut encore être modifié. */
export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === "draft";
}

/** Indique si une facture peut encore être modifiée. */
export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "draft";
}

/** Indique si une facture est en retard de paiement. */
export function isInvoiceOverdue(dueDate: number | null, status: InvoiceStatus): boolean {
  if (status === "paid" || status === "cancelled") return false;
  if (!dueDate) return false;
  return Date.now() > dueDate;
}
