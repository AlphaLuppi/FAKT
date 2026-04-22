/**
 * Helpers pour tests Vitest de @fakt/api-server.
 * Réutilisable par toutes les waves (β, γ, …) pour tester leurs routes.
 *
 * Pattern :
 *   const { app, db, sqlite, token, workspaceId, authHeaders } = createTestApp();
 *   const res = await app.request("/api/workspace", { headers: authHeaders() });
 *   expect(res.status).toBe(200);
 */

import { type TestDb, WORKSPACE_ID, createTestDb, seedWorkspace } from "@fakt/db/__tests__/helpers";
import type Database from "better-sqlite3";
import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import type { AppEnv } from "../src/types.js";

export const TEST_TOKEN = "test-token-fakt-0123456789abcdef";

export interface TestAppHandle {
  app: Hono<AppEnv>;
  db: TestDb;
  sqlite: Database.Database;
  token: string;
  workspaceId: string;
  /** Headers avec auth (+ Content-Type JSON par défaut). */
  authHeaders: (extra?: Record<string, string>) => Record<string, string>;
}

export interface CreateTestAppOptions {
  /** Si false, ne seed pas le workspace par défaut (utile pour tester l'onboarding). */
  seedWorkspaceDefault?: boolean;
  token?: string;
}

export function createTestApp(options: CreateTestAppOptions = {}): TestAppHandle {
  const token = options.token ?? TEST_TOKEN;
  const { db, sqlite } = createTestDb();
  if (options.seedWorkspaceDefault !== false) {
    seedWorkspace(db);
  }
  const app = createApp({ db, sqlite, authToken: token });

  const authHeaders = (extra: Record<string, string> = {}) => ({
    "X-FAKT-Token": token,
    "Content-Type": "application/json",
    ...extra,
  });

  return { app, db, sqlite, token, workspaceId: WORKSPACE_ID, authHeaders };
}
