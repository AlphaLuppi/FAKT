/**
 * Tools quotes (devis) — lecture + transitions d'état.
 * La création complète (items, etc.) est volontairement exclue du MVP : trop
 * complexe pour un tool MCP (items sont un array imbriqué). L'IA doit plutôt
 * guider l'user vers /quotes/new?mode=ai.
 */
import { z } from "zod";
import type { ToolRegistration } from "./types.ts";
import { apiClient, ApiClientError } from "../client.ts";

async function safeCall<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { error: `${err.code} (HTTP ${err.status}) : ${err.message}` };
    }
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export const quotesTools: ToolRegistration[] = [
  {
    name: "list_quotes",
    description:
      "Liste les devis du workspace. Filtrable par statut (draft/sent/signed/invoiced/refused/expired) et par client.",
    schema: {
      status: z
        .enum(["draft", "sent", "viewed", "signed", "invoiced", "refused", "expired"])
        .optional(),
      clientId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
    handler: async (args) =>
      safeCall(() =>
        apiClient.get("/api/quotes", {
          status: args.status as string | undefined,
          clientId: args.clientId as string | undefined,
          limit: args.limit as number,
          offset: args.offset as number,
        })
      ),
  },
  {
    name: "get_quote",
    description:
      "Récupère un devis complet avec ses items, client, conditions, totaux. Utile avant toute rédaction de relance ou suivi.",
    schema: {
      id: z.string(),
    },
    handler: async (args) => safeCall(() => apiClient.get(`/api/quotes/${args.id as string}`)),
  },
  {
    name: "mark_quote_sent",
    description:
      "Transition draft → sent : émet le devis (numérotation CGI 289 atomique). N'utilise ce tool QUE si l'utilisateur a confirmé.",
    schema: {
      id: z.string(),
    },
    handler: async (args) =>
      safeCall(() => apiClient.post(`/api/quotes/${args.id as string}/issue`, {})),
  },
  {
    name: "mark_quote_signed",
    description: "Marque un devis comme signé (après réception signature client).",
    schema: {
      id: z.string(),
    },
    handler: async (args) =>
      safeCall(() => apiClient.post(`/api/quotes/${args.id as string}/mark-signed`, {})),
  },
];
