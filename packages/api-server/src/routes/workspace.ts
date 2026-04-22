import { randomUUID } from "node:crypto";
import { createWorkspace, getWorkspace, updateWorkspace } from "@fakt/db/queries";
import { Hono } from "hono";
import { conflict, notFound } from "../errors.js";
import { parseBody } from "../middleware/zod.js";
import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas/workspace.js";
import type { AppEnv } from "../types.js";

export const workspaceRoutes = new Hono<AppEnv>();

/** GET /api/workspace — récupère le singleton workspace. 404 si absent. */
workspaceRoutes.get("/", (c) => {
  const ws = getWorkspace(c.var.db);
  if (!ws) throw notFound("workspace non initialisé");
  return c.json(ws);
});

/** POST /api/workspace — crée le workspace singleton (onboarding). 409 si déjà créé. */
workspaceRoutes.post("/", async (c) => {
  const existing = getWorkspace(c.var.db);
  if (existing) throw conflict("workspace déjà initialisé");
  const body = await parseBody(c, createWorkspaceSchema);
  const created = createWorkspace(c.var.db, {
    id: body.id ?? randomUUID(),
    name: body.name,
    legalForm: body.legalForm,
    siret: body.siret,
    address: body.address,
    email: body.email,
    iban: body.iban ?? null,
    ...(body.tvaMention !== undefined ? { tvaMention: body.tvaMention } : {}),
  });
  return c.json(created, 201);
});

/** PATCH /api/workspace — met à jour les champs éditables du workspace. */
workspaceRoutes.patch("/", async (c) => {
  const existing = getWorkspace(c.var.db);
  if (!existing) throw notFound("workspace non initialisé");
  const body = await parseBody(c, updateWorkspaceSchema);
  const input: Parameters<typeof updateWorkspace>[2] = {};
  if (body.name !== undefined) input.name = body.name;
  if (body.legalForm !== undefined) input.legalForm = body.legalForm;
  if (body.siret !== undefined) input.siret = body.siret;
  if (body.address !== undefined) input.address = body.address;
  if (body.email !== undefined) input.email = body.email;
  if ("iban" in body) input.iban = body.iban ?? null;
  if (body.tvaMention !== undefined) input.tvaMention = body.tvaMention;
  const updated = updateWorkspace(c.var.db, existing.id, input);
  return c.json(updated);
});
