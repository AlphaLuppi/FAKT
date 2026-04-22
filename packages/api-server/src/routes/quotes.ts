import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { conflict, invalidTransition, notFound } from "../errors.js";
import { parseBody, parseQuery, parseParam } from "../middleware/zod.js";
import { uuidSchema } from "../schemas/common.js";
import {
  createQuoteSchema,
  updateQuoteSchema,
  listQuotesQuerySchema,
  quoteSearchQuerySchema,
} from "../schemas/quotes.js";
import {
  getWorkspace,
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  searchQuotes,
  nextNumberAtomic,
  peekNextNumber,
  getClient,
} from "@fakt/db/queries";
import type { DbInstance } from "@fakt/db/adapter";
import type { QuoteStatus } from "@fakt/shared";

export const quotesRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: DbInstance): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

function requireQuote(db: DbInstance, id: string) {
  const quote = getQuote(db, id);
  if (!quote) throw notFound(`quote ${id} introuvable`);
  return quote;
}

/** GET /api/quotes — liste paginée filtrable. */
quotesRoutes.get("/", (c) => {
  const query = parseQuery(c, listQuotesQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = listQuotes(c.var.db, {
    workspaceId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    includeArchived: query.includeArchived,
    limit: query.limit,
    offset: query.offset,
  });
  return c.json({
    items,
    pagination: { limit: query.limit, offset: query.offset, count: items.length },
  });
});

/** GET /api/quotes/search?q=... */
quotesRoutes.get("/search", (c) => {
  const query = parseQuery(c, quoteSearchQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = searchQuotes(c.var.db, workspaceId, query.q);
  return c.json({ items });
});

/** GET /api/quotes/:id/preview-next-number — alias peek. */
quotesRoutes.get("/:id/preview-next-number", (c) => {
  const workspaceId = requireWorkspaceId(c.var.db);
  const result = peekNextNumber(c.var.db, workspaceId, "quote");
  return c.json(result);
});

/** GET /api/quotes/:id */
quotesRoutes.get("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  return c.json(requireQuote(c.var.db, id));
});

/** POST /api/quotes — crée un devis en draft. */
quotesRoutes.post("/", async (c) => {
  const body = await parseBody(c, createQuoteSchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const client = getClient(c.var.db, body.clientId);
  if (!client) throw conflict(`client ${body.clientId} introuvable`);

  const created = createQuote(c.var.db, {
    id: body.id,
    workspaceId,
    clientId: body.clientId,
    title: body.title,
    conditions: body.conditions ?? null,
    validityDate: body.validityDate ?? null,
    notes: body.notes ?? null,
    totalHtCents: body.totalHtCents,
    items: body.items.map((item) => ({
      id: item.id,
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      unit: item.unit,
      lineTotalCents: item.lineTotalCents,
      serviceId: item.serviceId ?? null,
    })),
  });
  return c.json(created, 201);
});

/** PATCH /api/quotes/:id — uniquement si draft. */
quotesRoutes.patch("/:id", async (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  if (existing.status !== "draft") {
    throw invalidTransition(
      `quote ${id} non modifiable (status=${existing.status} ≠ draft)`
    );
  }
  const body = await parseBody(c, updateQuoteSchema);
  const input: Parameters<typeof updateQuote>[2] = {};
  if (body.clientId !== undefined) input.clientId = body.clientId;
  if (body.title !== undefined) input.title = body.title;
  if ("conditions" in body) input.conditions = body.conditions ?? null;
  if ("validityDate" in body) input.validityDate = body.validityDate ?? null;
  if ("notes" in body) input.notes = body.notes ?? null;
  if (body.totalHtCents !== undefined) input.totalHtCents = body.totalHtCents;
  if (body.items !== undefined) {
    input.items = body.items.map((item) => ({
      id: item.id,
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      unit: item.unit,
      lineTotalCents: item.lineTotalCents,
      serviceId: item.serviceId ?? null,
    }));
  }
  const updated = updateQuote(c.var.db, id, input);
  return c.json(updated);
});

/** DELETE /api/quotes/:id — hard delete si draft. */
quotesRoutes.delete("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  if (existing.status !== "draft") {
    throw invalidTransition(
      `quote ${id} non supprimable (status=${existing.status} ≠ draft)`
    );
  }
  deleteQuote(c.var.db, id);
  return c.body(null, 204);
});

/** POST /api/quotes/:id/issue — draft → sent + numérotation atomique. */
quotesRoutes.post("/:id/issue", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  if (existing.status !== "draft") {
    throw invalidTransition(
      `quote ${id} déjà émis (status=${existing.status})`
    );
  }
  const workspaceId = requireWorkspaceId(c.var.db);

  const numberResult = nextNumberAtomic(c.var.sqlite, c.var.db, workspaceId, "quote");
  updateQuote(c.var.db, id, {
    number: numberResult.formatted,
    year: numberResult.year,
    sequence: numberResult.sequence,
  });
  const issued = transitionQuoteOr422(c.var.db, id, "sent");
  return c.json(issued);
});

/** POST /api/quotes/:id/expire — sent/viewed → expired. */
quotesRoutes.post("/:id/expire", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "expired");
  return c.json(updated);
});

/** POST /api/quotes/:id/cancel — → refused. */
quotesRoutes.post("/:id/cancel", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "refused");
  return c.json(updated);
});

/** POST /api/quotes/:id/mark-signed — sent/viewed → signed. */
quotesRoutes.post("/:id/mark-signed", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "signed");
  return c.json(updated);
});

/** POST /api/quotes/:id/mark-invoiced — signed/sent → invoiced. */
quotesRoutes.post("/:id/mark-invoiced", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "invoiced");
  return c.json(updated);
});

/** Helper : appelle updateQuoteStatus ; convertit "invalid transition" → HTTP 422. */
function transitionQuoteOr422(db: DbInstance, id: string, newStatus: QuoteStatus) {
  try {
    return updateQuoteStatus(db, id, newStatus);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("invalid transition")) {
      throw invalidTransition(msg);
    }
    throw err;
  }
}
