/**
 * Queries CRUD devis avec lignes jointes.
 * - delete autorisé uniquement sur les drafts
 * - updateStatus valide les transitions via canTransitionQuote
 */

import { canTransitionQuote } from "@fakt/core";
import type { DocumentUnit, Quote, QuoteStatus } from "@fakt/shared";
import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { quoteItems, quotes } from "../schema/index.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ListQuotesInput {
  workspaceId: string;
  status?: QuoteStatus | QuoteStatus[];
  clientId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface QuoteItemInput {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unit: DocumentUnit;
  lineTotalCents: number;
  serviceId?: string | null;
}

export interface CreateQuoteInput {
  id: string;
  workspaceId: string;
  clientId: string;
  title: string;
  conditions?: string | null;
  validityDate?: number | null;
  notes?: string | null;
  totalHtCents: number;
  items: QuoteItemInput[];
}

export interface UpdateQuoteInput {
  clientId?: string;
  title?: string;
  conditions?: string | null;
  validityDate?: number | null;
  notes?: string | null;
  totalHtCents?: number;
  number?: string | null;
  year?: number | null;
  sequence?: number | null;
  issuedAt?: number | null;
  signedAt?: number | null;
  items?: QuoteItemInput[];
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToQuote(
  row: typeof quotes.$inferSelect,
  itemRows: (typeof quoteItems.$inferSelect)[]
): Quote {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    clientId: row.clientId,
    number: row.number ?? null,
    year: row.year ?? null,
    sequence: row.sequence ?? null,
    title: row.title,
    status: row.status as QuoteStatus,
    totalHtCents: row.totalHtCents,
    conditions: row.conditions ?? null,
    validityDate: row.validityDate ? Number(row.validityDate) : null,
    notes: row.notes ?? null,
    issuedAt: row.issuedAt ? Number(row.issuedAt) : null,
    signedAt: row.signedAt ? Number(row.signedAt) : null,
    archivedAt: row.archivedAt ? Number(row.archivedAt) : null,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    items: itemRows
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        position: item.position,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unit: item.unit as DocumentUnit,
        lineTotalCents: item.lineTotalCents,
        serviceId: item.serviceId ?? null,
      })),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function upsertItems(db: DbInstance, quoteId: string, items: QuoteItemInput[]): void {
  // Supprime les lignes existantes, réinsère. Cascade delete via FK.
  db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId)).run();
  if (items.length === 0) return;
  db.insert(quoteItems)
    .values(
      items.map((item) => ({
        id: item.id,
        quoteId,
        position: item.position,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unit: item.unit,
        lineTotalCents: item.lineTotalCents,
        serviceId: item.serviceId ?? null,
      }))
    )
    .run();
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Liste les devis d'un workspace (sans items — chargés séparément pour perf). */
export function listQuotes(db: DbInstance, input: ListQuotesInput): Quote[] {
  const { workspaceId, status, clientId, includeArchived = false, limit = 50, offset = 0 } = input;

  const conditions = [eq(quotes.workspaceId, workspaceId)];

  if (!includeArchived) conditions.push(isNull(quotes.archivedAt));
  if (clientId) conditions.push(eq(quotes.clientId, clientId));

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    if (statuses.length === 1 && statuses[0]) {
      conditions.push(eq(quotes.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(quotes.status, statuses));
    }
  }

  const rows = db
    .select()
    .from(quotes)
    .where(and(...conditions))
    .orderBy(desc(quotes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  if (rows.length === 0) return [];

  const quoteIds = rows.map((r) => r.id);
  const allItems = db.select().from(quoteItems).where(inArray(quoteItems.quoteId, quoteIds)).all();

  return rows.map((row) =>
    rowToQuote(
      row,
      allItems.filter((i) => i.quoteId === row.id)
    )
  );
}

/** Récupère un devis avec ses lignes. */
export function getQuote(db: DbInstance, id: string): Quote | null {
  const row = db.select().from(quotes).where(eq(quotes.id, id)).get();
  if (!row) return null;
  const items = db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).all();
  return rowToQuote(row, items);
}

/** Crée un nouveau devis avec ses lignes en transaction. */
export function createQuote(db: DbInstance, input: CreateQuoteInput): Quote {
  const now = new Date(Date.now());

  const row = db
    .insert(quotes)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      title: input.title,
      conditions: input.conditions ?? null,
      validityDate: input.validityDate ? new Date(input.validityDate) : null,
      notes: input.notes ?? null,
      totalHtCents: input.totalHtCents,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  if (!row) throw new Error(`createQuote: insert returned no row for id=${input.id}`);

  upsertItems(db, input.id, input.items);

  const created = getQuote(db, input.id);
  if (!created) throw new Error(`createQuote: could not reload quote id=${input.id}`);
  return created;
}

/** Met à jour un devis et ses lignes (remplace toutes les lignes si fournies). */
export function updateQuote(db: DbInstance, id: string, input: UpdateQuoteInput): Quote {
  const existing = db.select().from(quotes).where(eq(quotes.id, id)).get();
  if (!existing) throw new Error(`updateQuote: quote not found id=${id}`);

  const updates: Partial<typeof quotes.$inferInsert> = {
    updatedAt: new Date(Date.now()),
  };

  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.title !== undefined) updates.title = input.title;
  if ("conditions" in input) updates.conditions = input.conditions ?? null;
  if ("validityDate" in input) {
    updates.validityDate = input.validityDate ? new Date(input.validityDate) : null;
  }
  if ("notes" in input) updates.notes = input.notes ?? null;
  if (input.totalHtCents !== undefined) updates.totalHtCents = input.totalHtCents;
  if ("number" in input) updates.number = input.number ?? null;
  if ("year" in input) updates.year = input.year ?? null;
  if ("sequence" in input) updates.sequence = input.sequence ?? null;
  if ("issuedAt" in input) updates.issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;
  if ("signedAt" in input) updates.signedAt = input.signedAt ? new Date(input.signedAt) : null;

  db.update(quotes).set(updates).where(eq(quotes.id, id)).run();

  if (input.items !== undefined) {
    upsertItems(db, id, input.items);
  }

  const updated = getQuote(db, id);
  if (!updated) throw new Error(`updateQuote: could not reload quote id=${id}`);
  return updated;
}

