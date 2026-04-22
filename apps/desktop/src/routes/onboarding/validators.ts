import { normalizeSiret, validateSiret } from "@fakt/legal";
import { z } from "zod";

/** Validation IBAN France (FR76…, 27 caractères). */
function isValidIban(raw: string): boolean {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!cleaned.startsWith("FR")) return false;
  if (cleaned.length !== 27) return false;
  // Déplacer les 4 premiers chars à la fin + convertir lettres → chiffres
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? String(code - 55) : c;
    })
    .join("");
  // Modulo 97 sur grand entier
  let remainder = 0;
  for (const char of numeric) {
    remainder = (remainder * 10 + Number.parseInt(char, 10)) % 97;
  }
  return remainder === 1;
}

export const identitySchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  legalForm: z.enum(["Micro-entreprise", "EI", "EURL", "SASU", "SAS", "SARL", "SA", "Autre"], {
    errorMap: () => ({ message: "Forme juridique invalide" }),
  }),
  siret: z
    .string()
    .min(14, "Le SIRET doit contenir 14 chiffres")
    .refine((v) => validateSiret(normalizeSiret(v)), "SIRET invalide (clé Luhn incorrecte)"),
  address: z.string().min(5, "L'adresse est trop courte"),
  email: z.string().email("Adresse email invalide"),
  iban: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || isValidIban(v),
      "IBAN France invalide (format FR76…, 27 caractères)"
    ),
  phone: z.string().optional(),
});

export type IdentityFormValues = z.infer<typeof identitySchema>;

export const LEGAL_FORM_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Micro-entreprise", label: "Micro-entreprise" },
  { value: "EI", label: "EI — Entreprise Individuelle" },
  { value: "EURL", label: "EURL" },
  { value: "SASU", label: "SASU" },
  { value: "SAS", label: "SAS" },
  { value: "SARL", label: "SARL" },
  { value: "SA", label: "SA" },
  { value: "Autre", label: "Autre" },
];
