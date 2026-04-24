import {
  getWorkspace,
  searchClients,
  searchInvoices,
  searchQuotes,
} from "@fakt/db/queries";
import type { Client, Invoice, Quote } from "@fakt/shared";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../errors.js";
import { parseQuery } from "../middleware/zod.js";
import type { AppEnv } from "../types.js";

/**
 * Recherche globale : agrege clients + devis + factures sur un meme query `q`.
 * Alimente la palette de commandes Cmd+K cote UI.
 *
 * Bug 2026-04-24 : la palette Cmd+K etait vide car elle s'appuyait sur des
 * commandes Tauri `list_*` inexistantes. Desormais la palette pre-charge via
 * les APIs liste standard et peut aussi interroger cette route pour des
 * recherches fuzzy server-side (utile si l'index local n'est plus a jour).
 */
export const searchRoutes = new Hono<AppEnv>();

const searchQuerySchema = z.object({
  q: z.string().min(1, "query `q` requise"),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

interface SearchHit {
  kind: "client" | "quote" | "invoice";
  id: string;
  label: string;
  hint: string | null;
}

function toClientHit(c: Client): SearchHit {
  return {
    kind: "client",
    id: c.id,
    label: c.name,
    hint: c.email ?? c.siret ?? null,
  };
}

function toQuoteHit(q: Quote): SearchHit {
  return {
    kind: "quote",
    id: q.id,
    label: q.number ? `${q.number} - ${q.title}` : q.title,
    hint: q.status,
  };
}

function toInvoiceHit(i: Invoice): SearchHit {
  return {
    kind: "invoice",
    id: i.id,
    label: i.number ? `${i.number} - ${i.title}` : i.title,
    hint: i.status,
  };
}

/** GET /api/search?q=... — cherche clients + devis + factures (fuzzy LIKE). */
searchRoutes.get("/", (c) => {
  const query = parseQuery(c, searchQuerySchema);
  const ws = getWorkspace(c.var.db);
  if (!ws) throw notFound("workspace non initialise");

  const [clients, quotes, invoices] = [
    searchClients(c.var.db, ws.id, query.q),
    searchQuotes(c.var.db, ws.id, query.q),
    searchInvoices(c.var.db, ws.id, query.q),
  ];

  const hits: SearchHit[] = [
    ...clients.map(toClientHit),
    ...quotes.map(toQuoteHit),
    ...invoices.map(toInvoiceHit),
  ].slice(0, query.limit);

  return c.json({
    q: query.q,
    count: hits.length,
    clients: clients.length,
    quotes: quotes.length,
    invoices: invoices.length,
    items: hits,
  });
});
