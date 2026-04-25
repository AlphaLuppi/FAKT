export * from "./schema/index.js";
export * from "./queries/index.js";
export * from "./adapter.js";

// Postgres adapter (mode 2 self-host + mode 3 SaaS) — schéma exposé sous namespace
// pour éviter les conflits de noms avec le schéma SQLite.
export * as pgSchema from "./schema/pg.js";
export {
  createPgDb,
  createPgDbWithClient,
  type PgDbInstance,
  type PgClient,
  type CreatePgDbOptions,
} from "./adapter-pg.js";
