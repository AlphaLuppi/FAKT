/**
 * Bridge Clients — lecture seule pour H1, création déléguée à Track G.
 */

import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type { Client, UUID } from "@fakt/shared";

export interface ClientsApi {
  list(options?: { search?: string }): Promise<Client[]>;
  get(id: UUID): Promise<Client | null>;
}

const tauriClientsApi: ClientsApi = {
  async list(options = {}): Promise<Client[]> {
    return invoke<Client[]>(IPC_COMMANDS.LIST_CLIENTS, {
      search: options.search ?? null,
      includeSoftDeleted: false,
    });
  },
  async get(id): Promise<Client | null> {
    return invoke<Client | null>(IPC_COMMANDS.GET_CLIENT, { id });
  },
};

let _impl: ClientsApi = tauriClientsApi;

export const clientsApi: ClientsApi = {
  list: (options) => _impl.list(options),
  get: (id) => _impl.get(id),
};

export function setClientsApi(api: ClientsApi | null): void {
  _impl = api ?? tauriClientsApi;
}
