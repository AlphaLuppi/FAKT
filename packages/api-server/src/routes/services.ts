import type { DbInstance } from "@fakt/db/adapter";
import {
  createPrestation,
  getPrestation,
  getWorkspace,
  listPrestations,
  restorePrestation,
  searchPrestations,
  softDeletePrestation,
  updatePrestation,
} from "@fakt/db/queries";
import { Hono } from "hono";
import { notFound } from "../errors.js";
import { parseBody, parseParam, parseQuery } from "../middleware/zod.js";
import { uuidSchema } from "../schemas/common.js";
import {
  createServiceSchema,
  listServicesQuerySchema,
  serviceSearchQuerySchema,
  updateServiceSchema,
} from "../schemas/services.js";
import type { AppEnv } from "../types.js";

export const servicesRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: DbInstance): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

/** GET /api/services — liste paginée + search + includeSoftDeleted. */
servicesRoutes.get("/", (c) => {
  const query = parseQuery(c, listServicesQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = listPrestations(c.var.db, {
    workspaceId,
    ...(query.search !== undefined ? { search: query.search } : {}),
    includeSoftDeleted: query.includeSoftDeleted,
    limit: query.limit,
    offset: query.offset,
  });
  return c.json({
    items,
    pagination: { limit: query.limit, offset: query.offset, count: items.length },
  });
});

/** GET /api/services/search?q=... — recherche full-text simple. */
servicesRoutes.get("/search", (c) => {
  const query = parseQuery(c, serviceSearchQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = searchPrestations(c.var.db, workspaceId, query.q);
  return c.json({ items });
});

/** GET /api/services/:id — détail. 404 si inexistant. */
servicesRoutes.get("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const service = getPrestation(c.var.db, id);
  if (!service) throw notFound(`service ${id} introuvable`);
  return c.json(service);
});

/** POST /api/services — crée une prestation. */
servicesRoutes.post("/", async (c) => {
  const body = await parseBody(c, createServiceSchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const created = createPrestation(c.var.db, {
    id: body.id,
    workspaceId,
    name: body.name,
    description: body.description ?? null,
    unit: body.unit,
    unitPriceCents: body.unitPriceCents,
    tags: body.tags ?? null,
  });
  return c.json(created, 201);
});

/** PATCH /api/services/:id — met à jour une prestation. */
servicesRoutes.patch("/:id", async (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getPrestation(c.var.db, id);
  if (!existing) throw notFound(`service ${id} introuvable`);
  const body = await parseBody(c, updateServiceSchema);
  const input: Parameters<typeof updatePrestation>[2] = {};
  if (body.name !== undefined) input.name = body.name;
  if ("description" in body) input.description = body.description ?? null;
  if (body.unit !== undefined) input.unit = body.unit;
  if (body.unitPriceCents !== undefined) input.unitPriceCents = body.unitPriceCents;
  if ("tags" in body) input.tags = body.tags ?? null;
  const updated = updatePrestation(c.var.db, id, input);
  return c.json(updated);
});

/** DELETE /api/services/:id — soft delete. */
servicesRoutes.delete("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getPrestation(c.var.db, id);
  if (!existing) throw notFound(`service ${id} introuvable`);
  if (existing.archivedAt !== null) throw notFound(`service ${id} déjà archivé`);
  softDeletePrestation(c.var.db, id);
  return c.body(null, 204);
});

/** POST /api/services/:id/restore — restore soft-deleted prestation. */
servicesRoutes.post("/:id/restore", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getPrestation(c.var.db, id);
  if (!existing) throw notFound(`service ${id} introuvable`);
  if (existing.archivedAt === null) throw notFound(`service ${id} non archivé`);
  const restored = restorePrestation(c.var.db, id);
  return c.json(restored);
});
