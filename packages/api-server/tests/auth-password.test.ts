import { describe, expect, it } from "vitest";
import {
  generateRandomPassword,
  hashPassword,
  verifyPassword,
} from "../src/auth/password.js";

/**
 * Tests unitaires du layer password (bcrypt cost=12).
 *
 * Pas de DB nécessaire — tout est pure JS via bcryptjs. Coverage des
 * happy paths + cas d'erreur classiques.
 */

describe("auth/password", () => {
  describe("hashPassword", () => {
    it("hash un password valide en bcrypt $2a$ ou $2b$", async () => {
      const hash = await hashPassword("password123");
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
      expect(hash.length).toBeGreaterThan(50);
    });

    it("rejette un password trop court (<8 chars)", async () => {
      await expect(hashPassword("abc")).rejects.toThrow(/at least 8/);
      await expect(hashPassword("1234567")).rejects.toThrow(/at least 8/);
    });

    it("hash le même password en deux valeurs différentes (salt aléatoire)", async () => {
      const h1 = await hashPassword("password123");
      const h2 = await hashPassword("password123");
      expect(h1).not.toBe(h2);
    });

    it("accepte un password avec caractères spéciaux Unicode", async () => {
      const hash = await hashPassword("mot-de-passe-éàü-🔐");
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
    });
  });

  describe("verifyPassword", () => {
    it("retourne true sur le bon password", async () => {
      const hash = await hashPassword("correct-password");
      const ok = await verifyPassword("correct-password", hash);
      expect(ok).toBe(true);
    });

    it("retourne false sur un mauvais password", async () => {
      const hash = await hashPassword("correct-password");
      const ok = await verifyPassword("wrong-password", hash);
      expect(ok).toBe(false);
    });

    it("retourne false sur empty string ou null", async () => {
      const hash = await hashPassword("password123");
      expect(await verifyPassword("", hash)).toBe(false);
      expect(await verifyPassword("password123", "")).toBe(false);
    });

    it("retourne false sur hash invalide (bcrypt corrompu)", async () => {
      // bcryptjs throws on certain malformed inputs — la fonction doit catch
      const ok = await verifyPassword("password123", "not-a-bcrypt-hash");
      expect(ok).toBe(false);
    });

    it("respecte la casse du password", async () => {
      const hash = await hashPassword("MyPassword");
      expect(await verifyPassword("mypassword", hash)).toBe(false);
      expect(await verifyPassword("MyPassword", hash)).toBe(true);
    });
  });

  describe("generateRandomPassword", () => {
    it("génère un password de 16 chars", () => {
      const pwd = generateRandomPassword();
      expect(pwd).toHaveLength(16);
    });

    it("génère deux passwords différents (entropie suffisante)", () => {
      const set = new Set(Array.from({ length: 100 }, () => generateRandomPassword()));
      // Sur 100 itérations, on doit avoir 100 valeurs uniques (collision quasi-impossible).
      expect(set.size).toBe(100);
    });

    it("ne contient que des chars URL-safe (alphanumeric, no ambiguous)", () => {
      const pwd = generateRandomPassword();
      // Pas de I/l/0/O/o/1 pour éviter confusion à la dictée.
      expect(pwd).toMatch(/^[A-HJ-NP-Z2-9a-hjkmnp-z]+$/);
    });

    it("généré peut être hashé et vérifié sans erreur", async () => {
      const pwd = generateRandomPassword();
      const hash = await hashPassword(pwd);
      expect(await verifyPassword(pwd, hash)).toBe(true);
    });
  });
});
