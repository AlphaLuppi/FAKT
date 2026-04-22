import type { DbInstance } from "@fakt/db/adapter";
import { getWorkspace, nextNumberAtomic, peekNextNumber } from "@fakt/db/queries";
import { Hono } from "hono";
import { notFound } from "../errors.js";
import { parseBody, parseQuery } from "../middleware/zod.js";
import { numberingNextBodySchema, numberingPeekQuerySchema } from "../schemas/numbering.js";
import type { AppEnv } from "../types.js";

export const numberingRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: DbInstance): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

/** GET /api/numbering/peek?type=quote|invoice — prochain numéro SANS incrément. */
numberingRoutes.get("/peek", (c) => {
  const query = parseQuery(c, numberingPeekQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const result = peekNextNumber(c.var.db, workspaceId, query.type);
  return c.json(result);
});

/** POST /api/numbering/next — incrémente atomiquement (BEGIN IMMEDIATE). CGI art. 289. */
numberingRoutes.post("/next", async (c) => {
  const body = await parseBody(c, numberingNextBodySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const result = nextNumberAtomic(c.var.sqlite, c.var.db, workspaceId, body.type);
  return c.json(result);
});
