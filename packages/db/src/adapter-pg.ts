/**
 * Adaptateur Postgres pour les queries (mode 2 self-host + mode 3 SaaS).
 *
 * Cohabite avec adapter.ts (SQLite mode 1 solo). Le choix se fait runtime
 * via l'env DATABASE_URL côté api-server.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/pg.js";

export type PgDbInstance = PostgresJsDatabase<typeof schema>;

export interface CreatePgDbOptions {
  /** Connexion pool max connexions. Défaut 10 (raisonnable 5 users). */
  maxConnections?: number;
  /** Timeout connection idle en secondes avant fermeture. */
  idleTimeout?: number;
  /** SSL — true pour managed Postgres, false pour Docker local. */
  ssl?: boolean | "require" | "prefer";
}

/**
 * Crée une instance Drizzle Postgres depuis une URL de connexion.
 *
 * Format : postgres://user:password@host:port/database
 * En production sur Dokploy/VPS : utilise DATABASE_URL injecté au container.
 */
export function createPgDb(connectionUrl: string, options: CreatePgDbOptions = {}): PgDbInstance {
  const sql = postgres(connectionUrl, {
    max: options.maxConnections ?? 10,
    idle_timeout: options.idleTimeout ?? 30,
    ssl: options.ssl ?? false,
  });
  return drizzle(sql, { schema });
}

/** Test helper : crée une DB Postgres in-memory n'est pas possible — utilise un container Postgres test. */
export type PgClient = ReturnType<typeof postgres>;

/** Pour shutdown propre : exporte le sql client pour pouvoir le fermer. */
export function createPgDbWithClient(
  connectionUrl: string,
  options: CreatePgDbOptions = {}
): { db: PgDbInstance; sql: PgClient } {
  const sql = postgres(connectionUrl, {
    max: options.maxConnections ?? 10,
    idle_timeout: options.idleTimeout ?? 30,
    ssl: options.ssl ?? false,
  });
  return { db: drizzle(sql, { schema }), sql };
}
