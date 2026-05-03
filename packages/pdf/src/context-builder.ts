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
import { hydrateClauses } from "@fakt/legal";
import type { ActivityEvent, SignatureEvent } from "@fakt/shared";
import { formatEur, formatFrDateLong, formatFrDateTime } from "@fakt/shared";

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

export interface ClauseCtx {
  /** Identifiant stable (utile pour debug ; le PDF n'en affiche que `label` et `body`). */
  id: string;
  /** Libellé court (ex: "Acompte 30 % à la commande"). */
  label: string;
  /** Texte complet inséré dans le PDF. */
  body: string;
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
  /** Clauses contractuelles cochées dans l'éditeur, hydratées depuis le catalogue. */
  clauses: ClauseCtx[];
  notes: string | null;
  signedAt: string | null;
  signatureImage: string | null;
  padesLevel: string | null;
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

// ─── Audit trail ────────────────────────────────────────────────────────────

export interface AuditDocumentCtx {
  type: "quote" | "invoice";
  /** Label FR pour le titre du rapport (ex: "Devis", "Facture"). */
  label: string;
  number: string;
  title: string;
  clientName: string;
  /** Total HT pré-formaté (ex: "1 234,56 €"). */
  totalHt: string;
  /** Date d'émission longue FR (ex: "21 avril 2026") ou null si pas émis. */
  issuedAt: string | null;
  /** Date de signature longue FR ou null si pas encore signé. */
  signedAt: string | null;
}

export interface AuditSignatureEventCtx {
  /** Date+heure FR (ex: "21 avril 2026 — 14:32"). */
  timestamp: string;
  signerName: string;
  signerEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  docHashBefore: string;
  docHashAfter: string;
  previousEventHash: string | null;
  tsaProvider: string | null;
  /** Niveau eIDAS — ex "B-T". null si non communiqué. */
  padesLevel: string | null;
}

export interface AuditEventCtx {
  /** Date+heure FR. */
  timestamp: string;
  /** Label déjà traduit FR (ex: "Document créé"). */
  label: string;
}

export interface AuditTrailCtx {
  kind: "audit-trail";
  document: AuditDocumentCtx;
  workspace: WorkspaceCtx;
  signatureEvents: AuditSignatureEventCtx[];
  /** Chronologie fusionnée (signatures + activités) triée ASC. */
  events: AuditEventCtx[];
  /** Date de génération du rapport, FR longue avec heure. */
  generatedAt: string;
}

export type PdfCtx = QuoteCtx | InvoiceCtx | AuditTrailCtx;

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
  /**
   * Bytes PNG d'une signature manuscrite/typée à incorporer visuellement.
   * Si fourni, le rendu Rust écrira ces bytes dans le tempdir de compilation
   * Typst (sous le nom `signature.png`) et le template y référera le fichier.
   */
  signaturePng?: Uint8Array | null;
  /** Label eIDAS (ex "AdES-B-T") affiché en mention sous la signature. */
  padesLevel?: string | null;
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

  // Le rendu Rust écrit le PNG dans le tempdir Typst sous ce nom — voir
  // pdf::render. Si pas de PNG fourni, le template Typst tombe sur la branche
  // "Signature :" vide via #signature-block(signatureImage: none).
  const hasSignaturePng = !!args.signaturePng && args.signaturePng.byteLength > 0;

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
    clauses: hydrateClauses(quote.clauses).map((c) => ({
      id: c.id,
      label: c.label,
      body: c.body,
    })),
    notes: quote.notes,
    signedAt: quote.signedAt ? formatFrDateLong(quote.signedAt) : null,
    // Le path commence par "/" car Typst résout `image()` relativement au
    // fichier appelant (partials/) — un path absolu avec leading slash le
    // rebase sur la racine du projet (--root).
    signatureImage: hasSignaturePng ? "/signature.png" : null,
    padesLevel: hasSignaturePng ? (args.padesLevel ?? null) : null,
  };
}

// ─── Audit trail context ────────────────────────────────────────────────────

