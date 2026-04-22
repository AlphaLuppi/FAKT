/**
 * Bridge Invoice — consomme le sidecar Bun+Hono.
 */

import type {
  Invoice,
  InvoiceStatus,
  InvoiceKind,
  DocumentUnit,
  PaymentMethod,
  UUID,
  TimestampMs,
} from "@fakt/shared";
import { api as httpApi } from "../../api/index.js";
import { ApiError } from "../../api/client.js";

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
  /** Si vrai, attribue un numéro F{year}-{NNN} et issuedAt = today. */
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
  items?: InvoiceItemInput[];
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
  limit?: number;
  offset?: number;
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

function genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function firstStatus(s: InvoiceStatus | InvoiceStatus[] | null | undefined): InvoiceStatus | undefined {
  if (s === null || s === undefined) return undefined;
  return Array.isArray(s) ? s[0] : s;
}

const httpInvoiceApi: InvoiceApi = {
  async list(input = {}): Promise<Invoice[]> {
    if (input.search !== undefined && input.search !== null && input.search !== "") {
      return httpApi.invoices.search(input.search);
    }
    const status = firstStatus(input.status);
    return httpApi.invoices.list({
      ...(status !== undefined ? { status } : {}),
      ...(input.clientId !== undefined && input.clientId !== null
        ? { clientId: input.clientId }
        : {}),
      ...(input.quoteId !== undefined && input.quoteId !== null
        ? { quoteId: input.quoteId }
        : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
  },
  async get(id): Promise<Invoice | null> {
    try {
      return await httpApi.invoices.get(id);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },
  async create(input): Promise<Invoice> {
    const created = await httpApi.invoices.create({
      id: genUuid(),
      clientId: input.clientId,
      quoteId: input.quoteId ?? null,
      kind: input.kind,
      depositPercent: input.depositPercent ?? null,
      title: input.title,
      totalHtCents: input.totalHtCents,
      dueDate: input.dueDate ?? null,
      legalMentions: input.legalMentions,
      items: input.items.map((it) => ({
        ...it,
        serviceId: it.serviceId ?? null,
      })),
    });
    if (input.issueNumber) {
      return httpApi.invoices.issue(created.id);
    }
    return created;
  },
  async createFromQuote(input): Promise<Invoice> {
    const created = await httpApi.invoices.createFromQuote(input.quoteId, {
      id: genUuid(),
      mode: input.mode,
      legalMentions: input.legalMentions,
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    });
    if (input.issueNumber) {
      return httpApi.invoices.issue(created.id);
    }
    return created;
  },
  async update(id, input): Promise<Invoice> {
    return httpApi.invoices.update(id, {
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...("dueDate" in input ? { dueDate: input.dueDate ?? null } : {}),
      ...(input.totalHtCents !== undefined ? { totalHtCents: input.totalHtCents } : {}),
      ...(input.legalMentions !== undefined ? { legalMentions: input.legalMentions } : {}),
      ...(input.items !== undefined
        ? {
            items: input.items.map((it) => ({
              ...it,
              serviceId: it.serviceId ?? null,
            })),
          }
        : {}),
    });
  },
  async updateStatus(id, status): Promise<Invoice> {
    if (status === "sent") {
      return httpApi.invoices.markSent(id);
    }
    if (status === "overdue") {
      return httpApi.invoices.markOverdue(id);
    }
    if (status === "cancelled") {
      return httpApi.invoices.cancel(id);
    }
    throw new Error(`invoiceApi.updateStatus: transition non exposée vers ${status}`);
  },
  async markPaid(id, input): Promise<Invoice> {
    return httpApi.invoices.markPaid(id, {
      paidAt: input.paidAt,
      method: input.method,
      notes: input.notes ?? null,
    });
  },
  async delete(id): Promise<void> {
    await httpApi.invoices.delete(id);
  },
};

let _impl: InvoiceApi = httpInvoiceApi;

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

/** Injection pour tests. Passer `null` pour restaurer le défaut HTTP. */
export function setInvoiceApi(api: InvoiceApi | null): void {
  _impl = api ?? httpInvoiceApi;
}
