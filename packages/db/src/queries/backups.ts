/**
 * Queries journal des exports workspace ZIP.
 * Les bytes ZIP restent sur disque, cette table ne mémorise que path + size + timestamp.
 */

import { desc, eq } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { backups } from "../schema/index.js";

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface BackupRecord {
  id: string;
  path: string;
  sizeBytes: number;
  createdAt: number;
}

export interface InsertBackupInput {
  id: string;
  path: string;
  sizeBytes: number;
}

export interface ListBackupsInput {
  limit?: number;
  offset?: number;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToBackup(row: typeof backups.$inferSelect): BackupRecord {
  return {
    id: row.id,
    path: row.path,
    sizeBytes: row.sizeBytes,
    createdAt: Number(row.createdAt),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Liste l'historique ordre desc createdAt. */
export function listBackups(db: DbInstance, input: ListBackupsInput = {}): BackupRecord[] {
  const { limit = 50, offset = 0 } = input;
  const rows = db
    .select()
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
  return rows.map(rowToBackup);
}

/** Insère un enregistrement backup (sizeBytes >= 0). */
export function insertBackup(db: DbInstance, input: InsertBackupInput): BackupRecord {
  const now = new Date(Date.now());
  const row = db
    .insert(backups)
    .values({
      id: input.id,
      path: input.path,
      sizeBytes: input.sizeBytes,
      createdAt: now,
    })
    .returning()
    .get();
  if (!row) throw new Error(`insertBackup: insert returned no row for id=${input.id}`);
  return rowToBackup(row);
}

/** Supprime un enregistrement (ne touche pas au fichier disque). */
export function deleteBackup(db: DbInstance, id: string): void {
  const existing = db.select().from(backups).where(eq(backups.id, id)).get();
  if (!existing) throw new Error(`deleteBackup: backup not found id=${id}`);
  db.delete(backups).where(eq(backups.id, id)).run();
}