export interface BuildAuditTrailCtxArgs {
  document: {
    type: "quote" | "invoice";
    number: string;
    title: string;
    clientName: string;
    totalHtCents: number;
    issuedAt: number | null;
    signedAt: number | null;
  };
  workspace: WorkspaceInput;
  signatureEvents: SignatureEvent[];
  activityEvents: ActivityEvent[];
  /** Override de l'heure de génération (utile pour les tests déterministes). */
  generatedAtMs?: number;
}

const DOC_TYPE_LABELS: Record<"quote" | "invoice", string> = {
  quote: "Devis",
  invoice: "Facture",
};

/**
 * Mappe un `activity.type` brut vers un label FR lisible. Couvre les types
 * actuellement émis par les routes du sidecar (cf. AuditTimeline.tsx).
 * Les types non listés sont rendus tels quels (préfixés "Événement : ")
 * pour éviter de cacher de l'information.
 */
function activityTypeToLabel(type: string): string {
  switch (type) {
    case "quote_created":
    case "invoice.created":
      return "Document créé";
    case "quote_marked_sent":
    case "invoice.issued":
      return "Document envoyé";
    case "quote_unmarked_sent":
      return "Envoi annulé";
    case "quote_signed":
      return "Document signé";
    case "quote_refused":
      return "Devis refusé";
    case "quote_expired":
      return "Devis expiré";
    case "quote_invoiced":
      return "Devis facturé";
    case "invoice.paid":
      return "Facture payée";
    case "invoice.cancelled":
      return "Facture annulée";
    case "invoice.archived":
      return "Document archivé";
    case "invoice.from_quote":
      return "Facture créée depuis devis";
    default:
      return `Événement : ${type}`;
  }
}

/**
 * Construit le contexte Typst pour le rapport d'audit lisible.
 * Tri chronologique strict ASC sur la chronologie fusionnée. Les hashes sont
 * affichés intégralement (le PDF doit servir de preuve juridique — pas de
 * troncature).
 */
export function buildAuditTrailContext(args: BuildAuditTrailCtxArgs): AuditTrailCtx {
  const { document, workspace, signatureEvents, activityEvents } = args;
  const generatedAtMs = args.generatedAtMs ?? Date.now();

  const sigEventsCtx: AuditSignatureEventCtx[] = [...signatureEvents]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((ev) => ({
      timestamp: formatFrDateTime(ev.timestamp),
      signerName: ev.signerName,
      signerEmail: ev.signerEmail,
      ipAddress: ev.ipAddress,
      userAgent: ev.userAgent,
      docHashBefore: ev.docHashBefore,
      docHashAfter: ev.docHashAfter,
      previousEventHash: ev.previousEventHash,
      tsaProvider: ev.tsaProvider,
      // PAdES level n'est pas stocké dans signature_events mais déduit de
      // signed_documents.padesLevel. On le laisse null ici — le bouton UI
      // peut décider de le passer en override si besoin (champ futur).
      padesLevel: ev.tsaProvider ? "B-T" : "B",
    }));

  const allEvents: AuditEventCtx[] = [
    ...activityEvents.map((a) => ({
      ts: a.createdAt,
      label: activityTypeToLabel(a.type),
    })),
    ...signatureEvents.map((s) => ({
      ts: s.timestamp,
      label: `Signé par ${s.signerName}`,
    })),
  ]
    .sort((a, b) => a.ts - b.ts)
    .map((e) => ({
      timestamp: formatFrDateTime(e.ts),
      label: e.label,
    }));

  return {
    kind: "audit-trail",
    document: {
      type: document.type,
      label: DOC_TYPE_LABELS[document.type],
      number: document.number,
      title: document.title,
      clientName: document.clientName,
      totalHt: formatEur(document.totalHtCents),
      issuedAt: document.issuedAt !== null ? formatFrDateLong(document.issuedAt) : null,
      signedAt: document.signedAt !== null ? formatFrDateLong(document.signedAt) : null,
    },
    workspace: workspaceToCtx(workspace),
    signatureEvents: sigEventsCtx,
    events: allEvents,
    generatedAt: formatFrDateTime(generatedAtMs),
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
