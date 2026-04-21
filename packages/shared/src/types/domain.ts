/** Types de domaine partagés entre frontend React et backend Rust (via IPC Tauri). */

export type UUID = string;
export type TimestampMs = number;
export type Cents = number;
/** Quantité stockée en millièmes — ex: 1.5 = 1500 */
export type QuantityMilli = number;

export type LegalForm =
  | "Micro-entreprise"
  | "EURL"
  | "SASU"
  | "SAS"
  | "SARL"
  | "SA"
  | "Autre";

export type DocumentUnit = "forfait" | "jour" | "heure" | "unité" | "mois" | "semaine";

export type QuoteStatus = "draft" | "sent" | "viewed" | "signed" | "refused" | "expired";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type InvoiceKind = "deposit" | "balance" | "total" | "independent";
export type PaymentMethod = "wire" | "check" | "cash" | "other";

export interface Workspace {
  id: UUID;
  name: string;
  legalForm: LegalForm;
  siret: string;
  address: string;
  email: string;
  iban: string | null;
  tvaMention: string;
  createdAt: TimestampMs;
}

export interface Client {
  id: UUID;
  workspaceId: UUID;
  name: string;
  legalForm: string | null;
  siret: string | null;
  address: string | null;
  contactName: string | null;
  email: string | null;
  sector: string | null;
  firstCollaboration: TimestampMs | null;
  note: string | null;
  archivedAt: TimestampMs | null;
  createdAt: TimestampMs;
}

export interface Service {
  id: UUID;
  workspaceId: UUID;
  name: string;
  description: string | null;
  unit: DocumentUnit;
  unitPriceCents: Cents;
  tags: string[] | null;
  archivedAt: TimestampMs | null;
  createdAt: TimestampMs;
}

export interface DocumentLine {
  id: UUID;
  position: number;
  description: string;
  quantity: QuantityMilli;
  unitPriceCents: Cents;
  unit: DocumentUnit;
  lineTotalCents: Cents;
  serviceId: UUID | null;
}

export interface Quote {
  id: UUID;
  workspaceId: UUID;
  clientId: UUID;
  number: string | null;
  year: number | null;
  sequence: number | null;
  title: string;
  status: QuoteStatus;
  totalHtCents: Cents;
  conditions: string | null;
  validityDate: TimestampMs | null;
  notes: string | null;
  issuedAt: TimestampMs | null;
  signedAt: TimestampMs | null;
  archivedAt: TimestampMs | null;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
  items: DocumentLine[];
}

export interface Invoice {
  id: UUID;
  workspaceId: UUID;
  clientId: UUID;
  quoteId: UUID | null;
  number: string | null;
  year: number | null;
  sequence: number | null;
  kind: InvoiceKind;
  depositPercent: number | null;
  title: string;
  status: InvoiceStatus;
  totalHtCents: Cents;
  dueDate: TimestampMs | null;
  paidAt: TimestampMs | null;
  paymentMethod: PaymentMethod | null;
  legalMentions: string;
  issuedAt: TimestampMs | null;
  archivedAt: TimestampMs | null;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
  items: DocumentLine[];
}

export interface SignatureEvent {
  id: UUID;
  documentType: "quote" | "invoice";
  documentId: UUID;
  signerName: string;
  signerEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: TimestampMs;
  docHashBefore: string;
  docHashAfter: string;
  signaturePngBase64: string;
  previousEventHash: string | null;
  tsaResponse: string | null;
  tsaProvider: string | null;
}

export interface NumberingState {
  workspaceId: UUID;
  year: number;
  type: "quote" | "invoice";
  lastSequence: number;
}
