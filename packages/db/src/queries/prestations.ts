/**
 * Queries CRUD prestations (bibliothèque de services réutilisables).
 * Soft delete uniquement (archived_at).
 */

import type { DocumentUnit, Service } from "@fakt/shared";
import { and, asc, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { services } from "../schema/index.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ListPrestationsInput {
  workspaceId: string;
  search?: string;
  includeSoftDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreatePrestationInput {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  unit: DocumentUnit;
  unitPriceCents: number;
  tags?: string[] | null;
}

export interface UpdatePrestationInput {
  name?: string;
  description?: string | null;
  unit?: DocumentUnit;
  unitPriceCents?: number;
  tags?: string[] | null;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToService(row: typeof services.$inferSelect): Service {
  let tags: string[] | null = null;
  if (row.tags) {
    try {
      const parsed: unknown = JSON.parse(row.tags);
      tags = Array.isArray(parsed) ? (parsed as string[]) : null;
    } catch {
      tags = null;
    }
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description ?? null,
    unit: row.unit as DocumentUnit,
    unitPriceCents: row.unitPriceCents,
    tags,
    archivedAt: row.archivedAt ? Number(row.archivedAt) : null,
    createdAt: Number(row.createdAt),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Liste les prestations d'un workspace. */
export function listPrestations(db: DbInstance, input: ListPrestationsInput): Service[] {
  const { workspaceId, search, includeSoftDeleted = false, limit = 50, offset = 0 } = input;

  const conditions = [eq(services.workspaceId, workspaceId)];

  if (!includeSoftDeleted) {
    conditions.push(isNull(services.archivedAt));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(like(services.name, pattern), like(services.description, pattern)) ??
        eq(services.workspaceId, workspaceId)
    );
  }

  const rows = db
    .select()
    .from(services)
    .where(and(...conditions))
    .orderBy(asc(services.name))
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map(rowToService);
}

/** Récupère une prestation par son ID. */
export function getPrestation(db: DbInstance, id: string): Service | null {
  const row = db.select().from(services).where(eq(services.id, id)).get();
  return row ? rowToService(row) : null;
}

/** Crée une nouvelle prestation. */
export function createPrestation(db: DbInstance, input: CreatePrestationInput): Service {
  const now = new Date(Date.now());
  const row = db
    .insert(services)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description ?? null,
      unit: input.unit,
      unitPriceCents: input.unitPriceCents,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      archivedAt: null,
      createdAt: now,
    })
    .returning()
    .get();

  if (!row) throw new Error(`createPrestation: insert returned no row for id=${input.id}`);
  return rowToService(row);
}

/** Met à jour une prestation existante. */
export function updatePrestation(
  db: DbInstance,
  id: string,
  input: UpdatePrestationInput
): Service {
  const updates: Partial<typeof services.$inferInsert> = {};

  if (input.name !== undefined) updates.name = input.name;
  if ("description" in input) updates.description = input.description ?? null;
  if (input.unit !== undefined) updates.unit = input.unit;
  if (input.unitPriceCents !== undefined) updates.unitPriceCents = input.unitPriceCents;
  if ("tags" in input) updates.tags = input.tags ? JSON.stringify(input.tags) : null;

  const row = db.update(services).set(updates).where(eq(services.id, id)).returning().get();

  if (!row) throw new Error(`updatePrestation: prestation not found id=${id}`);
  return rowToService(row);
}

/** Soft delete : archive la prestation. */
export function softDeletePrestation(db: DbInstance, id: string): void {
  const result = db
    .update(services)
    .set({ archivedAt: new Date(Date.now()) })
    .where(and(eq(services.id, id), isNull(services.archivedAt)))
    .returning({ id: services.id })
    .get();

  if (!result)
    throw new Error(`softDeletePrestation: prestation not found or already archived id=${id}`);
}

/** Restaure une prestation archivée (archivedAt → null). */
export function restorePrestation(db: DbInstance, id: string): Service {
  const row = db
    .update(services)
    .set({ archivedAt: null })
    .where(and(eq(services.id, id), isNotNull(services.archivedAt)))
    .returning()
    .get();

  if (!row) throw new Error(`restorePrestation: prestation not found or not archived id=${id}`);
  return rowToService(row);
}

/** Recherche de prestations par nom ou description. */
export function searchPrestations(db: DbInstance, workspaceId: string, q: string): Service[] {
  const pattern = `%${q}%`;
  const rows = db
    .select()
    .from(services)
    .where(
      and(
        eq(services.workspaceId, workspaceId),
        isNull(services.archivedAt),
        or(like(services.name, pattern), like(services.description, pattern))
      )
    )
    .orderBy(asc(services.name))
    .limit(20)
    .all();

  return rows.map(rowToService);
}
