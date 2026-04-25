import { sign, verify } from "hono/jwt";

/**
 * JWT HS256 pour FAKT mode 2 self-host + mode 3 SaaS.
 *
 * - **Access token** : 15 min, contient userId + workspaceIds[].
 * - **Refresh token** : 30 jours, stocké hashé en table `sessions` (révocable).
 * - **Algo** : HS256 (symétrique). Suffisant pour mode 2 single-server.
 *   Pour multi-tenant scaled SaaS v0.3, migrer vers RS256/EdDSA si besoin (KMS).
 */

export interface AccessTokenPayload {
  /** subject = user id */
  sub: string;
  /** workspace IDs accessibles par ce user (non-sensible — résolu serveur via DB de toute façon). */
  ws: string[];
  /** issued at (epoch seconds) */
  iat: number;
  /** expires at (epoch seconds) */
  exp: number;
  /** token type discriminator */
  typ: "access";
  /** index signature requis par hono/jwt JWTPayload */
  [key: string]: unknown;
}

export interface RefreshTokenPayload {
  sub: string;
  /** session id en DB pour révocation lookup */
  sid: string;
  iat: number;
  exp: number;
  typ: "refresh";
  [key: string]: unknown;
}

export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

export async function signAccessToken(
  secret: string,
  userId: string,
  workspaceIds: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: userId,
    ws: workspaceIds,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SEC,
    typ: "access",
  };
  return sign(payload, secret, "HS256");
}

export async function signRefreshToken(
  secret: string,
  userId: string,
  sessionId: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: RefreshTokenPayload = {
    sub: userId,
    sid: sessionId,
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SEC,
    typ: "refresh",
  };
  return sign(payload, secret, "HS256");
}

export async function verifyAccessToken(
  secret: string,
  token: string
): Promise<AccessTokenPayload> {
  const decoded = (await verify(token, secret, "HS256")) as unknown as AccessTokenPayload;
  if (decoded.typ !== "access") {
    throw new Error("expected access token");
  }
  return decoded;
}

export async function verifyRefreshToken(
  secret: string,
  token: string
): Promise<RefreshTokenPayload> {
  const decoded = (await verify(token, secret, "HS256")) as unknown as RefreshTokenPayload;
  if (decoded.typ !== "refresh") {
    throw new Error("expected refresh token");
  }
  return decoded;
}

/** Hash SHA-256 du refresh token pour stockage en DB (jamais le token brut). */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
