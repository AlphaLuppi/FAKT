/**
 * Entry point sidecar FAKT API.
 * Lu par Tauri qui spawn ce binaire Bun en subprocess, récupère le port via stdout
 * (ligne sentinelle `FAKT_API_READY:port=<N>`) et injecte le token dans le webview.
 *
 * Env attendus :
 *   FAKT_API_PORT   (optionnel — défaut 0 = port éphémère alloué par OS)
 *   FAKT_API_TOKEN  (REQUIS — token d'auth partagé avec le front Tauri)
 *   FAKT_DB_PATH    (optionnel — défaut ./fakt.db relatif au cwd)
 */

import { createDb } from "@fakt/db/adapter";
import { createApp } from "./app.js";

function fail(reason: string): never {
  process.stderr.write(
    JSON.stringify({ level: "error", event: "startup_failed", reason }) + "\n"
  );
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

const token = process.env["FAKT_API_TOKEN"];
if (!token || token.length < 16) {
  fail("FAKT_API_TOKEN requis (>=16 chars)");
}

const port = parsePort(process.env["FAKT_API_PORT"]);
const dbPath = process.env["FAKT_DB_PATH"] ?? "fakt.db";

const db = createDb(dbPath);
const app = createApp({ db, authToken: token });

type BunGlobal = {
  serve: (opts: { port: number; hostname: string; fetch: (req: Request) => Response | Promise<Response> }) => {
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
  JSON.stringify({
    level: "info",
    event: "listening",
    port: server.port,
    pid: process.pid,
    dbPath,
  }) + "\n"
);

function shutdown(signal: string): void {
  process.stdout.write(
    JSON.stringify({ level: "info", event: "shutdown", signal }) + "\n"
  );
  server.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
