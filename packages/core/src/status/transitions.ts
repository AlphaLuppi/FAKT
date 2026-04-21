import type { QuoteStatus, InvoiceStatus } from "@fakt/shared";

/** Transitions valides pour les devis. */
const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "signed", "refused", "expired", "invoiced"],
  viewed: ["signed", "refused", "expired"],
  signed: ["invoiced"],
  invoiced: [],
  refused: [],
  expired: [],
};

/** Transitions valides pour les factures. */
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent"],
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
