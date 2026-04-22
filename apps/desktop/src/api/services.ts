import type { Cents, DocumentUnit, Service } from "@fakt/shared";
import { getApiClient } from "./client.js";

export interface ListServicesInput {
  search?: string;
  includeSoftDeleted?: 0 | 1 | boolean;
  /** Alias convivial : si `archived===1`, force includeSoftDeleted=1. */
  archived?: 0 | 1 | boolean;
  limit?: number;
  offset?: number;
}

export interface CreateServiceInput {
  id: string;
  name: string;
  description?: string | null;
  unit: DocumentUnit;
  unitPriceCents: Cents;
  tags?: string[] | null;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  unit?: DocumentUnit;
  unitPriceCents?: Cents;
  tags?: string[] | null;
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

export const servicesApi = {
  async list(input: ListServicesInput = {}): Promise<Service[]> {
    const includeSoftDeleted =
      input.archived !== undefined
        ? normalizeBool(input.archived)
        : normalizeBool(input.includeSoftDeleted);
    const res = await getApiClient().get<ListResponse<Service>>("/api/services", {
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(includeSoftDeleted !== undefined ? { includeSoftDeleted } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
    return res.items;
  },
  async search(q: string): Promise<Service[]> {
    const res = await getApiClient().get<SearchResponse<Service>>("/api/services/search", { q });
    return res.items;
  },
  async get(id: string): Promise<Service> {
    return getApiClient().get<Service>(`/api/services/${id}`);
  },
  async create(input: CreateServiceInput): Promise<Service> {
    return getApiClient().post<Service>("/api/services", input);
  },
  async update(id: string, input: UpdateServiceInput): Promise<Service> {
    return getApiClient().patch<Service>(`/api/services/${id}`, input);
  },
  async archive(id: string): Promise<void> {
    await getApiClient().delete<void>(`/api/services/${id}`);
  },
  async restore(id: string): Promise<Service> {
    return getApiClient().post<Service>(`/api/services/${id}/restore`);
  },
};
