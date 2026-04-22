/**
 * Bridge Prestations — lecture via sidecar Bun+Hono.
 */

import type { Service } from "@fakt/shared";
import { api as httpApi } from "../../api/index.js";

export interface PrestationsApi {
  list(options?: { search?: string }): Promise<Service[]>;
}

const httpPrestationsApi: PrestationsApi = {
  async list(options = {}): Promise<Service[]> {
    return httpApi.services.list({
      ...(options.search !== undefined ? { search: options.search } : {}),
    });
  },
};

let _impl: PrestationsApi = httpPrestationsApi;

export const prestationsApi: PrestationsApi = {
  list: (options) => _impl.list(options),
};

export function setPrestationsApi(api: PrestationsApi | null): void {
  _impl = api ?? httpPrestationsApi;
}
