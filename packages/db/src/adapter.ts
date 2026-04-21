/**
 * Adaptateur SQLite partagé pour les queries.
 * Chaque query reçoit une instance BetterSQLite3Database provenant de l'appelant
 * (Tauri command layer ou tests Vitest en :memory:).
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema/index.js";

export type DbInstance = BetterSQLite3Database<typeof schema>;

/** Crée une instance Drizzle depuis un chemin de fichier. */
export function createDb(path: string): DbInstance {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  return drizzle(sqlite, { schema });
}

/** Crée une instance DB en mémoire (tests). Applique optionnellement du SQL brut. */
export function createTestDb(initSql?: string): {
  db: DbInstance;
  sqlite: Database.Database;
} {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  if (initSql) {
    sqlite.exec(initSql);
  }
  return { db, sqlite };
}
