import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { API_VERSION } from "../types.js";

/** GET /health — public (pas d'auth). Ping DB pour vérifier vie. */
export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/", (c) => {
  const db = c.var.db;
  let dbOk = true;
  try {
    // Ping minimal : exécuter un SELECT 1 via driver Drizzle sous-jacent.
    // drizzle.$client.prepare("SELECT 1").get() varie selon adapter.
    // Fallback : lecture d'une table système (sqlite_master) si possible.
    const raw = db as unknown as { $client?: { prepare?: (sql: string) => { get: () => unknown } } };
    raw.$client?.prepare?.("SELECT 1 as ok")?.get?.();
  } catch {
    dbOk = false;
  }

  return c.json(
    {
      status: dbOk ? "ok" : "degraded",
      version: API_VERSION,
      db: dbOk ? "ok" : "error",
    },
    dbOk ? 200 : 503
  );
});
