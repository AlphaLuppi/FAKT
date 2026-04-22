import {
  createClient,
  getClient,
  getWorkspace,
  listClients,
  restoreClient,
  searchClients,
  softDeleteClient,
  updateClient,
} from "@fakt/db/queries";
import { Hono } from "hono";
import { notFound } from "../errors.js";
import { parseBody, parseParam, parseQuery } from "../middleware/zod.js";
import {
  clientSearchQuerySchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from "../schemas/clients.js";
import { uuidSchema } from "../schemas/common.js";
import type { AppEnv } from "../types.js";

export const clientsRoutes = new Hono<AppEnv>();

function requireWorkspaceId(db: Parameters<typeof getWorkspace>[0]): string {
  const ws = getWorkspace(db);
  if (!ws) throw notFound("workspace non initialisé");
  return ws.id;
}

/** GET /api/clients — liste paginée + search + includeSoftDeleted. */
clientsRoutes.get("/", (c) => {
  const query = parseQuery(c, listClientsQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = listClients(c.var.db, {
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

/** GET /api/clients/search?q=... — recherche full-text simple. */
clientsRoutes.get("/search", (c) => {
  const query = parseQuery(c, clientSearchQuerySchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const items = searchClients(c.var.db, workspaceId, query.q);
  return c.json({ items });
});

/** GET /api/clients/:id — détail. 404 si inexistant. */
clientsRoutes.get("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const client = getClient(c.var.db, id);
  if (!client) throw notFound(`client ${id} introuvable`);
  return c.json(client);
});

/** POST /api/clients — crée un client. */
clientsRoutes.post("/", async (c) => {
  const body = await parseBody(c, createClientSchema);
  const workspaceId = requireWorkspaceId(c.var.db);
  const created = createClient(c.var.db, {
    id: body.id,
    workspaceId,
    name: body.name,
    legalForm: body.legalForm ?? null,
    siret: body.siret ?? null,
    address: body.address ?? null,
    contactName: body.contactName ?? null,
    email: body.email ?? null,
    sector: body.sector ?? null,
    firstCollaboration: body.firstCollaboration ?? null,
    note: body.note ?? null,
  });
  return c.json(created, 201);
});

/** PATCH /api/clients/:id — met à jour un client. */
clientsRoutes.patch("/:id", async (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getClient(c.var.db, id);
  if (!existing) throw notFound(`client ${id} introuvable`);
  const body = await parseBody(c, updateClientSchema);
  const input: Parameters<typeof updateClient>[2] = {};
  if (body.name !== undefined) input.name = body.name;
  if ("legalForm" in body) input.legalForm = body.legalForm ?? null;
  if ("siret" in body) input.siret = body.siret ?? null;
  if ("address" in body) input.address = body.address ?? null;
  if ("contactName" in body) input.contactName = body.contactName ?? null;
  if ("email" in body) input.email = body.email ?? null;
  if ("sector" in body) input.sector = body.sector ?? null;
  if ("firstCollaboration" in body) input.firstCollaboration = body.firstCollaboration ?? null;
  if ("note" in body) input.note = body.note ?? null;
  const updated = updateClient(c.var.db, id, input);
  return c.json(updated);
});

/** DELETE /api/clients/:id — soft delete. */
clientsRoutes.delete("/:id", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getClient(c.var.db, id);
  if (!existing) throw notFound(`client ${id} introuvable`);
  if (existing.archivedAt !== null) throw notFound(`client ${id} déjà archivé`);
  softDeleteClient(c.var.db, id);
  return c.body(null, 204);
});

/** POST /api/clients/:id/restore — restore soft-deleted client. */
clientsRoutes.post("/:id/restore", (c) => {
  const id = parseParam(c, "id", uuidSchema);
  const existing = getClient(c.var.db, id);
  if (!existing) throw notFound(`client ${id} introuvable`);
  if (existing.archivedAt === null) throw notFound(`client ${id} non archivé`);
  const restored = restoreClient(c.var.db, id);
  return c.json(restored);
});
