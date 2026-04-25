import { z } from "zod";

/**
 * Configuration runtime du sidecar / serveur API FAKT.
 *
 * Les modes sont déterminés par `AUTH_MODE` :
 *   - `local`  : mode 1 solo desktop, header X-FAKT-Token (token shared).
 *   - `jwt`    : mode 2 self-host + mode 3 SaaS, JWT HS256 cookie/bearer.
 *
 * `DATABASE_URL` détermine le driver :
 *   - Préfixe `postgres://` ou `postgresql://` → adapter Postgres (postgres-js).
 *   - Sinon → adapter SQLite (better-sqlite3 ou bun:sqlite côté sidecar).
 *
 * Variables d'environnement chargées depuis `process.env`. Override via `.env.local` côté ops.
 */

const ConfigSchema = z.object({
  // Mode auth
  AUTH_MODE: z.enum(["local", "jwt"]).default("local"),

  // DB
  DATABASE_URL: z.string().min(1).optional(),
  FAKT_DB_PATH: z.string().min(1).default("fakt.db"),

  // JWT (requis si AUTH_MODE=jwt)
  FAKT_JWT_SECRET: z.string().min(32).optional(),

  // Local token (requis si AUTH_MODE=local)
  FAKT_API_TOKEN: z.string().min(16).optional(),

  // Bind
  BIND: z.string().default("127.0.0.1"),
  FAKT_API_PORT: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().min(0).max(65535))
    .default("0"),

  // CORS
  FAKT_API_EXTRA_ORIGINS: z.string().optional(),

  // Admin (migration one-shot)
  FAKT_ADMIN_TOKEN: z.string().min(32).optional(),

  // Storage
  FAKT_SIGNED_PDFS_DIR: z.string().default("/var/lib/fakt/signed"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppRuntimeConfig = z.infer<typeof ConfigSchema> & {
  /** Discriminé : "sqlite" (file path ou mémoire) vs "postgresql". */
  dbDialect: "sqlite" | "postgresql";
};

export function loadConfig(): AppRuntimeConfig {
  const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } })
    .process?.env ?? {};
  const raw = ConfigSchema.parse(env);

  const dbDialect: "sqlite" | "postgresql" = raw.DATABASE_URL?.startsWith("postgres")
    ? "postgresql"
    : "sqlite";

  // Validation cross-field
  if (raw.AUTH_MODE === "jwt" && !raw.FAKT_JWT_SECRET) {
    throw new Error("AUTH_MODE=jwt requires FAKT_JWT_SECRET (min 32 chars)");
  }
  if (raw.AUTH_MODE === "local" && !raw.FAKT_API_TOKEN) {
    throw new Error("AUTH_MODE=local requires FAKT_API_TOKEN (min 16 chars)");
  }
  if (dbDialect === "postgresql" && raw.AUTH_MODE === "local") {
    // Avertissement : Postgres + local token c'est inhabituel mais pas illégal (dev).
    // Pas de throw.
  }

  return { ...raw, dbDialect };
}
