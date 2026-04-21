/**
 * Bridge IPC Tauri pour les factures.
 *
 * Contract de swapabilité : les composants importent `invoiceApi` et
 * type-hint contre `InvoiceApi`. En tests, `setInvoiceApi()` injecte un
 * double. Les appels Tauri restent centralisés ici.
 */

import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type {
  Invoice,
  InvoiceStatus,
  InvoiceKind,
  DocumentUnit,
  PaymentMethod,
  UUID,
  TimestampMs,
} from "@fakt/shared";

export interface InvoiceItemInput {
  id: UUID;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unit: DocumentUnit;
  lineTotalCents: number;
  serviceId?: string | null;
}

export interface CreateInvoiceInput {
  clientId: UUID;
  quoteId?: UUID | null;
  kind: InvoiceKind;
  depositPercent?: number | null;
  title: string;
  totalHtCents: number;
  dueDate?: TimestampMs | null;
  paymentMethod?: PaymentMethod | null;
  legalMentions: string;
  items: InvoiceItemInput[];
  /** Si vrai, attribue un numéro F{year}-{NNN} et passe issuedAt = today. */
  issueNumber: boolean;
}

export type CreateFromQuoteMode = "deposit30" | "balance" | "full";

export interface CreateFromQuoteInput {
  quoteId: UUID;
  mode: CreateFromQuoteMode;
  title?: string;
  dueDate?: TimestampMs | null;
  paymentMethod?: PaymentMethod | null;
  legalMentions: string;
  /** Items éventuellement édités par l'utilisateur avant création. */
  items?: InvoiceItemInput[];
  /** Montant HT total (si l'utilisateur a ajusté les items). */
  totalHtCents?: number;
  issueNumber: boolean;
}

export interface UpdateInvoiceInput {
  clientId?: UUID;
  title?: string;
  dueDate?: TimestampMs | null;
  paymentMethod?: PaymentMethod | null;
  totalHtCents?: number;
  legalMentions?: string;
  items?: InvoiceItemInput[];
}

export interface ListInvoicesInput {
  status?: InvoiceStatus | InvoiceStatus[];
  clientId?: UUID | null;
  quoteId?: UUID | null;
  search?: string | null;
}

export interface MarkPaidInput {
  paidAt: TimestampMs;
  method: PaymentMethod;
  notes?: string | null;
}

export interface InvoiceApi {
  list(input?: ListInvoicesInput): Promise<Invoice[]>;
  get(id: UUID): Promise<Invoice | null>;
  create(input: CreateInvoiceInput): Promise<Invoice>;
  createFromQuote(input: CreateFromQuoteInput): Promise<Invoice>;
  update(id: UUID, input: UpdateInvoiceInput): Promise<Invoice>;
  updateStatus(id: UUID, status: InvoiceStatus): Promise<Invoice>;
  markPaid(id: UUID, input: MarkPaidInput): Promise<Invoice>;
  delete(id: UUID): Promise<void>;
}

const tauriInvoiceApi: InvoiceApi = {
  async list(input = {}): Promise<Invoice[]> {
    return invoke<Invoice[]>(IPC_COMMANDS.LIST_INVOICES, {
      status: input.status ?? null,
      clientId: input.clientId ?? null,
      quoteId: input.quoteId ?? null,
      search: input.search ?? null,
    });
  },
  async get(id): Promise<Invoice | null> {
    return invoke<Invoice | null>(IPC_COMMANDS.GET_INVOICE, { id });
  },
  async create(input): Promise<Invoice> {
    return invoke<Invoice>(IPC_COMMANDS.CREATE_INVOICE_INDEPENDENT, { input });
  },
  async createFromQuote(input): Promise<Invoice> {
    return invoke<Invoice>(IPC_COMMANDS.CREATE_INVOICE_FROM_QUOTE, { input });
  },
  async update(id, input): Promise<Invoice> {
    return invoke<Invoice>("update_invoice", { id, input });
  },
  async updateStatus(id, status): Promise<Invoice> {
    if (status === "sent") {
      return invoke<Invoice>("mark_invoice_sent", { id });
    }
    throw new Error(
      `invoiceApi.updateStatus: transition non exposée vers ${status}`,
    );
  },
  async markPaid(id, input): Promise<Invoice> {
    return invoke<Invoice>(IPC_COMMANDS.MARK_INVOICE_PAID, {
      id,
      paidAt: input.paidAt,
      method: input.method,
      notes: input.notes ?? null,
    });
  },
  async delete(id): Promise<void> {
    await invoke<void>("delete_invoice", { id });
  },
};

let _impl: InvoiceApi = tauriInvoiceApi;

export const invoiceApi: InvoiceApi = {
  list: (input) => _impl.list(input),
  get: (id) => _impl.get(id),
  create: (input) => _impl.create(input),
  createFromQuote: (input) => _impl.createFromQuote(input),
  update: (id, input) => _impl.update(id, input),
  updateStatus: (id, status) => _impl.updateStatus(id, status),
  markPaid: (id, input) => _impl.markPaid(id, input),
  delete: (id) => _impl.delete(id),
};

/** Injection pour tests. Passer `null` pour restaurer Tauri. */
export function setInvoiceApi(api: InvoiceApi | null): void {
  _impl = api ?? tauriInvoiceApi;
}
