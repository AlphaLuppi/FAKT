import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types.js";
import { invoices } from "@fakt/db/schema";
import { notFound, conflict, invalidTransition } from "../errors.js";
import { parseBody, parseQuery, parseParam } from "../middleware/zod.js";
import { uuidSchema } from "../schemas/common.js";
import {
  createInvoiceSchema,
  fromQuoteSchema,
  updateInvoiceSchema,
  markPaidSchema,
  listInvoicesQuerySchema,
  invoiceSearchQuerySchema,
} from "../schemas/invoices.js";
import {
  getWorkspace,
  listInvoices,
  getInvoice,
  createInvoice,
  createInvoiceFromQuote,
  updateInvoice,
  markInvoicePaid,
  deleteInvoice,
  updateInvoiceStatus,
  archiveInvoice,
  searchInvoices,
  issueInvoice,
  nextInvoiceNumber,
  insertActivity,
  updateQuoteStatus,
  type CreateFromQuoteMode,
} from "@fakt/db/queries";

export const invoicesRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: Parameters<typeof getWorkspace>[0]): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

function logActivity(
  db: Parameters<typeof insertActivity>[0],
  workspaceId: string,
  type: string,
  entityId: string,
  payload?: Record<string, unknown>
): void {
  try {
    insertActivity(db, {
      id: crypto.randomUUID(),
      workspaceId,
      type,
      entityType: "invoice",
      entityId,
      payload: payload ? JSON.stringify(payload) : null,
    });
  } catch {
    // best-effort ; ne doit jamais faire échouer la requête métier
  }
}

/** GET /api/invoices — liste filtrée + pagination. */
invoicesRoutes.get("/", (c) => {
  const query = parseQuery(c, listInvoicesQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = listInvoices(c.var.db, {
    workspaceId,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.clientId !== undefined ? { clientId: query.clientId } : {}),
    includeArchived: query.includeArchived,
    limit: query.limit,
    offset: query.offset,
  });
  return c.json({
    items,
    pagination: { limit: query.limit, offset: query.offset, count: items.length },
  });
});

/** GET /api/invoices/search?q=... — recherche texte libre (titre, numéro). */
invoicesRoutes.get("/search", (c) => {
  const query = parseQuery(c, invoiceSearchQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = searchInvoices(c.var.db, workspaceId, query.q);
  return c.json({ items });
});

/** GET /api/invoices/:id — détail + items. */
invoicesRoutes.get("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const invoice = getInvoice(c.var.db, id);
  if (!invoice) throw notFound(`invoice ${id} introuvable`);
  return c.json(invoice);
});

/** POST /api/invoices — crée une facture indépendante (draft). */
invoicesRoutes.post("/", async (c) => {
  const body = await parseBody(c, createInvoiceSchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const created = createInvoice(c.var.db, {
    id: body.id,
    workspaceId,
    clientId: body.clientId,
    quoteId: body.quoteId ?? null,
    kind: body.kind,
    depositPercent: body.depositPercent ?? null,
    title: body.title,
    totalHtCents: body.totalHtCents,
    dueDate: body.dueDate ?? null,
    legalMentions: body.legalMentions,
    items: body.items.map((it) => ({
      id: it.id,
      position: it.position,
      description: it.description,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      unit: it.unit,
      lineTotalCents: it.lineTotalCents,
      serviceId: it.serviceId ?? null,
    })),
  });
  logActivity(c.var.db, workspaceId, "invoice.created", created.id, {
    kind: created.kind,
    totalHtCents: created.totalHtCents,
  });
  return c.json(created, 201);
});

/** POST /api/invoices/from-quote/:quoteId — convertit un devis signé (3 modes). */
invoicesRoutes.post("/from-quote/:quoteId", async (c) => {
  const quoteId = parseParam(c, "quoteId", uuidSchema);
  const body = await parseBody(c, fromQuoteSchema);
  const workspaceId = requireWorkspaceId(c.var.db);

  const mode: CreateFromQuoteMode = body.mode;
  let created;
  try {
    created = createInvoiceFromQuote(c.var.db, body.id, quoteId, mode, body.legalMentions);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found/i.test(msg)) throw notFound(`quote ${quoteId} introuvable`);
    if (/must be signed/i.test(msg)) throw invalidTransition(msg);
    if (/balance is zero or negative/i.test(msg)) throw invalidTransition(msg);
    throw err;
  }

  if (body.dueDate !== undefined && body.dueDate !== null) {
    const patched = updateInvoice(c.var.db, created.id, { dueDate: body.dueDate });
    logActivity(c.var.db, workspaceId, "invoice.from_quote", patched.id, {
      quoteId,
      mode,
      totalHtCents: patched.totalHtCents,
    });
    return c.json(patched, 201);
  }

  // Si mode === "full", le quote parent passe à "invoiced" (transition autorisée : signed → invoiced).
  if (mode === "full") {
    try {
      updateQuoteStatus(c.var.db, quoteId, "invoiced");
    } catch {
      // best-effort : si la transition échoue (ex: déjà invoiced), on laisse la facture créée.
    }
  }

  logActivity(c.var.db, workspaceId, "invoice.from_quote", created.id, {
    quoteId,
    mode,
    totalHtCents: created.totalHtCents,
  });
  return c.json(created, 201);
});

