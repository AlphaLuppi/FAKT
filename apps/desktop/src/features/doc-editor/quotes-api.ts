/**
 * Bridge IPC Tauri pour les devis.
 *
 * Contract de swapabilité : les composants importent `quotesApi` et
 * type-hint contre `QuotesApi`. En tests, `setQuotesApi()` injecte un
 * double. Les appels Tauri restent centralisés ici.
 *
 * Les commandes back-end (Rust) sont listées dans IPC_COMMANDS.
 */

import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type { Quote, QuoteStatus, DocumentUnit, UUID } from "@fakt/shared";

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
  /** Si vrai, attribue un numéro et passe le devis en statut draft avec numéro. */
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
}

export interface QuotesApi {
  list(input?: ListQuotesInput): Promise<Quote[]>;
  get(id: UUID): Promise<Quote | null>;
  create(input: CreateQuoteInput): Promise<Quote>;
  update(id: UUID, input: UpdateQuoteInput): Promise<Quote>;
  updateStatus(id: UUID, status: QuoteStatus): Promise<Quote>;
}

const tauriQuotesApi: QuotesApi = {
  async list(input = {}): Promise<Quote[]> {
    return invoke<Quote[]>(IPC_COMMANDS.LIST_QUOTES, {
      status: input.status ?? null,
      clientId: input.clientId ?? null,
      search: input.search ?? null,
    });
  },
  async get(id): Promise<Quote | null> {
    return invoke<Quote | null>(IPC_COMMANDS.GET_QUOTE, { id });
  },
  async create(input): Promise<Quote> {
    return invoke<Quote>(IPC_COMMANDS.CREATE_QUOTE, { input });
  },
  async update(id, input): Promise<Quote> {
    return invoke<Quote>(IPC_COMMANDS.UPDATE_QUOTE, { id, input });
  },
  async updateStatus(id, status): Promise<Quote> {
    // Cycle de vie devis — mappe sur les commandes Rust correspondantes.
    if (status === "sent") {
      return invoke<Quote>(IPC_COMMANDS.ISSUE_QUOTE, { id });
    }
    if (status === "expired") {
      return invoke<Quote>(IPC_COMMANDS.EXPIRE_QUOTE, { id });
    }
    if (status === "refused") {
      return invoke<Quote>(IPC_COMMANDS.CANCEL_QUOTE, { id });
    }
    if (status === "invoiced") {
      return invoke<Quote>("mark_quote_invoiced", { id });
    }
    throw new Error(
      `quotesApi.updateStatus: transition non exposée vers ${status}`,
    );
  },
};

let _impl: QuotesApi = tauriQuotesApi;

export const quotesApi: QuotesApi = {
  list: (input) => _impl.list(input),
  get: (id) => _impl.get(id),
  create: (input) => _impl.create(input),
  update: (id, input) => _impl.update(id, input),
  updateStatus: (id, status) => _impl.updateStatus(id, status),
};

/** Injection pour tests. Passer `null` pour restaurer Tauri. */
export function setQuotesApi(api: QuotesApi | null): void {
  _impl = api ?? tauriQuotesApi;
}
