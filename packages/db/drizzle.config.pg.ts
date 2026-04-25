import { defineConfig } from "drizzle-kit";

// drizzle-kit exécute ce fichier en Node — process global existe runtime.
declare const process: { env: Record<string, string | undefined> };

/**
 * Config drizzle-kit pour le dialecte Postgres (mode 2 self-host + mode 3 SaaS).
 *
 * Usage :
 *   bun run db:generate:pg            (génère migrations dans src/migrations-pg/)
 *   bun run db:push:pg                (applique direct sur DB cible — dev only)
 *
 * En CI/déploiement, les migrations sont appliquées au boot de l'api-server
 * via drizzle-orm/postgres-js/migrator, pas via drizzle-kit.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/pg.ts",
  out: "./src/migrations-pg",
  dbCredentials: {
    url: process.env.FAKT_PG_URL ?? "postgres://fakt:fakt@localhost:5432/fakt",
  },
  verbose: true,
  strict: true,
});
