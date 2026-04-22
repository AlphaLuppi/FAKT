import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common.js";

export const insertBackupSchema = z.object({
  id: uuidSchema,
  path: z.string().min(1).max(2000),
  sizeBytes: z.number().int().min(0),
});

export const listBackupsQuerySchema = paginationSchema;

export type InsertBackupBody = z.infer<typeof insertBackupSchema>;
