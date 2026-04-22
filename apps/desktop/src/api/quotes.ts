import type { Quote, QuoteStatus, DocumentLine, Cents, TimestampMs } from "@fakt/shared";
import { getApiClient } from "./client.js";

export interface ListQuotesInput {
  status?: QuoteStatus | QuoteStatus[];
  clientId?: string;
  includeArchived?: 0 | 1 | boolean;
  limit?: number;
  offset?: number;
}

export interface QuoteItemInput {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: Cents;
  unit: DocumentLine["unit"];
  lineTotalCents: Cents;
  serviceId?: string | null;
}

export interface CreateQuoteInput {
  id: string;
  clientId: string;
  title: string;
  conditions?: string | null;
  validityDate?: TimestampMs | null;
  notes?: string | null;
  totalHtCents: Cents;
  items: QuoteItemInput[];
}

export interface UpdateQuoteInput {
  clientId?: string;
  title?: string;
  conditions?: string | null;
  validityDate?: TimestampMs | null;
  notes?: string | null;
  totalHtCents?: Cents;
  items?: QuoteItemInput[];
}

interface ListResponse<T> {
  items: T[];
  pagination?: { limit: number; offset: number; count: number };
}

interface SearchResponse<T> {
  items: T[];
}

function normalizeBool(v: 0 | 1 | boolean | undefined): 0 | 1 | undefined {
  if (v === undefined) return undefined;
  return v === 1 || v === true ? 1 : 0;
}

function statusParam(s: QuoteStatus | QuoteStatus[] | undefined): string | undefined {
  if (s === undefined) return undefined;
  return Array.isArray(s) ? s.join(",") : s;
}

export const quotesApi = {
  async list(input: ListQuotesInput = {}): Promise<Quote[]> {
    const res = await getApiClient().get<ListResponse<Quote>>("/api/quotes", {
      ...(input.status !== undefined ? { status: statusParam(input.status) } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.includeArchived !== undefined
        ? { includeArchived: normalizeBool(input.includeArchived) }
        : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
    return res.items;
  },
  async search(q: string): Promise<Quote[]> {
    const res = await getApiClient().get<SearchResponse<Quote>>("/api/quotes/search", { q });
    return res.items;
  },
  async get(id: string): Promise<Quote> {
    return getApiClient().get<Quote>(`/api/quotes/${id}`);
  },
  async peekNextNumber(id: string): Promise<{ year: number; sequence: number; formatted: string }> {
    return getApiClient().get(`/api/quotes/${id}/preview-next-number`);
  },
  async create(input: CreateQuoteInput): Promise<Quote> {
    return getApiClient().post<Quote>("/api/quotes", input);
  },
  async update(id: string, input: UpdateQuoteInput): Promise<Quote> {
    return getApiClient().patch<Quote>(`/api/quotes/${id}`, input);
  },
  async delete(id: string): Promise<void> {
    await getApiClient().delete<void>(`/api/quotes/${id}`);
  },
  async issue(id: string): Promise<Quote> {
    return getApiClient().post<Quote>(`/api/quotes/${id}/issue`);
  },
  async expire(id: string): Promise<Quote> {
    return getApiClient().post<Quote>(`/api/quotes/${id}/expire`);
  },
  async cancel(id: string): Promise<Quote> {
    return getApiClient().post<Quote>(`/api/quotes/${id}/cancel`);
  },
  async markSigned(id: string): Promise<Quote> {
    return getApiClient().post<Quote>(`/api/quotes/${id}/mark-signed`);
  },
  async markInvoiced(id: string): Promise<Quote> {
    return getApiClient().post<Quote>(`/api/quotes/${id}/mark-invoiced`);
  },
};
