import { z } from "zod";
import { booleanStringSchema, paginationSchema, uuidSchema } from "./common.js";

// ─── Énumérations ────────────────────────────────────────────────────────────

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "cancelled"]);

export const invoiceKindSchema = z.enum(["deposit", "balance", "total", "independent"]);

export const documentUnitSchema = z.enum(["forfait", "jour", "heure", "unité", "mois", "semaine"]);

export const paymentMethodSchema = z.enum(["wire", "check", "cash", "other"]);

export const fromQuoteModeSchema = z.enum(["deposit30", "balance", "full"]);

// ─── Items ───────────────────────────────────────────────────────────────────

export const invoiceItemInputSchema = z.object({
  id: uuidSchema,
  position: z.number().int().min(0),
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(0),
  unitPriceCents: z.number().int().min(0),
  unit: documentUnitSchema,
  lineTotalCents: z.number().int().min(0),
  serviceId: uuidSchema.nullable().optional(),
});

// ─── Create / Update ─────────────────────────────────────────────────────────

export const createInvoiceSchema = z.object({
  id: uuidSchema,
  clientId: uuidSchema,
  quoteId: uuidSchema.nullable().optional(),
  kind: invoiceKindSchema,
  depositPercent: z.number().int().min(0).max(100).nullable().optional(),
  title: z.string().min(1).max(500),
  totalHtCents: z.number().int().min(0),
  dueDate: z.number().int().nullable().optional(),
  legalMentions: z.string().min(1),
  items: z.array(invoiceItemInputSchema).min(1, "au moins une ligne requise"),
});

export const fromQuoteSchema = z.object({
  id: uuidSchema,
  quoteId: uuidSchema.optional(),
  mode: fromQuoteModeSchema,
  legalMentions: z.string().min(1),
  dueDate: z.number().int().nullable().optional(),
});

export const updateInvoiceSchema = z
  .object({
    clientId: uuidSchema,
    title: z.string().min(1).max(500),
    kind: invoiceKindSchema,
    depositPercent: z.number().int().min(0).max(100).nullable(),
    totalHtCents: z.number().int().min(0),
    dueDate: z.number().int().nullable(),
    legalMentions: z.string().min(1),
    items: z.array(invoiceItemInputSchema),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "au moins un champ requis" });

// ─── Transitions ─────────────────────────────────────────────────────────────

export const markPaidSchema = z.object({
  paidAt: z.number().int(),
  method: paymentMethodSchema,
  notes: z.string().max(2000).nullable().optional(),
});

// ─── List / Search ───────────────────────────────────────────────────────────

export const listInvoicesQuerySchema = z
  .object({
    status: invoiceStatusSchema.optional(),
    clientId: uuidSchema.optional(),
    quoteId: uuidSchema.optional(),
    includeArchived: booleanStringSchema,
  })
  .merge(paginationSchema);

export const invoiceSearchQuerySchema = z.object({
  q: z.string().min(1, "q requis").max(200),
});

// ─── Import historique ───────────────────────────────────────────────────────

export const importInvoiceSchema = z.object({
  id: uuidSchema,
  clientId: uuidSchema,
  externalNumber: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(500),
  totalHtCents: z.number().int().min(0),
  issuedAt: z.number().int().nullable().optional(),
  paidAt: z.number().int().nullable().optional(),
  paymentMethod: paymentMethodSchema.nullable().optional(),
  paymentNotes: z.string().max(2000).nullable().optional(),
  status: z.enum(["sent", "paid", "overdue"]).optional(),
  legalMentions: z.string().min(1),
  items: z.array(invoiceItemInputSchema).min(1, "au moins une ligne requise"),
});

// ─── Type exports ────────────────────────────────────────────────────────────

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;
export type FromQuoteBody = z.infer<typeof fromQuoteSchema>;
export type UpdateInvoiceBody = z.infer<typeof updateInvoiceSchema>;
export type MarkPaidBody = z.infer<typeof markPaidSchema>;
export type ImportInvoiceBody = z.infer<typeof importInvoiceSchema>;
