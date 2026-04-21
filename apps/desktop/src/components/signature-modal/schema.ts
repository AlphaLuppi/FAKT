import { z } from "zod";

export const signatureSubmitSchema = z
  .object({
    docId: z.string().uuid({ message: "docId doit être un UUID valide." }),
    docType: z.enum(["quote", "invoice"]),
    mode: z.enum(["draw", "type"]),
    signaturePng: z
      .instanceof(Uint8Array)
      .refine((b) => b.byteLength > 0, "La signature est vide."),
    ack: z.literal(true, {
      errorMap: () => ({
        message: "L'acceptation AdES-B-T est obligatoire.",
      }),
    }),
  })
  .strict();

export type SignatureSubmitInput = z.infer<typeof signatureSubmitSchema>;

export function validateSignatureSubmit(
  input: unknown,
): z.SafeParseReturnType<unknown, SignatureSubmitInput> {
  return signatureSubmitSchema.safeParse(input);
}
