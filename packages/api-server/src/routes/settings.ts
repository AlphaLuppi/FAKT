import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { notFound } from "../errors.js";
import { parseBody, parseParam } from "../middleware/zod.js";
import { setSettingSchema, settingKeySchema } from "../schemas/settings.js";
import {
  getWorkspace,
  getAllSettings,
  getSetting,
  setSetting,
} from "@fakt/db/queries";

export const settingsRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: Parameters<typeof getWorkspace>[0]): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

/** GET /api/settings — liste K/V du workspace. */
settingsRoutes.get("/", (c) => {
  const workspaceId = requireWorkspaceId(c.var.db);
  const all = getAllSettings(c.var.db, workspaceId);
  return c.json({ settings: all });
});

/** GET /api/settings/:key — valeur d'une clé. 404 si absente. */
settingsRoutes.get("/:key", (c) => {
  const key = parseParam(c, "key", settingKeySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const value = getSetting(c.var.db, workspaceId, key);
  if (value === null) throw notFound(`setting '${key}' introuvable`);
  return c.json({ key, value });
});

/** PUT /api/settings/:key — upsert d'une clé. */
settingsRoutes.put("/:key", async (c) => {
  const key = parseParam(c, "key", settingKeySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const body = await parseBody(c, setSettingSchema);
  setSetting(c.var.db, workspaceId, key, body.value);
  return c.json({ key, value: body.value });
});
