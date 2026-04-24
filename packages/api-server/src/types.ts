import type { DbInstance } from "@fakt/db/adapter";

/**
 * Type structurel minimal pour le driver SQLite brut.
 * Permet d'accepter `better-sqlite3` (tests) ET `bun:sqlite` (prod)
 * sans dépendance de type directe sur l'un ou l'autre.
 *
 * Consommé pour la numérotation atomique : `sqlite.transaction(fn).immediate()`.
 */
export interface SqliteLike {
  transaction<T>(fn: (...args: unknown[]) => T): {
    (...args: unknown[]): T;
    immediate: (...args: unknown[]) => T;
    deferred: (...args: unknown[]) => T;
    exclusive: (...args: unknown[]) => T;
  };
}

/** Contexte Hono partagé — injecté par middlewares et consommé dans routes. */
export type AppVariables = {
  requestId: string;
  db: DbInstance;
  sqlite: SqliteLike;
  authToken: string;
};

export type AppEnv = {
  Variables: AppVariables;
};

export interface AppConfig {
  db: DbInstance;
  /** Client SQLite brut (better-sqlite3 ou bun:sqlite) — requis pour numérotation atomique. */
  sqlite: SqliteLike;
  authToken: string;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export const API_VERSION = "0.1.4";
