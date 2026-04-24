import type { Client, TimestampMs } from "@fakt/shared";
import { getApiClient } from "./client.js";

export interface ListClientsInput {
  search?: string;
  includeSoftDeleted?: 0 | 1 | boolean;
  limit?: number;
  offset?: number;
}

export interface CreateClientInput {
  id: string;
  name: string;
  legalForm?: string | null;
  siret?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  sector?: string | null;
  firstCollaboration?: TimestampMs | null;
  note?: string | null;
}

export interface UpdateClientInput {
  name?: string;
  legalForm?: string | null;
  siret?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  sector?: string | null;
  firstCollaboration?: TimestampMs | null;
  note?: string | null;
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

export const clientsApi = {
  async list(input: ListClientsInput = {}): Promise<Client[]> {
    const res = await getApiClient().get<ListResponse<Client>>("/api/clients", {
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.includeSoftDeleted !== undefined
        ? { includeSoftDeleted: normalizeBool(input.includeSoftDeleted) }
        : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
    return res.items;
  },
  async search(q: string): Promise<Client[]> {
    const res = await getApiClient().get<SearchResponse<Client>>("/api/clients/search", { q });
    return res.items;
  },
  async get(id: string): Promise<Client> {
    return getApiClient().get<Client>(`/api/clients/${id}`);
  },
  async create(input: CreateClientInput): Promise<Client> {
    return getApiClient().post<Client>("/api/clients", input);
  },
  async update(id: string, input: UpdateClientInput): Promise<Client> {
    return getApiClient().patch<Client>(`/api/clients/${id}`, input);
  },
  async archive(id: string): Promise<void> {
    await getApiClient().delete<void>(`/api/clients/${id}`);
  },
  async restore(id: string): Promise<Client> {
    return getApiClient().post<Client>(`/api/clients/${id}/restore`);
  },
};
