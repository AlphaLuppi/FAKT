/**
 * Entry point sidecar / serveur FAKT API.
 *
 * **Runtime supportés :**
 *   - Bun (mode 1 sidecar local + mode 2 self-host containerisé) — utilise `bun:sqlite` natif.
 *   - Node (tests, dev) — utilise `better-sqlite3`.
 *
 * **Modes de déploiement :**
 *   - Mode 1 (solo local) : `AUTH_MODE=local`, `FAKT_API_TOKEN` shared, bind 127.0.0.1, SQLite.
 *   - Mode 2 (self-host)  : `AUTH_MODE=jwt`, `FAKT_JWT_SECRET`, bind 0.0.0.0, Postgres.
 *   - Mode 3 (SaaS)       : idem mode 2 + RLS Postgres + Stripe + OAuth (futur).
 *
 * Le choix DB se fait via `DATABASE_URL` :
 *   - `postgres://...` ou `postgresql://...` → Postgres (postgres-js).
 *   - sinon → SQLite (driver détecté runtime : bun:sqlite si Bun, better-sqlite3 sinon).
 *
 * Lu par Tauri en mode 1 qui spawn ce binaire en subprocess, récupère le port via stdout
 * (`FAKT_API_READY:port=<N>`) et injecte le token dans le webview.
 */

import { createApp } from "./app.js";
import { loadConfig, type AppRuntimeConfig } from "./config.js";
import type { AppConfig, SqliteLike } from "./types.js";

function fail(reason: string): never {
  process.stderr.write(`${JSON.stringify({ level: "error", event: "startup_failed", reason })}\n`);
  process.exit(1);
}

async function bootstrap(): Promise<void> {
  let config: AppRuntimeConfig;
  try {
    config = loadConfig();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const { db, sqlite } =
    config.dbDialect === "postgresql"
      ? await setupPostgres(config)
      : await setupSqlite(config);

  const appConfig: AppConfig = {
    db,
    sqlite,
    authToken: config.FAKT_API_TOKEN ?? "",
    authMode: config.AUTH_MODE,
    ...(config.FAKT_JWT_SECRET ? { jwtSecret: config.FAKT_JWT_SECRET } : {}),
    cookieSecure: config.AUTH_MODE === "jwt",
  };

  // En mode JWT, on a besoin de pgDb (déjà setupé dans setupPostgres ci-dessus).
  if (config.AUTH_MODE === "jwt") {
    const pgDb = db as unknown as NonNullable<AppConfig["pgDb"]>;
    appConfig.pgDb = pgDb;
  }

  const app = createApp(appConfig);

  type BunGlobal = {
    serve: (opts: {
      port: number;
      hostname: string;
      fetch: (req: Request) => Response | Promise<Response>;
    }) => { port: number; stop: () => void };
  };

  const bun = (globalThis as unknown as { Bun?: BunGlobal }).Bun;
  if (!bun) {
    fail("Bun runtime introuvable — ce serveur doit être lancé avec `bun run`");
  }

  const server = bun.serve({
    port: config.FAKT_API_PORT,
    hostname: config.BIND,
    fetch: (req) => app.fetch(req),
  });

  process.stdout.write(`FAKT_API_READY:port=${server.port}\n`);
  process.stdout.write(
    `${JSON.stringify({
      level: "info",
      event: "listening",
      port: server.port,
      bind: config.BIND,
      authMode: config.AUTH_MODE,
      dbDialect: config.dbDialect,
      pid: process.pid,
    })}\n`
  );

  function shutdown(signal: string): void {
    process.stdout.write(`${JSON.stringify({ level: "info", event: "shutdown", signal })}\n`);
    server.stop();
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ============================================================================
// SQLite path (mode 1 solo local + tests)
// ============================================================================

async function setupSqlite(
  config: AppRuntimeConfig
): Promise<{ db: AppConfig["db"]; sqlite: SqliteLike }> {
  const { Database } = await import("bun:sqlite").catch(() => ({ Database: null as never }));
  if (!Database) {
    fail("bun:sqlite indisponible — sidecar SQLite nécessite Bun runtime");
  }

  const sqlite = new Database(config.FAKT_DB_PATH);
  for (const pragma of [
    "PRAGMA journal_mode = WAL;",
    "PRAGMA foreign_keys = ON;",
    "PRAGMA synchronous = NORMAL;",
  ]) {
    sqlite.run(pragma);
  }

  const { EMBEDDED_MIGRATIONS } = await import("./migrations-embedded.js");
  applyMigrationsIfNeeded(sqlite, EMBEDDED_MIGRATIONS);

  const { drizzle } = await import("drizzle-orm/bun-sqlite");
  const schema = await import("@fakt/db/schema");
  const db = drizzle(sqlite, { schema }) as unknown as AppConfig["db"];

  return { db, sqlite: sqlite as unknown as SqliteLike };
}

interface SqliteRunner {
  run(sql: string, params?: unknown[]): unknown;
  query<T>(sql: string): { all: () => T[] };
}

function applyMigrationsIfNeeded(
  db: SqliteRunner,
  migrations: ReadonlyArray<{ name: string; sql: string }>
): void {
  db.run(
    "CREATE TABLE IF NOT EXISTS __fakt_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);"
  );
  const applied = new Set(
    db.query<{ name: string }>("SELECT name FROM __fakt_migrations").all().map((r) => r.name)
  );
  for (const { name, sql } of migrations) {
    if (applied.has(name)) continue;
    const statements = sql
      .split(/-->\s*statement-breakpoint/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        db.run(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const ignorable =
          msg.includes("duplicate column name") ||
          msg.includes("already exists") ||
          (msg.includes("trigger") && msg.includes("already exists"));
        if (!ignorable) throw err;
      }
    }
    db.run("INSERT INTO __fakt_migrations (name, applied_at) VALUES (?, ?)", [name, Date.now()]);
    process.stdout.write(
      `${JSON.stringify({ level: "info", event: "migration_applied", file: name })}\n`
    );
  }
}

// ============================================================================
// Postgres path (mode 2 self-host + mode 3 SaaS)
// ============================================================================

async function setupPostgres(
  config: AppRuntimeConfig
): Promise<{ db: AppConfig["db"]; sqlite: SqliteLike }> {
  if (!config.DATABASE_URL) {
    fail("DATABASE_URL requis en mode Postgres");
  }
  const { createPgDb } = await import("@fakt/db");
  const pgDb = createPgDb(config.DATABASE_URL);

  // SqliteLike est requis par AppConfig pour la numérotation atomique mode 1.
  // En mode 2, la numérotation utilise pg_advisory_xact_lock — les queries existantes
  // qui appellent `c.var.sqlite.transaction(...)` doivent être adaptées dans une étape
  // ultérieure (queries-pg). Pour l'instant, on fournit un mock qui throw si appelé.
  const sqliteMock: SqliteLike = {
    transaction: () => {
      throw new Error(
        "sqlite transaction not available in Postgres mode — use pg_advisory_xact_lock instead"
      );
    },
  };

  return { db: pgDb as unknown as AppConfig["db"], sqlite: sqliteMock };
}

// ============================================================================
// Run
// ============================================================================

bootstrap().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
