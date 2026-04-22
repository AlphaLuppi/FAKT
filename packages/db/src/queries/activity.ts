/**
 * Queries activity feed.
 * Journal d'événements métier (client.created, quote.signed, invoice.paid, email.drafted, etc.).
 * Ordre desc sur createdAt pour affichage sidebar. Append-only côté métier.
 */

import { eq, and, desc } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { activity } from "../schema/index.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ListActivityInput {
  workspaceId: string;
  entityType?: string;
  entityId?: string;
  type?: string;
  since?: number;
  limit?: number;
  offset?: number;
}

export interface InsertActivityInput {
  id: string;
  workspaceId: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: string | null;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  payload: string | null;
  createdAt: number;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToEvent(row: typeof activity.$inferSelect): ActivityEvent {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    payload: row.payload ?? null,
    createdAt: Number(row.createdAt),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Liste les events d'un workspace, ordre desc createdAt. */
export function listActivity(db: DbInstance, input: ListActivityInput): ActivityEvent[] {
  const { workspaceId, entityType, entityId, type, limit = 50, offset = 0 } = input;

  const conditions = [eq(activity.workspaceId, workspaceId)];
  if (entityType) conditions.push(eq(activity.entityType, entityType));
  if (entityId) conditions.push(eq(activity.entityId, entityId));
  if (type) conditions.push(eq(activity.type, type));

  const rows = db
    .select()
    .from(activity)
    .where(and(...conditions))
    .orderBy(desc(activity.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map(rowToEvent);
}

/** Insère un event (append-only côté métier ; pas de trigger SQL — la DB ne bloque pas). */
export function insertActivity(db: DbInstance, input: InsertActivityInput): ActivityEvent {
  const now = new Date(Date.now());
  const row = db
    .insert(activity)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload ?? null,
      createdAt: now,
    })
    .returning()
    .get();

  if (!row) throw new Error(`insertActivity: insert returned no row for id=${input.id}`);
  return rowToEvent(row);
}