/**
 * Supprime un devis — uniquement autorisé si status = 'draft'.
 * Les lignes sont supprimées en cascade par la FK.
 */
export function deleteQuote(db: DbInstance, id: string): void {
  const row = db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(eq(quotes.id, id))
    .get();

  if (!row) throw new Error(`deleteQuote: quote not found id=${id}`);
  if (row.status !== "draft") {
    throw new Error(`deleteQuote: cannot delete quote with status=${row.status} (draft only)`);
  }

  db.delete(quotes).where(eq(quotes.id, id)).run();
}

/** Transition de statut validée via canTransitionQuote. */
export function updateQuoteStatus(db: DbInstance, id: string, newStatus: QuoteStatus): Quote {
  const row = db
    .select({ id: quotes.id, status: quotes.status })
    .from(quotes)
    .where(eq(quotes.id, id))
    .get();

  if (!row) throw new Error(`updateQuoteStatus: quote not found id=${id}`);

  const current = row.status as QuoteStatus;
  if (!canTransitionQuote(current, newStatus)) {
    throw new Error(`updateQuoteStatus: invalid transition ${current} → ${newStatus}`);
  }

  const updates: Partial<typeof quotes.$inferInsert> = {
    status: newStatus,
    updatedAt: new Date(Date.now()),
  };

  if (newStatus === "sent") updates.issuedAt = new Date(Date.now());
  if (newStatus === "signed") updates.signedAt = new Date(Date.now());
  // Rollback "annuler envoi" : si on repasse en draft depuis sent, l'audit
  // trail historique reste tracé via la table `activity` (quote_unmarked_sent).
  // On reset issuedAt pour que l'état actuel reflète bien le statut draft —
  // sinon le PDF/UI continueraient de croire le devis émis.
  if (current === "sent" && newStatus === "draft") updates.issuedAt = null;

  db.update(quotes).set(updates).where(eq(quotes.id, id)).run();

  const updated = getQuote(db, id);
  if (!updated) throw new Error(`updateQuoteStatus: could not reload quote id=${id}`);
  return updated;
}

/** Recherche de devis par titre ou numéro. */
export function searchQuotes(db: DbInstance, workspaceId: string, q: string): Quote[] {
  const pattern = `%${q}%`;
  const rows = db
    .select()
    .from(quotes)
    .where(
      and(
        eq(quotes.workspaceId, workspaceId),
        isNull(quotes.archivedAt),
        or(like(quotes.title, pattern), like(quotes.number, pattern))
      )
    )
    .orderBy(desc(quotes.createdAt))
    .limit(20)
    .all();

  if (rows.length === 0) return [];
  const quoteIds = rows.map((r) => r.id);
  const allItems = db.select().from(quoteItems).where(inArray(quoteItems.quoteId, quoteIds)).all();
  return rows.map((row) =>
    rowToQuote(
      row,
      allItems.filter((i) => i.quoteId === row.id)
    )
  );
}
