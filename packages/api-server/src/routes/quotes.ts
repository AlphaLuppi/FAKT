import { randomUUID } from "node:crypto";
import type { DbInstance } from "@fakt/db/adapter";
import {
  createImportedQuote,
  createQuote,
  deleteQuote,
  getClient,
  getQuote,
  getWorkspace,
  insertActivity,
  listQuotes,
  nextNumberAtomic,
  peekNextNumber,
  searchQuotes,
  updateQuote,
  updateQuoteStatus,
} from "@fakt/db/queries";
import type { QuoteStatus } from "@fakt/shared";
import { Hono } from "hono";
import { conflict, invalidTransition, notFound } from "../errors.js";
import { parseBody, parseParam, parseQuery } from "../middleware/zod.js";
import { uuidSchema } from "../schemas/common.js";
import {
  createQuoteSchema,
  importQuoteSchema,
  listQuotesQuerySchema,
  quoteSearchQuerySchema,
  updateQuoteSchema,
} from "../schemas/quotes.js";
import type { AppEnv } from "../types.js";

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
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId,
    type: "quote_created",
    entityType: "quote",
    entityId: created.id,
    payload: null,
  });
  return c.json(created, 201);
});

/** PATCH /api/quotes/:id — uniquement si draft. */
quotesRoutes.patch("/:id", async (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  if (existing.status !== "draft") {
    throw invalidTransition(`quote ${id} non modifiable (status=${existing.status} ≠ draft)`);
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
    throw invalidTransition(`quote ${id} non supprimable (status=${existing.status} ≠ draft)`);
  }
  deleteQuote(c.var.db, id);
  return c.body(null, 204);
});

/**
 * POST /api/quotes/:id/issue — attribue un numero sequentiel atomique (CGI
 * art. 289) sans changer le statut. Le devis reste en `draft` avec son numero
 * D{year}-{seq}. Bascule vers `sent` se fait ensuite explicitement via
 * /mark-sent (bouton "Marquer comme envoye" cote UI, aucun email n'est envoye
 * en MVP).
 *
 * 422 si le devis a deja un numero (reissue interdit) ou si status != draft.
 */
quotesRoutes.post("/:id/issue", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  if (existing.status !== "draft") {
    throw invalidTransition(`quote ${id} déjà émis (status=${existing.status})`);
  }
  if (existing.number) {
    throw invalidTransition(`quote ${id} déjà numéroté (${existing.number})`);
  }
  // Garde : un devis à 0€ émis occupe un slot de numérotation sans
  // contrepartie économique — anti-pattern. Bloquer à l'émission.
  if (existing.totalHtCents <= 0) {
    throw invalidTransition(
      `issue : totalHtCents doit être > 0 avant émission (got ${existing.totalHtCents}¢)`
    );
  }
  const workspaceId = requireWorkspaceId(c.var.db);

  const numberResult = nextNumberAtomic(c.var.sqlite, c.var.db, workspaceId, "quote");
  updateQuote(c.var.db, id, {
    number: numberResult.formatted,
    year: numberResult.year,
    sequence: numberResult.sequence,
  });
  const updated = getQuote(c.var.db, id);
  if (!updated) throw notFound(`quote ${id} introuvable apres issue`);
  return c.json(updated);
});

/**
 * POST /api/quotes/:id/mark-sent — bascule manuelle draft -> sent.
 * Aucun email n'est envoye (FAKT MVP = draft email multi-OS, pas d'envoi
 * automatique). L'action enregistre issuedAt si non deja set et cree un
 * activity event `quote_marked_sent`.
 */
quotesRoutes.post("/:id/mark-sent", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "sent");
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId: existing.workspaceId,
    type: "quote_marked_sent",
    entityType: "quote",
    entityId: id,
    payload: null,
  });
  return c.json(updated);
});

/**
 * POST /api/quotes/:id/unmark-sent — rollback sent -> draft (aucun email
 * reellement envoye, donc sans consequence legale). Conserve le numero
 * deja attribue. Cree un activity event `quote_unmarked_sent`.
 */
quotesRoutes.post("/:id/unmark-sent", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "draft");
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId: existing.workspaceId,
    type: "quote_unmarked_sent",
    entityType: "quote",
    entityId: id,
    payload: null,
  });
  return c.json(updated);
});

/** POST /api/quotes/:id/expire — sent/viewed → expired. */
quotesRoutes.post("/:id/expire", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "expired");
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId: existing.workspaceId,
    type: "quote_expired",
    entityType: "quote",
    entityId: id,
    payload: null,
  });
  return c.json(updated);
});

/** POST /api/quotes/:id/cancel — → refused. */
quotesRoutes.post("/:id/cancel", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "refused");
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId: existing.workspaceId,
    type: "quote_refused",
    entityType: "quote",
    entityId: id,
    payload: null,
  });
  return c.json(updated);
});

/** POST /api/quotes/:id/mark-signed — sent/viewed → signed. */
quotesRoutes.post("/:id/mark-signed", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "signed");
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId: existing.workspaceId,
    type: "quote_signed",
    entityType: "quote",
    entityId: id,
    payload: null,
  });
  return c.json(updated);
});

/** POST /api/quotes/:id/mark-invoiced — signed/sent → invoiced. */
quotesRoutes.post("/:id/mark-invoiced", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = requireQuote(c.var.db, id);
  const updated = transitionQuoteOr422(c.var.db, id, "invoiced");
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId: existing.workspaceId,
    type: "quote_invoiced",
    entityType: "quote",
    entityId: id,
    payload: null,
  });
  return c.json(updated);
});

/**
 * POST /api/quotes/import — crée un devis IMPORTÉ depuis un PDF externe.
 * - n'occupe PAS la séquence FAKT (CGI 289 préservé)
 * - externalNumber libre, importedAt posé à maintenant
 * - statut par défaut "signed" si signedAt présent, sinon "sent"
 */
quotesRoutes.post("/import", async (c) => {
  const body = await parseBody(c, importQuoteSchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const client = getClient(c.var.db, body.clientId);
  if (!client) throw conflict(`client ${body.clientId} introuvable`);

  const created = createImportedQuote(c.var.db, {
    id: body.id,
    workspaceId,
    clientId: body.clientId,
    externalNumber: body.externalNumber ?? null,
    title: body.title,
    totalHtCents: body.totalHtCents,
    issuedAt: body.issuedAt ?? null,
    signedAt: body.signedAt ?? null,
    ...(body.status ? { status: body.status } : {}),
    notes: body.notes ?? null,
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
  insertActivity(c.var.db, {
    id: randomUUID(),
    workspaceId,
    type: "quote_imported",
    entityType: "quote",
    entityId: created.id,
    payload: JSON.stringify({ externalNumber: body.externalNumber ?? null }),
  });
  return c.json(created, 201);
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
