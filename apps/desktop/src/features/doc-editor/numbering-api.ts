/**
 * Bridge Numérotation séquentielle CGI art. 289.
 * Délègue au sidecar Bun+Hono qui garantit l'atomicité via BEGIN IMMEDIATE côté SQLite.
 */

import { api as httpApi } from "../../api/index.js";

export interface NumberingResult {
  year: number;
  sequence: number;
  formatted: string;
}

export interface NumberingApi {
  peekNextQuote(): Promise<NumberingResult>;
}

const httpNumberingApi: NumberingApi = {
  async peekNextQuote(): Promise<NumberingResult> {
    return httpApi.numbering.peek("quote");
  },
};

let _impl: NumberingApi = httpNumberingApi;

export const numberingApi: NumberingApi = {
  peekNextQuote: () => _impl.peekNextQuote(),
};

export function setNumberingApi(api: NumberingApi | null): void {
  _impl = api ?? httpNumberingApi;
}
