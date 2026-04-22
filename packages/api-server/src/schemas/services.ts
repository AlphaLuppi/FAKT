import { z } from "zod";
import { uuidSchema, paginationSchema, booleanStringSchema } from "./common.js";

const unitEnum = z.enum(["forfait", "jour", "heure", "unité", "mois", "semaine"]);

const optionalDescription = z
  .union([z.string().max(2000), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v));

const optionalTags = z
  .union([z.array(z.string().min(1).max(50)).max(20), z.null()])
  .optional();

export const createServiceSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "nom prestation requis").max(200),
  description: optionalDescription,
  unit: unitEnum,
  unitPriceCents: z.number().int().min(0, "unitPriceCents doit être >= 0"),
  tags: optionalTags,
});

export const updateServiceSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: optionalDescription,
    unit: unitEnum,
    unitPriceCents: z.number().int().min(0),
    tags: optionalTags,
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "au moins un champ requis" });

export const listServicesQuerySchema = z
  .object({
    search: z.string().max(200).optional(),
    includeSoftDeleted: booleanStringSchema,
  })
  .merge(paginationSchema);

export const serviceSearchQuerySchema = z.object({
  q: z.string().min(1, "q requis").max(200),
});

export type CreateServiceBody = z.infer<typeof createServiceSchema>;
export type UpdateServiceBody = z.infer<typeof updateServiceSchema>;
