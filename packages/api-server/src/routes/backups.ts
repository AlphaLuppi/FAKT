import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { parseBody, parseQuery, parseParam } from "../middleware/zod.js";
import { uuidSchema } from "../schemas/common.js";
import { insertBackupSchema, listBackupsQuerySchema } from "../schemas/backups.js";
import { listBackups, insertBackup, deleteBackup } from "@fakt/db/queries";

export const backupsRoutes = new Hono<AppEnv>();

/** GET /api/backups — liste ordre desc createdAt. */
backupsRoutes.get("/", (c) => {
  const query = parseQuery(c, listBackupsQuerySchema);
  const items = listBackups(c.var.db, { limit: query.limit, offset: query.offset });
  return c.json({
    items,
    pagination: { limit: query.limit, offset: query.offset, count: items.length },
  });
});

/** POST /api/backups — enregistre un export (path, sizeBytes, id fourni par Rust). */
backupsRoutes.post("/", async (c) => {
  const body = await parseBody(c, insertBackupSchema);
  const created = insertBackup(c.var.db, {
    id: body.id,
    path: body.path,
    sizeBytes: body.sizeBytes,
  });
  return c.json(created, 201);
});

/** DELETE /api/backups/:id — retire l'enregistrement (ne touche pas au fichier). */
backupsRoutes.delete("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  deleteBackup(c.var.db, id);
  return c.body(null, 204);
});
