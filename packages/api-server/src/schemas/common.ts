import { z } from "zod";

export const uuidSchema = z.string().uuid({ message: "id doit être un UUID v4" });

/**
 * Validation SIRET : 14 chiffres, algorithme de Luhn.
 * Exception documentée : les SIREN commençant par "356000000" (La Poste) ne
 * suivent PAS Luhn mais sont néanmoins valides par décret INSEE.
 */
export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  // Exception La Poste (356 000 000) — même règle que `@fakt/legal/siret.ts`.
  if (siret.startsWith("356000000")) return true;
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

/** Retire espaces, tirets et underscores, pour accepter "853 665 842 00029" comme "85366584200029". */
function normalizeSiretInput(v: string): string {
  return v.replace(/[\s\-_]/g, "");
}

export const siretSchema = z
  .string()
  .transform(normalizeSiretInput)
  .refine(isValidSiret, { message: "SIRET invalide (14 chiffres + Luhn)" });

export const optionalSiret = z.union([siretSchema, z.null(), z.literal("")]).optional();

export const paginationSchema = z.object({
  // `max(500)` — une page trop grande bloque la webview Tauri (saturation
  // mémoire sur 10 000 lignes avec items joints). 500 = compromis raisonnable
  // pour un freelance FR typique (pas de page imprimable à plus de 500 items).
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(500)),
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
