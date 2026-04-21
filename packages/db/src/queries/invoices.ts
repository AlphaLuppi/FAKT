/**
 * Queries CRUD factures avec lignes jointes.
 * Règles critiques :
 * - hard delete interdit si status ≠ 'draft' (guard TS + trigger SQL)
 * - archivage 10 ans via archived_at (jamais hard delete sur émises)
 * - createFromQuote : modes deposit30, balance, full
 */

import { eq, and, like, isNull, or, desc, inArray } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { invoices, invoiceItems, quotes, quoteItems } from "../schema/index.js";
import { canTransitionInvoice } from "@fakt/core";
import type { Invoice, InvoiceStatus, InvoiceKind, DocumentUnit, PaymentMethod } from "@fakt/shared";
import type { QuoteItemInput } from "./quotes.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ListInvoicesInput {
  workspaceId: string;
  status?: InvoiceStatus | InvoiceStatus[];
  clientId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

export interface InvoiceItemInput {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  unit: DocumentUnit;
  lineTotalCents: number;
  serviceId?: string | null;
}

export interface CreateInvoiceInput {
  id: string;
  workspaceId: string;
  clientId: string;
  quoteId?: string | null;
  kind: InvoiceKind;
  depositPercent?: number | null;
  title: string;
  totalHtCents: number;
  dueDate?: number | null;
  legalMentions: string;
  items: InvoiceItemInput[];
}

export interface UpdateInvoiceInput {
  clientId?: string;
  title?: string;
  kind?: InvoiceKind;
  depositPercent?: number | null;
  totalHtCents?: number;
  dueDate?: number | null;
  legalMentions?: string;
  number?: string | null;
  year?: number | null;
  sequence?: number | null;
  issuedAt?: number | null;
  items?: InvoiceItemInput[];
}

