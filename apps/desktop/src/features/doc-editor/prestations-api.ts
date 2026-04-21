/**
 * Bridge Prestations — lecture seule pour remplissage d'items.
 */

import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type { Service } from "@fakt/shared";

export interface PrestationsApi {
  list(options?: { search?: string }): Promise<Service[]>;
}

const tauriPrestationsApi: PrestationsApi = {
  async list(options = {}): Promise<Service[]> {
    return invoke<Service[]>(IPC_COMMANDS.LIST_SERVICES, {
      search: options.search ?? null,
      includeSoftDeleted: false,
    });
  },
};

let _impl: PrestationsApi = tauriPrestationsApi;

export const prestationsApi: PrestationsApi = {
  list: (options) => _impl.list(options),
};

export function setPrestationsApi(api: PrestationsApi | null): void {
  _impl = api ?? tauriPrestationsApi;
}
