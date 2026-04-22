import { describe, expect, it } from "vitest";
import { formatSiret, normalizeSiret, siretToSiren, validateSiret } from "../siret.js";

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
