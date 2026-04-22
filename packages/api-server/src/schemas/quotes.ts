import { z } from "zod";
import { uuidSchema, paginationSchema, booleanStringSchema } from "./common.js";

const unitEnum = z.enum(["forfait", "jour", "heure", "unité", "mois", "semaine"]);
const quoteStatusEnum = z.enum([
  "draft",
  "sent",
  "viewed",
  "signed",
  "invoiced",
  "refused",
  "expired",
]);

export const quoteItemInputSchema = z.object({
  id: uuidSchema,
  position: z.number().int().min(0),
  description: z.string().min(1, "description ligne requise").max(2000),
  quantity: z.number().int().min(0, "quantity (milli-unités) doit être >= 0"),
  unitPriceCents: z.number().int().min(0),
  unit: unitEnum,
  lineTotalCents: z.number().int().min(0),
  serviceId: z.string().uuid().nullable().optional(),
});

const optionalString = z.union([z.string().max(5000), z.null()]).optional();
const optionalTimestamp = z.union([z.number().int(), z.null()]).optional();

export const createQuoteSchema = z.object({
  id: uuidSchema,
  clientId: uuidSchema,
  title: z.string().min(1, "titre requis").max(200),
  conditions: optionalString,
  validityDate: optionalTimestamp,
  notes: optionalString,
  totalHtCents: z.number().int().min(0),
  items: z.array(quoteItemInputSchema).min(1, "au moins une ligne requise"),
});

export const updateQuoteSchema = z
  .object({
    clientId: uuidSchema,
    title: z.string().min(1).max(200),
    conditions: optionalString,
    validityDate: optionalTimestamp,
    notes: optionalString,
    totalHtCents: z.number().int().min(0),
    items: z.array(quoteItemInputSchema).min(1),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "au moins un champ requis" });

export const listQuotesQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return undefined;
        const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
        return parts.length > 0 ? parts : undefined;
      })
      .pipe(z.array(quoteStatusEnum).optional()),
    clientId: z.string().uuid().optional(),
    q: z.string().max(200).optional(),
    includeArchived: booleanStringSchema,
  })
  .merge(paginationSchema);

export const quoteSearchQuerySchema = z.object({
  q: z.string().min(1, "q requis").max(200),
});

export type CreateQuoteBody = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteBody = z.infer<typeof updateQuoteSchema>;
export type QuoteItemInputBody = z.infer<typeof quoteItemInputSchema>;
