/**
 * Queries CRUD clients.
 * Soft delete uniquement (archived_at) — contrainte légale archivage documents liés.
 */

import { eq, and, like, isNull, isNotNull, or, desc, asc } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { clients } from "../schema/index.js";
import type { Client } from "@fakt/shared";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface ListClientsInput {
  workspaceId: string;
  search?: string;
  includeSoftDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateClientInput {
  id: string;
  workspaceId: string;
  name: string;
  legalForm?: string | null;
  siret?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  sector?: string | null;
  firstCollaboration?: number | null;
  note?: string | null;
}

export interface UpdateClientInput {
  name?: string;
  legalForm?: string | null;
  siret?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  sector?: string | null;
  firstCollaboration?: number | null;
  note?: string | null;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    legalForm: row.legalForm ?? null,
    siret: row.siret ?? null,
    address: row.address ?? null,
    contactName: row.contactName ?? null,
    email: row.email ?? null,
    sector: row.sector ?? null,
    firstCollaboration: row.firstCollaboration ? Number(row.firstCollaboration) : null,
    note: row.note ?? null,
    archivedAt: row.archivedAt ? Number(row.archivedAt) : null,
    createdAt: Number(row.createdAt),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Liste les clients d'un workspace avec pagination et recherche optionnelles. */
export function listClients(db: DbInstance, input: ListClientsInput): Client[] {
  const { workspaceId, search, includeSoftDeleted = false, limit = 50, offset = 0 } = input;

  const conditions = [eq(clients.workspaceId, workspaceId)];

  if (!includeSoftDeleted) {
    conditions.push(isNull(clients.archivedAt));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(like(clients.name, pattern), like(clients.email, pattern)) ?? eq(clients.workspaceId, workspaceId)
    );
  }

  const rows = db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(asc(clients.name))
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map(rowToClient);
}

/** Récupère un client par son ID. Retourne null si inexistant. */
export function getClient(db: DbInstance, id: string): Client | null {
  const row = db.select().from(clients).where(eq(clients.id, id)).get();
  return row ? rowToClient(row) : null;
}

/** Crée un nouveau client. */
export function createClient(db: DbInstance, input: CreateClientInput): Client {
  const now = new Date(Date.now());
  const row = db
    .insert(clients)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      legalForm: input.legalForm ?? null,
      siret: input.siret ?? null,
      address: input.address ?? null,
      contactName: input.contactName ?? null,
      email: input.email ?? null,
      sector: input.sector ?? null,
      firstCollaboration: input.firstCollaboration ? new Date(input.firstCollaboration) : null,
      note: input.note ?? null,
      archivedAt: null,
      createdAt: now,
    })
    .returning()
    .get();

  if (!row) throw new Error(`createClient: insert returned no row for id=${input.id}`);
  return rowToClient(row);
}

/** Met à jour les champs éditables d'un client. Retourne le client mis à jour. */
export function updateClient(db: DbInstance, id: string, input: UpdateClientInput): Client {
  const updates: Partial<typeof clients.$inferInsert> = {};

  if (input.name !== undefined) updates.name = input.name;
  if ("legalForm" in input) updates.legalForm = input.legalForm ?? null;
  if ("siret" in input) updates.siret = input.siret ?? null;
  if ("address" in input) updates.address = input.address ?? null;
  if ("contactName" in input) updates.contactName = input.contactName ?? null;
  if ("email" in input) updates.email = input.email ?? null;
  if ("sector" in input) updates.sector = input.sector ?? null;
  if ("firstCollaboration" in input) {
    updates.firstCollaboration = input.firstCollaboration
      ? new Date(input.firstCollaboration)
      : null;
  }
  if ("note" in input) updates.note = input.note ?? null;

  const row = db
    .update(clients)
    .set(updates)
    .where(eq(clients.id, id))
    .returning()
    .get();

  if (!row) throw new Error(`updateClient: client not found id=${id}`);
  return rowToClient(row);
}

/** Soft delete : marque le client comme archivé. */
export function softDeleteClient(db: DbInstance, id: string): void {
  const result = db
    .update(clients)
    .set({ archivedAt: new Date(Date.now()) })
    .where(and(eq(clients.id, id), isNull(clients.archivedAt)))
    .returning({ id: clients.id })
    .get();

  if (!result) throw new Error(`softDeleteClient: client not found or already archived id=${id}`);
}

/** Recherche de clients par nom ou email (full-text simple LIKE). */
export function searchClients(db: DbInstance, workspaceId: string, q: string): Client[] {
  const pattern = `%${q}%`;
  const rows = db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        isNull(clients.archivedAt),
        or(like(clients.name, pattern), like(clients.email, pattern))
      )
    )
    .orderBy(asc(clients.name))
    .limit(20)
    .all();

  return rows.map(rowToClient);
}
