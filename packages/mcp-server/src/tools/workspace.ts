/**
 * Tools workspace / dashboard — lecture seule.
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

export const workspaceTools: ToolRegistration[] = [
  {
    name: "get_workspace",
    description:
      "Récupère les infos légales de l'entreprise (nom, SIRET, adresse, forme juridique, TVA). À utiliser en premier pour contextualiser toute réponse.",
    schema: {},
    handler: async () => safeCall(() => apiClient.get("/api/workspace")),
  },
  {
    name: "list_activity",
    description:
      "Liste les événements récents d'activité (émission devis, paiement facture, etc.). Utile pour comprendre l'état récent du business.",
    schema: {
      entityType: z.string().optional().describe("Filtre par type : 'quote' | 'invoice' | 'client'"),
      limit: z.number().int().min(1).max(100).default(20).describe("Nombre max d'entrées"),
      offset: z.number().int().min(0).default(0),
    },
    handler: async (args) =>
      safeCall(() =>
        apiClient.get("/api/activity", {
          entityType: args.entityType as string | undefined,
          limit: args.limit as number,
          offset: args.offset as number,
        })
      ),
  },
];
