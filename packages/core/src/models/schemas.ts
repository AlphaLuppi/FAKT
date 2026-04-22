import { z } from "zod";

/** Schémas Zod purs — modèles métier validés à la frontière IPC et formulaires. */

export const uuidSchema = z.string().uuid();

export const centSchema = z
  .number()
  .int("Le montant doit être un entier de centimes")
  .nonnegative("Le montant ne peut pas être négatif");

export const quantityMilliSchema = z
  .number()
  .int("La quantité doit être un entier en millièmes")
  .positive("La quantité doit être supérieure à zéro");

export const documentUnitSchema = z.enum(["forfait", "jour", "heure", "unité", "mois", "semaine"]);

export const legalFormSchema = z.enum([
  "Micro-entreprise",
  "EI",
  "EURL",
  "SASU",
  "SAS",
  "SARL",
  "SA",
  "Autre",
]);

export const quoteStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "signed",
  "invoiced",
  "refused",
  "expired",
]);

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "cancelled"]);

export const invoiceKindSchema = z.enum(["deposit", "balance", "total", "independent"]);

export const paymentMethodSchema = z.enum(["wire", "check", "cash", "other"]);

export const documentLineSchema = z.object({
  id: uuidSchema,
  position: z.number().int().nonnegative(),
  description: z.string().min(1, "La description est obligatoire"),
  quantity: quantityMilliSchema,
  unitPriceCents: centSchema,
  unit: documentUnitSchema,
  lineTotalCents: centSchema,
  serviceId: uuidSchema.nullable(),
});

export const workspaceSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Le nom est obligatoire"),
  legalForm: legalFormSchema,
  siret: z.string().length(14, "Le SIRET doit contenir 14 chiffres"),
  address: z.string().min(5, "L'adresse est obligatoire"),
  email: z.string().email("Email invalide"),
  iban: z.string().nullable(),
  tvaMention: z.string().min(1),
  createdAt: z.number(),
});

export const clientSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string().min(1, "Le nom du client est obligatoire"),
  legalForm: z.string().nullable(),
  siret: z.string().nullable(),
  address: z.string().nullable(),
  contactName: z.string().nullable(),
  email: z.string().email("Email invalide").nullable(),
  sector: z.string().nullable(),
  firstCollaboration: z.number().nullable(),
  note: z.string().nullable(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
});

export const serviceSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string().min(1, "Le nom de la prestation est obligatoire"),
  description: z.string().nullable(),
  unit: documentUnitSchema,
  unitPriceCents: centSchema,
  tags: z.array(z.string()).nullable(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
});

export const quoteSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  clientId: uuidSchema,
  number: z.string().nullable(),
  year: z.number().int().nullable(),
  sequence: z.number().int().positive().nullable(),
  title: z.string().min(1, "L'objet du devis est obligatoire"),
  status: quoteStatusSchema,
  totalHtCents: centSchema,
  conditions: z.string().nullable(),
  validityDate: z.number().nullable(),
  notes: z.string().nullable(),
  issuedAt: z.number().nullable(),
  signedAt: z.number().nullable(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  items: z.array(documentLineSchema),
});

export const invoiceSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  clientId: uuidSchema,
  quoteId: uuidSchema.nullable(),
  number: z.string().nullable(),
  year: z.number().int().nullable(),
  sequence: z.number().int().positive().nullable(),
  kind: invoiceKindSchema,
  depositPercent: z.number().int().min(1).max(100).nullable(),
  title: z.string().min(1, "L'objet de la facture est obligatoire"),
  status: invoiceStatusSchema,
  totalHtCents: centSchema,
  dueDate: z.number().nullable(),
  paidAt: z.number().nullable(),
  paymentMethod: paymentMethodSchema.nullable(),
  legalMentions: z.string().min(1),
  issuedAt: z.number().nullable(),
  archivedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  items: z.array(documentLineSchema),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type DocumentLineInput = z.infer<typeof documentLineSchema>;
