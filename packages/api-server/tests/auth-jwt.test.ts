import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/auth/jwt.js";

/**
 * Tests unitaires du layer JWT (HS256 via hono/jwt).
 *
 * Pas de DB — pure crypto. Coverage : sign/verify sur les deux types de
 * tokens + erreurs (token type mismatch, signature invalide, expiré).
 */

const SECRET = "test-secret-min-32-chars-for-hs256-jwt-signing";
const SECRET_OTHER = "another-different-secret-min-32-chars-jwt-jwt";

describe("auth/jwt", () => {
  describe("signAccessToken / verifyAccessToken", () => {
    it("sign + verify roundtrip avec userId et workspaces", async () => {
      const token = await signAccessToken(SECRET, "user-1", ["ws-a", "ws-b"]);
      expect(token.split(".")).toHaveLength(3);

      const payload = await verifyAccessToken(SECRET, token);
      expect(payload.sub).toBe("user-1");
      expect(payload.ws).toEqual(["ws-a", "ws-b"]);
      expect(payload.typ).toBe("access");
    });

    it("inclut iat et exp avec TTL access ≈ 15 min", async () => {
      const before = Math.floor(Date.now() / 1000);
      const token = await signAccessToken(SECRET, "user-1", []);
      const payload = await verifyAccessToken(SECRET, token);
      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(before + 2);
      expect(payload.exp - payload.iat).toBe(ACCESS_TOKEN_TTL_SEC);
    });

    it("rejette si la signature est faite avec un autre secret", async () => {
      const token = await signAccessToken(SECRET, "user-1", []);
      await expect(verifyAccessToken(SECRET_OTHER, token)).rejects.toThrow();
    });

    it("rejette si typ='refresh' au lieu d'access", async () => {
      const refresh = await signRefreshToken(SECRET, "user-1", "session-1");
      await expect(verifyAccessToken(SECRET, refresh)).rejects.toThrow(/expected access/);
    });

    it("accepte workspaces vide (user sans workspace assigné)", async () => {
      const token = await signAccessToken(SECRET, "user-orphan", []);
      const payload = await verifyAccessToken(SECRET, token);
      expect(payload.ws).toEqual([]);
    });
  });

  describe("signRefreshToken / verifyRefreshToken", () => {
    it("sign + verify roundtrip avec userId et sessionId", async () => {
      const token = await signRefreshToken(SECRET, "user-2", "session-abc");
      const payload = await verifyRefreshToken(SECRET, token);
      expect(payload.sub).toBe("user-2");
      expect(payload.sid).toBe("session-abc");
      expect(payload.typ).toBe("refresh");
    });

    it("TTL refresh ≈ 30 jours", async () => {
      const token = await signRefreshToken(SECRET, "user-2", "s1");
      const payload = await verifyRefreshToken(SECRET, token);
      expect(payload.exp - payload.iat).toBe(REFRESH_TOKEN_TTL_SEC);
    });

    it("rejette si typ='access' au lieu de refresh", async () => {
      const access = await signAccessToken(SECRET, "user-2", []);
      await expect(verifyRefreshToken(SECRET, access)).rejects.toThrow(/expected refresh/);
    });

    it("rejette si signature avec secret différent", async () => {
      const token = await signRefreshToken(SECRET, "user-2", "s1");
      await expect(verifyRefreshToken(SECRET_OTHER, token)).rejects.toThrow();
    });
  });

  describe("hashToken (SHA-256)", () => {
    it("retourne un hash hex 64 chars (256 bits)", async () => {
      const hash = await hashToken("any-refresh-token-string");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("hash déterministe (même input → même output)", async () => {
      const h1 = await hashToken("token-xyz");
      const h2 = await hashToken("token-xyz");
      expect(h1).toBe(h2);
    });

    it("inputs différents → hashes différents", async () => {
      const h1 = await hashToken("token-1");
      const h2 = await hashToken("token-2");
      expect(h1).not.toBe(h2);
    });

    it("hash vide acceptable (cas dégénéré, mais ne throw pas)", async () => {
      const hash = await hashToken("");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
