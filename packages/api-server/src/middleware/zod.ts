import type { Context } from "hono";
import type { ZodSchema, z } from "zod";
import type { AppEnv } from "../types.js";
import { badRequest } from "../errors.js";

/** Parse body JSON + valide Zod ; throw 400 si invalid. */
export async function parseBody<S extends ZodSchema>(
  c: Context<AppEnv>,
  schema: S
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest("body JSON invalide ou absent");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first?.message ?? "validation error", {
      field: first?.path.join("."),
      issues: result.error.issues,
    });
  }
  return result.data;
}

/** Valide query params sur un schema Zod ; throw 400 si invalid. */
export function parseQuery<S extends ZodSchema>(
  c: Context<AppEnv>,
  schema: S
): z.infer<S> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first?.message ?? "query invalide", {
      field: first?.path.join("."),
      issues: result.error.issues,
    });
  }
  return result.data;
}

/** Valide un param de path (typiquement UUID) ; throw 400 si invalid. */
export function parseParam<S extends ZodSchema>(
  c: Context<AppEnv>,
  name: string,
  schema: S
): z.infer<S> {
  const raw = c.req.param(name);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw badRequest(first?.message ?? `param ${name} invalide`, {
      field: name,
      issues: result.error.issues,
    });
  }
  return result.data;
}
