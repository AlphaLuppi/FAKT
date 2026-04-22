import { z } from "zod";
import { booleanStringSchema, paginationSchema, uuidSchema } from "./common.js";
import { isValidSiret } from "./common.js";

const optionalString = z.string().max(500).nullable().optional();
const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : (v ?? null)));

const optionalSiretField = z
  .string()
  .optional()
  .nullable()
  .refine((v) => v === null || v === undefined || v === "" || isValidSiret(v), {
    message: "SIRET invalide (14 chiffres + Luhn)",
  })
  .transform((v) => (v === "" ? null : (v ?? null)));

export const createClientSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "nom client requis").max(200),
  legalForm: optionalString,
  siret: optionalSiretField,
  address: optionalString,
  contactName: optionalString,
  email: optionalEmail,
  sector: optionalString,
  firstCollaboration: z.number().int().nullable().optional(),
  note: optionalString,
});

export const updateClientSchema = z
  .object({
    name: z.string().min(1).max(200),
    legalForm: optionalString,
    siret: optionalSiretField,
    address: optionalString,
    contactName: optionalString,
    email: optionalEmail,
    sector: optionalString,
    firstCollaboration: z.number().int().nullable(),
    note: optionalString,
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "au moins un champ requis" });

export const listClientsQuerySchema = z
  .object({
    search: z.string().max(200).optional(),
    includeSoftDeleted: booleanStringSchema,
  })
  .merge(paginationSchema);

export const clientSearchQuerySchema = z.object({
  q: z.string().min(1, "q requis").max(200),
});

export type CreateClientBody = z.infer<typeof createClientSchema>;
export type UpdateClientBody = z.infer<typeof updateClientSchema>;
