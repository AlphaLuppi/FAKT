/**
 * Tools invoices (factures) — lecture + transitions.
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

export const invoicesTools: ToolRegistration[] = [
  {
    name: "list_invoices",
    description:
      "Liste les factures du workspace. Filtrable par statut (draft/sent/paid/overdue/cancelled) et client.",
    schema: {
      status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
      clientId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    },
    handler: async (args) =>
      safeCall(() =>
        apiClient.get("/api/invoices", {
          status: args.status as string | undefined,
          clientId: args.clientId as string | undefined,
          limit: args.limit as number,
          offset: args.offset as number,
        })
      ),
  },
  {
    name: "get_invoice",
    description: "Récupère une facture complète avec items, client, échéance, statut paiement.",
    schema: {
      id: z.string(),
    },
    handler: async (args) => safeCall(() => apiClient.get(`/api/invoices/${args.id as string}`)),
  },
  {
    name: "mark_invoice_paid",
    description:
      "Marque une facture comme payée. N'utilise ce tool QUE si l'user a confirmé explicitement la réception du paiement.",
    schema: {
      id: z.string(),
    },
    handler: async (args) =>
      safeCall(() => apiClient.post(`/api/invoices/${args.id as string}/mark-paid`, {})),
  },
  {
    name: "mark_invoice_sent",
    description:
      "Transition draft → sent : envoie officiellement une facture (numérotation CGI 289).",
    schema: {
      id: z.string(),
    },
    handler: async (args) =>
      safeCall(() => apiClient.post(`/api/invoices/${args.id as string}/issue`, {})),
  },
  {
    name: "mark_invoice_overdue",
    description: "Marque une facture comme en retard de paiement (après échéance dépassée).",
    schema: {
      id: z.string(),
    },
    handler: async (args) =>
      safeCall(() => apiClient.post(`/api/invoices/${args.id as string}/mark-overdue`, {})),
  },
];
