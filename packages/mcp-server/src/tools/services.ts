/**
 * Tools services (prestations) — lecture seule MVP.
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

export const servicesTools: ToolRegistration[] = [
  {
    name: "list_services",
    description: "Liste les prestations/services du catalogue (avec prix unitaires et unités).",
    schema: {
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    },
    handler: async (args) =>
      safeCall(() =>
        apiClient.get("/api/services", {
          search: args.search as string | undefined,
          limit: args.limit as number,
          offset: args.offset as number,
        })
      ),
  },
  {
    name: "get_service",
    description: "Récupère un service du catalogue par ID.",
    schema: {
      id: z.string(),
    },
    handler: async (args) => safeCall(() => apiClient.get(`/api/services/${args.id as string}`)),
  },
];
