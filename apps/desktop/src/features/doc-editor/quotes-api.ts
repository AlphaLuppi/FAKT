/**
 * Bridge Quotes — consomme le sidecar Bun+Hono.
 *
 * Contract de swapabilité : les composants importent `quotesApi` et
 * type-hint contre `QuotesApi`. En tests, `setQuotesApi()` injecte un
 * double.
 */

import type { Quote, QuoteStatus, DocumentUnit, UUID } from "@fakt/shared";
import { api as httpApi } from "../../api/index.js";
import { ApiError } from "../../api/client.js";

export interface QuoteItemInput {
  id: UUID;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unit: DocumentUnit;
  lineTotalCents: number;
  serviceId?: string | null;
}

export interface CreateQuoteInput {
  clientId: UUID;
  title: string;
  conditions?: string | null;
  validityDate?: number | null;
  notes?: string | null;
  totalHtCents: number;
  items: QuoteItemInput[];
  /** Si vrai, attribue un numéro immédiatement après création (issue). */
  issueNumber: boolean;
}

export interface UpdateQuoteInput {
  clientId?: UUID;
  title?: string;
  conditions?: string | null;
  validityDate?: number | null;
  notes?: string | null;
  totalHtCents?: number;
  items?: QuoteItemInput[];
}

export interface ListQuotesInput {
  status?: QuoteStatus | QuoteStatus[];
  clientId?: UUID | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface QuotesApi {
  list(input?: ListQuotesInput): Promise<Quote[]>;
  get(id: UUID): Promise<Quote | null>;
  create(input: CreateQuoteInput): Promise<Quote>;
  update(id: UUID, input: UpdateQuoteInput): Promise<Quote>;
  updateStatus(id: UUID, status: QuoteStatus): Promise<Quote>;
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

const httpQuotesApi: QuotesApi = {
  async list(input = {}): Promise<Quote[]> {
    if (input.search !== undefined && input.search !== null && input.search !== "") {
      return httpApi.quotes.search(input.search);
    }
    return httpApi.quotes.list({
      ...(input.status !== undefined && input.status !== null ? { status: input.status } : {}),
      ...(input.clientId !== undefined && input.clientId !== null
        ? { clientId: input.clientId }
        : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
  },
  async get(id): Promise<Quote | null> {
    try {
      return await httpApi.quotes.get(id);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },
  async create(input): Promise<Quote> {
    const created = await httpApi.quotes.create({
      id: genUuid(),
      clientId: input.clientId,
      title: input.title,
      conditions: input.conditions ?? null,
      validityDate: input.validityDate ?? null,
      notes: input.notes ?? null,
      totalHtCents: input.totalHtCents,
      items: input.items.map((it) => ({
        ...it,
        serviceId: it.serviceId ?? null,
      })),
    });
    if (input.issueNumber) {
      return httpApi.quotes.issue(created.id);
    }
    return created;
  },
  async update(id, input): Promise<Quote> {
    return httpApi.quotes.update(id, {
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...("conditions" in input ? { conditions: input.conditions ?? null } : {}),
      ...("validityDate" in input ? { validityDate: input.validityDate ?? null } : {}),
      ...("notes" in input ? { notes: input.notes ?? null } : {}),
      ...(input.totalHtCents !== undefined ? { totalHtCents: input.totalHtCents } : {}),
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
  async updateStatus(id, status): Promise<Quote> {
    switch (status) {
      case "sent":
        return httpApi.quotes.issue(id);
      case "expired":
        return httpApi.quotes.expire(id);
      case "refused":
        return httpApi.quotes.cancel(id);
      case "signed":
        return httpApi.quotes.markSigned(id);
      case "invoiced":
        return httpApi.quotes.markInvoiced(id);
      default:
        throw new Error(`quotesApi.updateStatus: transition non exposée vers ${status}`);
    }
  },
};

let _impl: QuotesApi = httpQuotesApi;

export const quotesApi: QuotesApi = {
  list: (input) => _impl.list(input),
  get: (id) => _impl.get(id),
  create: (input) => _impl.create(input),
  update: (id, input) => _impl.update(id, input),
  updateStatus: (id, status) => _impl.updateStatus(id, status),
};

/** Injection pour tests. Passer `null` pour restaurer le défaut HTTP. */
export function setQuotesApi(api: QuotesApi | null): void {
  _impl = api ?? httpQuotesApi;
}
