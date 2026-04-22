import type { DbInstance } from "@fakt/db/adapter";

/** Contexte Hono partagé — injecté par middlewares et consommé dans routes. */
export type AppVariables = {
  requestId: string;
  db: DbInstance;
  authToken: string;
};

export type AppEnv = {
  Variables: AppVariables;
};

export interface AppConfig {
  db: DbInstance;
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

export const API_VERSION = "0.1.0";
