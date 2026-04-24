import type {
  Cents,
  DocumentLine,
  Invoice,
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  TimestampMs,
} from "@fakt/shared";
import { getApiClient } from "./client.js";

export interface ListInvoicesInput {
  status?: InvoiceStatus;
  clientId?: string;
  quoteId?: string;
  includeArchived?: 0 | 1 | boolean;
  limit?: number;
  offset?: number;
}

export interface InvoiceItemInput {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: Cents;
  unit: DocumentLine["unit"];
  lineTotalCents: Cents;
  serviceId?: string | null;
}

export interface CreateInvoiceInput {
  id: string;
  clientId: string;
  quoteId?: string | null;
  kind: InvoiceKind;
  depositPercent?: number | null;
  title: string;
  totalHtCents: Cents;
  dueDate?: TimestampMs | null;
  legalMentions: string;
  items: InvoiceItemInput[];
}

export interface FromQuoteInput {
  id: string;
  mode: "deposit30" | "balance" | "full";
  legalMentions: string;
  dueDate?: TimestampMs | null;
}

export interface UpdateInvoiceInput {
  clientId?: string;
  title?: string;
  kind?: InvoiceKind;
  depositPercent?: number | null;
  totalHtCents?: Cents;
  dueDate?: TimestampMs | null;
  legalMentions?: string;
  items?: InvoiceItemInput[];
}

export interface MarkPaidInput {
  paidAt: TimestampMs;
  method: PaymentMethod;
  notes?: string | null;
}

interface ListResponse<T> {
  items: T[];
  pagination?: { limit: number; offset: number; count: number };
}

interface SearchResponse<T> {
  items: T[];
}

function normalizeBool(v: 0 | 1 | boolean | undefined): "true" | "false" | undefined {
  if (v === undefined) return undefined;
  return v === 1 || v === true ? "true" : "false";
}

export const invoicesApi = {
  async list(input: ListInvoicesInput = {}): Promise<Invoice[]> {
    const res = await getApiClient().get<ListResponse<Invoice>>("/api/invoices", {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.quoteId !== undefined ? { quoteId: input.quoteId } : {}),
      ...(input.includeArchived !== undefined
        ? { includeArchived: normalizeBool(input.includeArchived) }
        : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
    return res.items;
  },
  async search(q: string): Promise<Invoice[]> {
    const res = await getApiClient().get<SearchResponse<Invoice>>("/api/invoices/search", { q });
    return res.items;
  },
  async get(id: string): Promise<Invoice> {
    return getApiClient().get<Invoice>(`/api/invoices/${id}`);
  },
  async create(input: CreateInvoiceInput): Promise<Invoice> {
    return getApiClient().post<Invoice>("/api/invoices", input);
  },
  async createFromQuote(quoteId: string, input: FromQuoteInput): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/from-quote/${quoteId}`, input);
  },
  async update(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
    return getApiClient().patch<Invoice>(`/api/invoices/${id}`, input);
  },
  async delete(id: string): Promise<void> {
    await getApiClient().delete<void>(`/api/invoices/${id}`);
  },
  async issue(id: string): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/${id}/issue`);
  },
  async markSent(id: string): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/${id}/mark-sent`);
  },
  async markPaid(id: string, input: MarkPaidInput): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/${id}/mark-paid`, input);
  },
  async markOverdue(id: string): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/${id}/mark-overdue`);
  },
  async archive(id: string): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/${id}/archive`);
  },
  async cancel(id: string): Promise<Invoice> {
    return getApiClient().post<Invoice>(`/api/invoices/${id}/cancel`);
  },
};
