import { z } from "zod";

export const uuidSchema = z.string().uuid({ message: "id doit être un UUID v4" });

/** Validation SIRET : 14 chiffres, algorithme de Luhn. */
export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const ch = siret.charAt(13 - i);
    let digit = Number(ch);
    if (Number.isNaN(digit)) return false;
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export const siretSchema = z
  .string()
  .refine(isValidSiret, { message: "SIRET invalide (14 chiffres + Luhn)" });

export const optionalSiret = z.union([siretSchema, z.null(), z.literal("")]).optional();

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(10000)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0))
    .pipe(z.number().int().min(0)),
});

export const booleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");
