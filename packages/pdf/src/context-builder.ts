/**
 * context-builder.ts — Transforme les DTOs domain (QuoteInput / InvoiceInput)
 * en contextes Typst JSON-serialisables consommés par les templates .typ.
 *
 * Le format est strict : côté Typst on lit des strings pré-formatées (FR),
 * pour éviter toute logique de formatting dans les templates.
 */

import type {
  ClientInput,
  DocumentLineInput,
  InvoiceInput,
  QuoteInput,
  WorkspaceInput,
} from "@fakt/core";
import { formatEur, formatFrDateLong } from "@fakt/shared";

// ─── Types de contexte injectés dans Typst ──────────────────────────────────

export interface WorkspaceCtx {
  name: string;
  legalForm: string;
  siret: string;
  address: string;
  email: string;
  iban: string | null;
  tvaMention: string;
}

export interface ClientCtx {
  name: string;
  legalForm: string | null;
  siret: string | null;
  address: string | null;
  contactName: string | null;
}

export interface ItemCtx {
  description: string;
  /** Quantité formatée FR (ex: "1" ou "2,5"). */
  quantity: string;
  /** Unité métier (forfait, jour, heure…). */
  unit: string;
  /** Prix unitaire formaté (ex: "100,00 €"). */
  unitPrice: string;
  /** Total ligne formaté. */
  total: string;
}

export interface QuoteCtx {
  kind: "quote";
  number: string;
  title: string;
  issuedAt: string;
  validityDate: string;
  total: string;
  workspace: WorkspaceCtx;
  client: ClientCtx;
  items: ItemCtx[];
  conditions: string | null;
  notes: string | null;
  signedAt: string | null;
}

export interface InvoiceCtx {
  kind: "invoice";
  number: string;
  title: string;
  issuedAt: string;
  executionDate: string;
  dueDate: string;
  total: string;
  workspace: WorkspaceCtx;
  client: ClientCtx;
  items: ItemCtx[];
  legalMentions: string;
  quoteReference: string | null;
}

export type PdfCtx = QuoteCtx | InvoiceCtx;

// ─── Helpers pré-formatting FR ───────────────────────────────────────────────

/** Formatte une quantité millièmes → string FR (supprime le séparateur décimal
 *  quand la valeur est entière, ex: "2" au lieu de "2,000"). */
export function formatQuantity(quantityMilli: number): string {
  const value = quantityMilli / 1000;
  if (Number.isInteger(value)) {
    return value.toString();
  }
  // fr-FR utilise la virgule comme séparateur décimal.
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

/** Transforme une DocumentLineInput en ItemCtx prêt pour Typst. */
export function lineToItemCtx(line: DocumentLineInput): ItemCtx {
  return {
    description: line.description,
    quantity: formatQuantity(line.quantity),
    unit: line.unit,
    unitPrice: formatEur(line.unitPriceCents),
    total: formatEur(line.lineTotalCents),
  };
}

// ─── Workspace → WorkspaceCtx ────────────────────────────────────────────────

export function workspaceToCtx(ws: WorkspaceInput): WorkspaceCtx {
  return {
    name: ws.name,
    legalForm: ws.legalForm,
    siret: ws.siret,
    address: ws.address,
    email: ws.email,
    iban: ws.iban,
    tvaMention: ws.tvaMention,
  };
}

// ─── Client → ClientCtx ──────────────────────────────────────────────────────

export function clientToCtx(client: ClientInput): ClientCtx {
  return {
    name: client.name,
    legalForm: client.legalForm,
    siret: client.siret,
    address: client.address,
    contactName: client.contactName,
  };
}

// ─── DTO → contexte complet Typst ────────────────────────────────────────────

export interface BuildQuoteCtxArgs {
  quote: QuoteInput;
  client: ClientInput;
  workspace: WorkspaceInput;
}

export interface BuildInvoiceCtxArgs {
  invoice: InvoiceInput;
  client: ClientInput;
  workspace: WorkspaceInput;
  /** Numéro de devis lié (ex: "D2026-042") — optionnel. */
  quoteReference?: string | null;
  /** Date d'exécution de la prestation — timestamp ms. Si null, fallback sur issuedAt. */
  executionAt?: number | null;
}

/** Construit le contexte Typst pour un devis. */
export function buildQuoteContext(args: BuildQuoteCtxArgs): QuoteCtx {
  const { quote, client, workspace } = args;

  if (!quote.number) {
    throw new Error("buildQuoteContext: le devis doit avoir un numéro émis (non draft)");
  }
  if (!quote.issuedAt) {
    throw new Error("buildQuoteContext: le devis doit avoir une date d'émission");
  }

  return {
    kind: "quote",
    number: quote.number,
    title: quote.title,
    issuedAt: formatFrDateLong(quote.issuedAt),
    validityDate: quote.validityDate ? formatFrDateLong(quote.validityDate) : "—",
    total: formatEur(quote.totalHtCents),
    workspace: workspaceToCtx(workspace),
    client: clientToCtx(client),
    items: quote.items.map(lineToItemCtx),
    conditions: quote.conditions,
    notes: quote.notes,
    signedAt: quote.signedAt ? formatFrDateLong(quote.signedAt) : null,
  };
}

/** Construit le contexte Typst pour une facture. */
export function buildInvoiceContext(args: BuildInvoiceCtxArgs): InvoiceCtx {
  const { invoice, client, workspace } = args;

  if (!invoice.number) {
    throw new Error("buildInvoiceContext: la facture doit avoir un numéro émis (non draft)");
  }
  if (!invoice.issuedAt) {
    throw new Error("buildInvoiceContext: la facture doit avoir une date d'émission");
  }

  const executionTs = args.executionAt ?? invoice.issuedAt;

  return {
    kind: "invoice",
    number: invoice.number,
    title: invoice.title,
    issuedAt: formatFrDateLong(invoice.issuedAt),
    executionDate: formatFrDateLong(executionTs),
    dueDate: invoice.dueDate ? formatFrDateLong(invoice.dueDate) : "—",
    total: formatEur(invoice.totalHtCents),
    workspace: workspaceToCtx(workspace),
    client: clientToCtx(client),
    items: invoice.items.map(lineToItemCtx),
    legalMentions: invoice.legalMentions,
    quoteReference: args.quoteReference ?? null,
  };
}
