import { z } from "zod";
import { booleanStringSchema, paginationSchema, uuidSchema } from "./common.js";

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
/** SHA-256 hex 64 chars, ou null pour réinitialiser. */
const optionalSha256 = z.union([z.string().regex(/^[0-9a-f]{64}$/), z.null()]).optional();

const optionalClauseIds = z.array(z.string().min(1).max(64)).optional();

export const createQuoteSchema = z.object({
  id: uuidSchema,
  clientId: uuidSchema,
  title: z.string().min(1, "titre requis").max(200),
  conditions: optionalString,
  clauses: optionalClauseIds,
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
    clauses: optionalClauseIds,
    originalTextHash: optionalSha256,
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
        const parts = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
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

export const importQuoteSchema = z.object({
  id: uuidSchema,
  clientId: uuidSchema,
  externalNumber: z.string().max(100).nullable().optional(),
  title: z.string().min(1, "titre requis").max(200),
  totalHtCents: z.number().int().min(0),
  issuedAt: z.number().int().nullable().optional(),
  signedAt: z.number().int().nullable().optional(),
  status: z.enum(["sent", "signed"]).optional(),
  notes: optionalString,
  items: z.array(quoteItemInputSchema).min(1, "au moins une ligne requise"),
});

export type CreateQuoteBody = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteBody = z.infer<typeof updateQuoteSchema>;
export type QuoteItemInputBody = z.infer<typeof quoteItemInputSchema>;
export type ImportQuoteBody = z.infer<typeof importQuoteSchema>;
