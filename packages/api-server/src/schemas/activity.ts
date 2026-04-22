import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const insertActivitySchema = z.object({
  id: uuidSchema,
  type: z.string().min(1).max(100),
  entityType: z.enum(["quote", "invoice", "client", "service", "workspace"]).nullable().optional(),
  entityId: uuidSchema.nullable().optional(),
  payload: z.string().max(10_000).nullable().optional(),
});

export const listActivityQuerySchema = z
  .object({
    entityType: z.string().max(50).optional(),
    entityId: uuidSchema.optional(),
    type: z.string().max(100).optional(),
    since: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
      .pipe(z.number().int().optional()),
  })
  .merge(paginationSchema);

export type InsertActivityBody = z.infer<typeof insertActivitySchema>;
