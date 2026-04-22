/**
 * Bridge Clients — lecture via sidecar Bun+Hono.
 * Le `get` renvoie `null` si 404 pour préserver la sémantique existante.
 */

import type { Client, UUID } from "@fakt/shared";
import { ApiError } from "../../api/client.js";
import { api as httpApi } from "../../api/index.js";

export interface ClientsApi {
  list(options?: { search?: string }): Promise<Client[]>;
  get(id: UUID): Promise<Client | null>;
}

const httpClientsApi: ClientsApi = {
  async list(options = {}): Promise<Client[]> {
    return httpApi.clients.list({
      ...(options.search !== undefined ? { search: options.search } : {}),
    });
  },
  async get(id): Promise<Client | null> {
    try {
      return await httpApi.clients.get(id);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },
};

let _impl: ClientsApi = httpClientsApi;

export const clientsApi: ClientsApi = {
  list: (options) => _impl.list(options),
  get: (id) => _impl.get(id),
};

export function setClientsApi(api: ClientsApi | null): void {
  _impl = api ?? httpClientsApi;
}
