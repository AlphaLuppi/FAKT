import { z } from "zod";
import { uuidSchema, siretSchema } from "./common.js";

const LEGAL_FORMS = [
  "Micro-entreprise",
  "EI",
  "EURL",
  "SASU",
  "SAS",
  "SARL",
  "SA",
  "Autre",
] as const;

export const legalFormSchema = z.enum(LEGAL_FORMS);

export const createWorkspaceSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1, "nom workspace requis").max(200),
  legalForm: legalFormSchema,
  siret: siretSchema,
  address: z.string().min(1).max(500),
  email: z.string().email(),
  iban: z.string().min(1).max(34).nullable().optional(),
  tvaMention: z.string().min(1).max(300).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(200),
    legalForm: legalFormSchema,
    siret: siretSchema,
    address: z.string().min(1).max(500),
    email: z.string().email(),
    iban: z.string().max(34).nullable(),
    tvaMention: z.string().min(1).max(300),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "au moins un champ requis" });

export type CreateWorkspaceBody = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceBody = z.infer<typeof updateWorkspaceSchema>;
