import { describe, expect, it } from "vitest";
import {
  explainSiret,
  formatSiret,
  normalizeSiret,
  siretToSiren,
  validateSiret,
} from "../siret.js";

describe("validateSiret", () => {
  it("valide un SIRET légal connu (La Poste)", () => {
    // La Poste — cas spécial exception Luhn
    expect(validateSiret("356000000912345")).toBe(false); // 15 chiffres → invalide
    expect(validateSiret("35600000000048")).toBe(true); // 14 chiffres La Poste
  });

  it("valide un SIRET structurellement correct", () => {
    // SIRET fictif mais structurellement correct (Luhn OK)
    expect(validateSiret("73282932000074")).toBe(true);
  });

  it("rejette un SIRET avec mauvaise clé Luhn", () => {
    // Dernier chiffre modifié — clé invalide
    expect(validateSiret("73282932000073")).toBe(false);
  });

  it("rejette un SIRET de mauvaise longueur", () => {
    expect(validateSiret("1234567890123")).toBe(false); // 13 chiffres
    expect(validateSiret("123456789012345")).toBe(false); // 15 chiffres
    expect(validateSiret("")).toBe(false);
  });

  it("rejette un SIRET avec des lettres", () => {
    expect(validateSiret("7328293200007A")).toBe(false);
  });

  it("accepte un SIRET avec des espaces (normalisation)", () => {
    expect(validateSiret("732 829 320 00074")).toBe(true);
  });
});

describe("formatSiret", () => {
  it("formate un SIRET en XXX XXX XXX XXXXX", () => {
    expect(formatSiret("73282932000074")).toBe("732 829 320 00074");
  });

  it("retourne le SIRET original si longueur incorrecte", () => {
    const invalid = "1234";
    expect(formatSiret(invalid)).toBe(invalid);
  });
});

describe("normalizeSiret", () => {
  it("supprime les espaces", () => {
    expect(normalizeSiret("732 829 320 00074")).toBe("73282932000074");
  });

  it("supprime les tirets", () => {
    expect(normalizeSiret("732-829-320-00074")).toBe("73282932000074");
  });
});

describe("siretToSiren", () => {
  it("extrait les 9 premiers chiffres", () => {
    expect(siretToSiren("73282932000074")).toBe("732829320");
  });
});

describe("explainSiret", () => {
  it("détecte un SIRET vide", () => {
    const r = explainSiret("");
    expect(r.isValid).toBe(false);
    expect(r.issue).toBe("empty");
    expect(r.length).toBe(0);
  });

  it("détecte une longueur trop courte", () => {
    const r = explainSiret("7328293200");
    expect(r.issue).toBe("too-short");
    expect(r.hasCorrectLength).toBe(false);
    expect(r.length).toBe(10);
  });

  it("détecte une longueur trop longue", () => {
    const r = explainSiret("732829320000740");
    expect(r.issue).toBe("too-long");
    expect(r.length).toBe(15);
  });

  it("détecte les caractères non-numériques", () => {
    const r = explainSiret("7328293200007A");
    expect(r.issue).toBe("non-digit");
    expect(r.hasOnlyDigits).toBe(false);
  });

  it("accepte un SIRET Luhn-valide", () => {
    const r = explainSiret("73282932000074");
    expect(r.isValid).toBe(true);
    expect(r.issue).toBeNull();
    expect(r.isLuhnValid).toBe(true);
    expect(r.luhnSum).not.toBeNull();
    expect((r.luhnSum as number) % 10).toBe(0);
  });

  it("détaille le chiffre de contrôle attendu quand Luhn KO", () => {
    // SIRET avec 13 premiers chiffres corrects, dernier faux
    const r = explainSiret("73282932000073");
    expect(r.issue).toBe("luhn-mismatch");
    expect(r.isLuhnValid).toBe(false);
    expect(r.actualLastDigit).toBe(3);
    expect(r.expectedLastDigit).toBe(4);
  });

  it("indique la clé attendue pour le placeholder fictif 12345678900012", () => {
    // Démontre le bug du placeholder historique (clé Luhn KO)
    const r = explainSiret("12345678900012");
    expect(r.isValid).toBe(false);
    expect(r.actualLastDigit).toBe(2);
    expect(r.expectedLastDigit).toBe(5);
  });

  it("accepte l'exception La Poste malgré Luhn non strict", () => {
    const r = explainSiret("35600000000048");
    expect(r.isValid).toBe(true);
    expect(r.isLaPosteException).toBe(true);
  });

  it("normalise avant d'analyser (espaces tolérés)", () => {
    const r = explainSiret("732 829 320 00074");
    expect(r.isValid).toBe(true);
    expect(r.normalized).toBe("73282932000074");
  });
});
