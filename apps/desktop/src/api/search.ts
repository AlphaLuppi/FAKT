import { getApiClient } from "./client.js";

/**
 * Hit de la recherche globale agregee (clients + devis + factures).
 * Cf. packages/api-server/src/routes/search.ts.
 */
export interface SearchHit {
  kind: "client" | "quote" | "invoice";
  id: string;
  label: string;
  hint: string | null;
}

export interface SearchResponse {
  q: string;
  count: number;
  clients: number;
  quotes: number;
  invoices: number;
  items: SearchHit[];
}

export const searchApi = {
  async search(q: string, limit = 20): Promise<SearchResponse> {
    if (!q.trim()) {
      return { q, count: 0, clients: 0, quotes: 0, invoices: 0, items: [] };
    }
    return getApiClient().get<SearchResponse>("/api/search", { q, limit });
  },
};
