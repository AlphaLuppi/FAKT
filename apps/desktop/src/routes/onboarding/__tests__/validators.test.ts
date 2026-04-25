import { describe, expect, it } from "vitest";
import { identitySchema } from "../validators.js";

const VALID_SIRET = "73282932000074"; // SIRET valide (Luhn OK)
const VALID_IBAN = "FR7630006000011234567890189";

describe("identitySchema — validation SIRET", () => {
  it("accepte un SIRET valide", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue de la République, 13001 Marseille",
      email: "contact@atelier-mercier.fr",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un SIRET trop court", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: "1234567",
      address: "12 rue test",
      email: "a@b.fr",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/14/);
  });

  it("rejette un SIRET avec clé Luhn incorrecte", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: "73282932000075", // dernier chiffre modifié → clé invalide
      address: "12 rue test",
      email: "a@b.fr",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/Luhn/i);
  });

  it("accepte un SIRET avec espaces (normalisé)", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: "732 829 320 00074",
      address: "12 rue de la République, 13001 Marseille",
      email: "contact@atelier-mercier.fr",
    });
    expect(result.success).toBe(true);
  });
});

describe("identitySchema — validation IBAN", () => {
  it("accepte un IBAN FR valide", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue test",
      email: "a@b.fr",
      iban: VALID_IBAN,
    });
    expect(result.success).toBe(true);
  });

  it("accepte un IBAN vide (optionnel)", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue test",
      email: "a@b.fr",
      iban: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un IBAN non-français (DE)", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue test",
      email: "a@b.fr",
      iban: "DE89370400440532013000",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un IBAN FR avec mauvaise longueur", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue test",
      email: "a@b.fr",
      iban: "FR76300060000112345678",
    });
    expect(result.success).toBe(false);
  });
});

describe("identitySchema — validation email", () => {
  it("rejette un email invalide", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue test",
      email: "pas-un-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepte un email valide", () => {
    const result = identitySchema.safeParse({
      name: "Mon Entreprise",
      legalForm: "Micro-entreprise",
      siret: VALID_SIRET,
      address: "12 rue test, 13001 Marseille",
      email: "contact@example.com",
    });
    expect(result.success).toBe(true);
  });
});

describe("identitySchema — formes juridiques", () => {
  const validForms = [
    "Micro-entreprise",
    "EI",
    "EURL",
    "SASU",
    "SAS",
    "SARL",
    "SA",
    "Autre",
  ] as const;

  for (const form of validForms) {
    it(`accepte la forme "${form}"`, () => {
      const result = identitySchema.safeParse({
        name: "Test",
        legalForm: form,
        siret: VALID_SIRET,
        address: "12 rue test",
        email: "a@b.fr",
      });
      expect(result.success).toBe(true);
    });
  }

  it("rejette une forme juridique invalide", () => {
    const result = identitySchema.safeParse({
      name: "Test",
      legalForm: "InvalidForm",
      siret: VALID_SIRET,
      address: "12 rue test",
      email: "a@b.fr",
    });
    expect(result.success).toBe(false);
  });
});
