/**
 * Entry point sidecar FAKT API.
 *
 * Runtime : **Bun** exclusivement. Utilise `bun:sqlite` (natif) plutôt que
 * `better-sqlite3` (natif Node) — ça permet au binaire `bun build --compile`
 * de rester self-contained, et évite l'erreur ERR_DLOPEN_FAILED au runtime.
 *
 * Lu par Tauri qui spawn ce binaire Bun en subprocess, récupère le port via stdout
 * (ligne sentinelle `FAKT_API_READY:port=<N>`) et injecte le token dans le webview.
 *
 * Env attendus :
 *   FAKT_API_PORT   (optionnel — défaut 0 = port éphémère alloué par OS)
 *   FAKT_API_TOKEN  (REQUIS — token d'auth partagé avec le front Tauri)
 *   FAKT_DB_PATH    (optionnel — défaut ./fakt.db relatif au cwd)
 */

import { Database } from "bun:sqlite";
import * as schema from "@fakt/db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { createApp } from "./app.js";
import { EMBEDDED_MIGRATIONS } from "./migrations-embedded.js";
import type { SqliteLike } from "./types.js";

function fail(reason: string): never {
  process.stderr.write(`${JSON.stringify({ level: "error", event: "startup_failed", reason })}\n`);
  process.exit(1);
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    fail(`FAKT_API_PORT invalide: ${raw}`);
  }
  return n;
}

const token = process.env.FAKT_API_TOKEN;
if (!token || token.length < 16) {
  fail("FAKT_API_TOKEN requis (>=16 chars)");
}

const port = parsePort(process.env.FAKT_API_PORT);
const dbPath = process.env.FAKT_DB_PATH ?? "fakt.db";

const sqlite = new Database(dbPath);
for (const pragma of [
  "PRAGMA journal_mode = WAL;",
  "PRAGMA foreign_keys = ON;",
  "PRAGMA synchronous = NORMAL;",
]) {
  sqlite.run(pragma);
}

applyMigrationsIfNeeded(sqlite);

// Drizzle bun-sqlite accepte l'instance bun:sqlite directement.
// L'API runtime est identique à better-sqlite3 sur le subset qu'on utilise ;
// la divergence côté types (Session<void> vs Session<RunResult>) impose un
// cast double pour traverser le schisme typé — acceptable car le sidecar
// est Bun-only.
type ApiDb = Parameters<typeof createApp>[0]["db"];
const db: ApiDb = drizzle(sqlite, { schema }) as unknown as ApiDb;

const app = createApp({ db, sqlite: sqlite as unknown as SqliteLike, authToken: token });

type BunGlobal = {
  serve: (opts: {
    port: number;
    hostname: string;
    fetch: (req: Request) => Response | Promise<Response>;
  }) => {
    port: number;
    stop: () => void;
  };
};

const bun = (globalThis as unknown as { Bun?: BunGlobal }).Bun;
if (!bun) {
  fail("Bun runtime introuvable — ce sidecar doit être lancé avec `bun run`");
}

const server = bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch: (req) => app.fetch(req),
});

process.stdout.write(`FAKT_API_READY:port=${server.port}\n`);
process.stdout.write(
  `${JSON.stringify({
    level: "info",
    event: "listening",
    port: server.port,
    pid: process.pid,
    dbPath,
  })}\n`
);

function shutdown(signal: string): void {
  process.stdout.write(`${JSON.stringify({ level: "info", event: "shutdown", signal })}\n`);
  server.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/**
 * Applique les migrations embarquées dans `migrations-embedded.ts`
 * (généré au build-time depuis `packages/db/src/migrations/*.sql`).
 *
 * Rationale : `bun build --compile` ne bundle PAS les fichiers `.sql` lus
 * via `readFileSync` à runtime. Avant v0.1.6, le sidecar cherchait les SQL
 * dans 3 paths relatifs au cwd qui n'existent pas en prod MSI (cwd =
 * `C:\Program Files\FAKT`), et le sidecar crashait au boot avec
 * "migrations introuvables". Fix : embed des SQL au build-time via
 * `scripts/generate-migrations.ts`.
 *
 * Utilise une table de tracking simple (`__fakt_migrations`) plutôt que le
 * système drizzle-kit standard, pour rester portable entre runtimes
 * (bun:sqlite + better-sqlite3) et éviter la dépendance à `meta/_journal.json`.
 */
function applyMigrationsIfNeeded(db: Database): void {
  db.run(
    "CREATE TABLE IF NOT EXISTS __fakt_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);"
  );

  const applied = new Set(
    db
      .query<{ name: string }, []>("SELECT name FROM __fakt_migrations")
      .all()
      .map((r) => r.name)
  );

  for (const { name, sql } of EMBEDDED_MIGRATIONS) {
    if (applied.has(name)) continue;
    // Les migrations Drizzle utilisent `--> statement-breakpoint` pour séparer
    // les statements. bun:sqlite accepte plusieurs statements via `exec` /
    // `run` séparés — on split manuellement pour portabilité.
    const statements = sql
      .split(/-->\s*statement-breakpoint/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        db.run(stmt);
      } catch (err) {
        // Les migrations legacy (0001_triggers, 0003_payment_notes) ciblaient
        // un schema pré-0000 ; la migration drizzle-kit 0000 inclut déjà les
        // colonnes/contraintes. On ignore les doublons inoffensifs pour
        // permettre au bootstrap de rester idempotent.
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
