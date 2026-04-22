import { z } from "zod";

export const docTypeSchema = z.enum(["quote", "invoice"], {
  errorMap: () => ({ message: "type doit être 'quote' ou 'invoice'" }),
});

export const numberingPeekQuerySchema = z.object({
  type: docTypeSchema,
});

export const numberingNextBodySchema = z.object({
  type: docTypeSchema,
});

export type NumberingPeekQuery = z.infer<typeof numberingPeekQuerySchema>;
export type NumberingNextBody = z.infer<typeof numberingNextBodySchema>;
