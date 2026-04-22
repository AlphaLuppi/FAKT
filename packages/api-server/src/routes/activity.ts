import { getWorkspace, insertActivity, listActivity } from "@fakt/db/queries";
import { Hono } from "hono";
import { notFound } from "../errors.js";
import { parseBody, parseQuery } from "../middleware/zod.js";
import { insertActivitySchema, listActivityQuerySchema } from "../schemas/activity.js";
import type { AppEnv } from "../types.js";

export const activityRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: Parameters<typeof getWorkspace>[0]): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

/** GET /api/activity — feed paginé desc createdAt avec filtres optionnels. */
activityRoutes.get("/", (c) => {
  const query = parseQuery(c, listActivityQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = listActivity(c.var.db, {
    workspaceId,
    ...(query.entityType !== undefined ? { entityType: query.entityType } : {}),
    ...(query.entityId !== undefined ? { entityId: query.entityId } : {}),
    ...(query.type !== undefined ? { type: query.type } : {}),
    ...(query.since !== undefined ? { since: query.since } : {}),
    limit: query.limit,
    offset: query.offset,
  });
  return c.json({
    items,
    pagination: { limit: query.limit, offset: query.offset, count: items.length },
  });
});

/** POST /api/activity — append event (email.drafted, etc. depuis frontend/Rust). */
activityRoutes.post("/", async (c) => {
  const body = await parseBody(c, insertActivitySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const created = insertActivity(c.var.db, {
    id: body.id,
    workspaceId,
    type: body.type,
    entityType: body.entityType ?? null,
    entityId: body.entityId ?? null,
    payload: body.payload ?? null,
  });
  return c.json(created, 201);
});
