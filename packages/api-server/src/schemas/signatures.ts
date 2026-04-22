import { z } from "zod";
import { uuidSchema } from "./common.js";

// ─── Événements signature (audit append-only) ────────────────────────────────

export const documentTypeSchema = z.enum(["quote", "invoice"]);

const hexSha256 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "hash doit être 64 chars hex (SHA-256)");

const base64ish = z.string().min(1);

export const appendSignatureEventSchema = z.object({
  id: uuidSchema,
  documentType: documentTypeSchema,
  documentId: uuidSchema,
  signerName: z.string().min(1).max(200),
  signerEmail: z.string().email(),
  ipAddress: z.string().max(64).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
  timestamp: z.number().int(),
  docHashBefore: hexSha256,
  docHashAfter: hexSha256,
  signaturePngBase64: base64ish,
  previousEventHash: hexSha256.nullable().optional(),
  tsaResponse: base64ish.nullable().optional(),
  tsaProvider: z.string().max(200).nullable().optional(),
});

export const signatureEventsQuerySchema = z.object({
  documentType: documentTypeSchema,
  documentId: uuidSchema,
});

// ─── Signed documents (métadonnées PDF signés) ───────────────────────────────

export const padesLevelSchema = z.enum(["B", "B-T"]);

export const upsertSignedDocumentSchema = z.object({
  documentType: documentTypeSchema,
  documentId: uuidSchema,
  path: z.string().min(1).max(2000),
  padesLevel: padesLevelSchema,
  tsaProvider: z.string().max(200).nullable().optional(),
  signedAt: z.number().int(),
  signatureEventId: uuidSchema,
});

export type AppendSignatureEventBody = z.infer<typeof appendSignatureEventSchema>;
export type UpsertSignedDocumentBody = z.infer<typeof upsertSignedDocumentSchema>;