/** PATCH /api/invoices/:id — update draft seulement. */
invoicesRoutes.patch("/:id", async (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  if (existing.status !== "draft") {
    throw conflict(`invoice ${id} non modifiable (status=${existing.status})`);
  }
  const body = await parseBody(c, updateInvoiceSchema);

  const input: Parameters<typeof updateInvoice>[2] = {};
  if (body.clientId !== undefined) input.clientId = body.clientId;
  if (body.title !== undefined) input.title = body.title;
  if (body.kind !== undefined) input.kind = body.kind;
  if ("depositPercent" in body) input.depositPercent = body.depositPercent ?? null;
  if (body.totalHtCents !== undefined) input.totalHtCents = body.totalHtCents;
  if ("dueDate" in body) input.dueDate = body.dueDate ?? null;
  if (body.legalMentions !== undefined) input.legalMentions = body.legalMentions;
  if (body.items !== undefined) {
    input.items = body.items.map((it) => ({
      id: it.id,
      position: it.position,
      description: it.description,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      unit: it.unit,
      lineTotalCents: it.lineTotalCents,
      serviceId: it.serviceId ?? null,
    }));
  }

  const updated = updateInvoice(c.var.db, id, input);
  return c.json(updated);
});

/**
 * DELETE /api/invoices/:id — hard delete autorisé uniquement si draft.
 * 409 si status ≠ draft (archivage légal 10 ans, FR CGI).
 * Le trigger SQL `invoices_no_hard_delete_issued` renforce côté DB.
 */
invoicesRoutes.delete("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  if (existing.status !== "draft") {
    throw conflict(
      `hard delete interdit sur facture status=${existing.status} ; archivage légal 10 ans (CGI art. 289)`
    );
  }
  deleteInvoice(c.var.db, id);
  return c.body(null, 204);
});

/** POST /api/invoices/:id/issue — attribue numéro + transition draft → sent. */
invoicesRoutes.post("/:id/issue", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  if (existing.status !== "draft") {
    throw invalidTransition(
      `issue : transition ${existing.status} → sent invalide (draft requis)`
    );
  }
  const workspaceId = requireWorkspaceId(c.var.db);
  const numbering = nextInvoiceNumber(c.var.db, workspaceId);
  const issued = issueInvoice(c.var.db, id, numbering);
  logActivity(c.var.db, workspaceId, "invoice.issued", issued.id, {
    number: issued.number,
  });
  return c.json(issued);
});

/** POST /api/invoices/:id/mark-sent — alias de issue (idempotent si déjà sent). */
invoicesRoutes.post("/:id/mark-sent", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  if (existing.status === "sent") return c.json(existing);
  if (existing.status !== "draft") {
    throw invalidTransition(
      `mark-sent : transition ${existing.status} → sent invalide`
    );
  }
  const workspaceId = requireWorkspaceId(c.var.db);
  const numbering = nextInvoiceNumber(c.var.db, workspaceId);
  const issued = issueInvoice(c.var.db, id, numbering);
  logActivity(c.var.db, workspaceId, "invoice.issued", issued.id, {
    number: issued.number,
  });
  return c.json(issued);
});

/** POST /api/invoices/:id/mark-paid — transition sent|overdue → paid. */
invoicesRoutes.post("/:id/mark-paid", async (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  const body = await parseBody(c, markPaidSchema);

  try {
    const updated = markInvoicePaid(
      c.var.db,
      id,
      body.paidAt,
      body.method,
      body.notes ?? null
    );
    const workspaceId = requireWorkspaceId(c.var.db);
    logActivity(c.var.db, workspaceId, "invoice.paid", updated.id, {
      method: updated.paymentMethod,
      paidAt: updated.paidAt,
    });
    return c.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/invalid transition/i.test(msg)) throw invalidTransition(msg);
    throw err;
  }
});

/** POST /api/invoices/:id/archive — archive (soft) facture. */
invoicesRoutes.post("/:id/archive", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  const updated = archiveInvoice(c.var.db, id);
  const workspaceId = requireWorkspaceId(c.var.db);
  logActivity(c.var.db, workspaceId, "invoice.archived", updated.id);
  return c.json(updated);
});

/** POST /api/invoices/:id/mark-overdue — transition sent → overdue (job cron). */
invoicesRoutes.post("/:id/mark-overdue", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  try {
    const updated = updateInvoiceStatus(c.var.db, id, "overdue");
    return c.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/invalid transition/i.test(msg)) throw invalidTransition(msg);
    throw err;
  }
});

/** POST /api/invoices/:id/cancel — annule (facture erronée). */
invoicesRoutes.post("/:id/cancel", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getInvoice(c.var.db, id);
  if (!existing) throw notFound(`invoice ${id} introuvable`);
  if (existing.status === "cancelled") return c.json(existing);
  // cancel n'est pas dans les transitions canoniques ; on autorise depuis draft ou sent uniquement.
  if (existing.status !== "draft" && existing.status !== "sent") {
    throw invalidTransition(
      `cancel : status=${existing.status} non annulable (draft ou sent requis)`
    );
  }
  // canTransitionInvoice ne définit pas draft|sent → cancelled ; on fait un update direct
  // (la transition 'cancelled' est un état terminal documenté, pas un parcours métier normal).
  c.var.db
    .update(invoices)
    .set({ status: "cancelled", updatedAt: new Date(Date.now()) })
    .where(eq(invoices.id, id))
    .run();
  const updated = getInvoice(c.var.db, id);
  if (!updated) throw notFound(`invoice ${id} introuvable`);
  const workspaceId = requireWorkspaceId(c.var.db);
  logActivity(c.var.db, workspaceId, "invoice.cancelled", updated.id);
  return c.json(updated);
});