export type CreateFromQuoteMode = "deposit30" | "balance" | "full";

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToInvoice(
  row: typeof invoices.$inferSelect,
  itemRows: (typeof invoiceItems.$inferSelect)[]
): Invoice {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    clientId: row.clientId,
    quoteId: row.quoteId ?? null,
    number: row.number ?? null,
    year: row.year ?? null,
    sequence: row.sequence ?? null,
    kind: row.kind as InvoiceKind,
    depositPercent: row.depositPercent ?? null,
    title: row.title,
    status: row.status as InvoiceStatus,
    totalHtCents: row.totalHtCents,
    dueDate: row.dueDate ? Number(row.dueDate) : null,
    paidAt: row.paidAt ? Number(row.paidAt) : null,
    paymentMethod: (row.paymentMethod as PaymentMethod) ?? null,
    legalMentions: row.legalMentions,
    issuedAt: row.issuedAt ? Number(row.issuedAt) : null,
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

function upsertItems(db: DbInstance, invoiceId: string, items: InvoiceItemInput[]): void {
  db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).run();
  if (items.length === 0) return;
  db.insert(invoiceItems)
    .values(
      items.map((item) => ({
        id: item.id,
        invoiceId,
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

/**
 * Guard TS : vérifie qu'une facture peut être hard-deleted.
 * Le trigger SQL dans 0001_triggers.sql fait la même vérification côté DB.
 */
export function cannotDeleteIssued(status: InvoiceStatus): boolean {
  return status !== "draft";
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Liste les factures d'un workspace. */
export function listInvoices(db: DbInstance, input: ListInvoicesInput): Invoice[] {
  const { workspaceId, status, clientId, includeArchived = false, limit = 50, offset = 0 } = input;

  const conditions = [eq(invoices.workspaceId, workspaceId)];

  if (!includeArchived) conditions.push(isNull(invoices.archivedAt));
  if (clientId) conditions.push(eq(invoices.clientId, clientId));

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    if (statuses.length === 1 && statuses[0]) {
      conditions.push(eq(invoices.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(invoices.status, statuses));
    }
  }

  const rows = db
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  if (rows.length === 0) return [];

  const invoiceIds = rows.map((r) => r.id);
  const allItems = db
    .select()
    .from(invoiceItems)
    .where(inArray(invoiceItems.invoiceId, invoiceIds))
    .all();

  return rows.map((row) => rowToInvoice(row, allItems.filter((i) => i.invoiceId === row.id)));
}

/** Récupère une facture avec ses lignes. */
export function getInvoice(db: DbInstance, id: string): Invoice | null {
  const row = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!row) return null;
  const items = db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).all();
  return rowToInvoice(row, items);
}

/** Crée une facture indépendante ou depuis un contexte existant. */
export function createInvoice(db: DbInstance, input: CreateInvoiceInput): Invoice {
  const now = new Date(Date.now());

  const row = db
    .insert(invoices)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      quoteId: input.quoteId ?? null,
      kind: input.kind,
      depositPercent: input.depositPercent ?? null,
      title: input.title,
      totalHtCents: input.totalHtCents,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      legalMentions: input.legalMentions,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  if (!row) throw new Error(`createInvoice: insert returned no row for id=${input.id}`);

  upsertItems(db, input.id, input.items);

  const created = getInvoice(db, input.id);
  if (!created) throw new Error(`createInvoice: could not reload invoice id=${input.id}`);
  return created;
}

/**
 * Crée une facture depuis un devis signé.
 * - deposit30 : 30 % du total HT
 * - full : 100 % du total HT (facture totale)
 * - balance : solde = total - somme des acomptes déjà émis
 */
export function createInvoiceFromQuote(
  db: DbInstance,
  newInvoiceId: string,
  quoteId: string,
  mode: CreateFromQuoteMode,
  legalMentions: string
): Invoice {
  const quote = db.select().from(quotes).where(eq(quotes.id, quoteId)).get();
  if (!quote) throw new Error(`createInvoiceFromQuote: quote not found id=${quoteId}`);
  if (quote.status !== "signed") {
    throw new Error(
      `createInvoiceFromQuote: quote must be signed (current: ${quote.status})`
    );
  }

  const quoteLines = db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId))
    .all();

  let totalHtCents: number;
  let kind: InvoiceKind;
  let depositPercent: number | null = null;

  if (mode === "deposit30") {
    kind = "deposit";
    depositPercent = 30;
    totalHtCents = Math.floor((quote.totalHtCents * 30) / 100);
  } else if (mode === "full") {
    kind = "total";
    totalHtCents = quote.totalHtCents;
  } else {
    // balance : calcule ce qui reste après les acomptes déjà émis
    kind = "balance";
    const existingDeposits = db
      .select({ totalHtCents: invoices.totalHtCents })
      .from(invoices)
      .where(
        and(
          eq(invoices.quoteId, quoteId),
          eq(invoices.kind, "deposit")
        )
      )
      .all();

    const depositsPaid = existingDeposits.reduce((sum, inv) => sum + inv.totalHtCents, 0);
    totalHtCents = quote.totalHtCents - depositsPaid;

    if (totalHtCents <= 0) {
      throw new Error(
        `createInvoiceFromQuote: balance is zero or negative (total=${quote.totalHtCents}, deposits=${depositsPaid})`
      );
    }
  }

  const now = new Date(Date.now());

  const row = db
    .insert(invoices)
    .values({
      id: newInvoiceId,
      workspaceId: quote.workspaceId,
      clientId: quote.clientId,
      quoteId,
      kind,
      depositPercent,
      title: quote.title,
      totalHtCents,
      legalMentions,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  if (!row) throw new Error(`createInvoiceFromQuote: insert returned no row`);

  // Copie les lignes du devis avec les montants proportionnels
  const ratio = totalHtCents / quote.totalHtCents;
  upsertItems(db, newInvoiceId, quoteLines.map((item) => ({
    id: crypto.randomUUID(),
    position: item.position,
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    unit: item.unit as DocumentUnit,
    lineTotalCents: Math.round(item.lineTotalCents * ratio),
    serviceId: item.serviceId ?? null,
  })));

  const created = getInvoice(db, newInvoiceId);
  if (!created) throw new Error(`createInvoiceFromQuote: could not reload invoice id=${newInvoiceId}`);
  return created;
}

/** Met à jour une facture et ses lignes (draft seulement pour les champs sensibles). */
export function updateInvoice(db: DbInstance, id: string, input: UpdateInvoiceInput): Invoice {
  const existing = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!existing) throw new Error(`updateInvoice: invoice not found id=${id}`);

  const updates: Partial<typeof invoices.$inferInsert> = {
    updatedAt: new Date(Date.now()),
  };

  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.title !== undefined) updates.title = input.title;
  if (input.kind !== undefined) updates.kind = input.kind;
  if ("depositPercent" in input) updates.depositPercent = input.depositPercent ?? null;
  if (input.totalHtCents !== undefined) updates.totalHtCents = input.totalHtCents;
  if ("dueDate" in input) updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.legalMentions !== undefined) updates.legalMentions = input.legalMentions;
  if ("number" in input) updates.number = input.number ?? null;
  if ("year" in input) updates.year = input.year ?? null;
  if ("sequence" in input) updates.sequence = input.sequence ?? null;
  if ("issuedAt" in input) updates.issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;

  db.update(invoices).set(updates).where(eq(invoices.id, id)).run();

  if (input.items !== undefined) {
    upsertItems(db, id, input.items);
  }

  const updated = getInvoice(db, id);
  if (!updated) throw new Error(`updateInvoice: could not reload invoice id=${id}`);
  return updated;
}

/**
 * Marque une facture comme payée.
 * Transition valide : sent → paid, overdue → paid.
 */
export function markInvoicePaid(
  db: DbInstance,
  id: string,
  paidAt: number,
  method: PaymentMethod
): Invoice {
  const row = db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .get();

  if (!row) throw new Error(`markInvoicePaid: invoice not found id=${id}`);

  const current = row.status as InvoiceStatus;
  if (!canTransitionInvoice(current, "paid")) {
    throw new Error(
      `markInvoicePaid: invalid transition ${current} → paid`
    );
  }

  db.update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(paidAt),
      paymentMethod: method,
      updatedAt: new Date(Date.now()),
    })
    .where(eq(invoices.id, id))
    .run();

  const updated = getInvoice(db, id);
  if (!updated) throw new Error(`markInvoicePaid: could not reload invoice id=${id}`);
  return updated;
}
