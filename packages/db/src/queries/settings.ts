/**
 * Queries settings & workspace.
 * Le workspace est un singleton (mono-user v0.1).
 * Les settings sont un K/V par workspace.
 */

import { eq, and } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { workspaces, settings } from "../schema/index.js";
import type { Workspace } from "@fakt/shared";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface UpdateWorkspaceInput {
  name?: string;
  legalForm?: string;
  siret?: string;
  address?: string;
  email?: string;
  iban?: string | null;
  tvaMention?: string;
}

export interface SettingEntry {
  key: string;
  value: string;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToWorkspace(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    legalForm: row.legalForm as Workspace["legalForm"],
    siret: row.siret,
    address: row.address,
    email: row.email,
    iban: row.iban ?? null,
    tvaMention: row.tvaMention,
    createdAt: Number(row.createdAt),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Récupère le workspace (singleton mono-user v0.1).
 * Retourne null si aucun workspace n'a encore été créé (premier lancement).
 */
export function getWorkspace(db: DbInstance): Workspace | null {
  const row = db.select().from(workspaces).limit(1).get();
  return row ? rowToWorkspace(row) : null;
}

/** Met à jour les champs du workspace. */
export function updateWorkspace(
  db: DbInstance,
  workspaceId: string,
  input: UpdateWorkspaceInput
): Workspace {
  const updates: Partial<typeof workspaces.$inferInsert> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.legalForm !== undefined) updates.legalForm = input.legalForm;
  if (input.siret !== undefined) updates.siret = input.siret;
  if (input.address !== undefined) updates.address = input.address;
  if (input.email !== undefined) updates.email = input.email;
  if ("iban" in input) updates.iban = input.iban ?? null;
  if (input.tvaMention !== undefined) updates.tvaMention = input.tvaMention;

  const row = db
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, workspaceId))
    .returning()
    .get();

  if (!row) throw new Error(`updateWorkspace: workspace not found id=${workspaceId}`);
  return rowToWorkspace(row);
}

/** Récupère la valeur d'un paramètre pour un workspace. Retourne null si absent. */
export function getSetting(db: DbInstance, workspaceId: string, key: string): string | null {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)))
    .get();
  return row?.value ?? null;
}

/** Upsert un paramètre workspace (insert ou update). */
export function setSetting(
  db: DbInstance,
  workspaceId: string,
  key: string,
  value: string
): void {
  const now = Date.now();
  db.insert(settings)
    .values({ workspaceId, key, value, updatedAt: new Date(now) })
    .onConflictDoUpdate({
      target: [settings.workspaceId, settings.key],
      set: { value, updatedAt: new Date(now) },
    })
    .run();
}

/** Récupère tous les paramètres d'un workspace. */
export function getAllSettings(db: DbInstance, workspaceId: string): SettingEntry[] {
  return db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.workspaceId, workspaceId))
    .all();
}
