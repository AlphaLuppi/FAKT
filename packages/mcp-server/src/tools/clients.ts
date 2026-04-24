/**
 * Tools clients — lecture + écriture (création).
 * Les PATCH/DELETE sont réservés à des tools explicites avec confirmation côté app.
 */
import { z } from "zod";
import { ApiClientError, apiClient } from "../client.ts";
import type { ToolRegistration } from "./types.ts";

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

export const clientsTools: ToolRegistration[] = [
  {
    name: "list_clients",
    description: "Liste les clients du workspace. Peut filtrer par recherche texte (nom, email).",
    schema: {
      search: z.string().optional().describe("Recherche libre dans nom/email"),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
    handler: async (args) =>
      safeCall(() =>
        apiClient.get("/api/clients", {
          search: args.search as string | undefined,
          limit: args.limit as number,
          offset: args.offset as number,
        })
      ),
  },
  {
    name: "get_client",
    description: "Récupère les détails complets d'un client par son ID.",
    schema: {
      id: z.string().describe("UUID du client"),
    },
    handler: async (args) => safeCall(() => apiClient.get(`/api/clients/${args.id as string}`)),
  },
  {
    name: "create_client",
    description:
      "Crée un nouveau client dans le workspace. N'utilise ce tool QUE si l'utilisateur a confirmé explicitement les informations — sinon, propose-les d'abord en texte et demande confirmation.",
    schema: {
      name: z.string().min(1).describe("Nom ou raison sociale"),
      email: z.string().email().optional(),
      legalForm: z.string().optional().describe("SAS, SARL, auto-entrepreneur, etc."),
      siret: z.string().optional(),
      address: z.string().optional(),
      contactName: z.string().optional(),
      sector: z.string().optional(),
      note: z.string().optional(),
    },
    handler: async (args) =>
      safeCall(() => apiClient.post("/api/clients", { id: crypto.randomUUID(), ...args })),
  },
];
