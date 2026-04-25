import type { MiddlewareHandler } from "hono";
import { unauthorized } from "../errors.js";
import type { AppEnv } from "../types.js";
import { verifyAccessToken } from "./jwt.js";

const HEADER_AUTHORIZATION = "authorization";
const HEADER_WORKSPACE_ID = "x-fakt-workspace-id";
const COOKIE_NAME = "fakt_session";

/**
 * Middleware d'authentification JWT pour mode 2 self-host + mode 3 SaaS.
 *
 * Flux :
 *   1. Lit le token depuis `Authorization: Bearer <jwt>` OU cookie httpOnly `fakt_session`.
 *   2. Vérifie HS256 avec le secret partagé.
 *   3. Résout `c.var.userId` depuis `sub`.
 *   4. Résout `c.var.workspaceId` :
 *      - Si header `X-FAKT-Workspace-Id` présent + dans `payload.ws[]` → utilise.
 *      - Sinon si `payload.ws.length === 1` → fallback sur le seul workspace.
 *      - Sinon → 400 "workspace selection required" (multi-workspace).
 *
 * North star : la résolution workspace est SERVER-side, jamais une donnée client de confiance.
 * Le payload JWT liste les workspaces accessibles, mais c'est le middleware qui valide.
 */
export function jwtAuthMiddleware(jwtSecret: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = extractToken(c);
    if (!token) {
      throw unauthorized("missing JWT token (Authorization: Bearer <jwt> or fakt_session cookie)");
    }

    let payload;
    try {
      payload = await verifyAccessToken(jwtSecret, token);
    } catch {
      throw unauthorized("invalid or expired JWT");
    }

    if (!Array.isArray(payload.ws) || payload.ws.length === 0) {
      throw unauthorized("user has no workspace access");
    }

    const requestedWs = c.req.header(HEADER_WORKSPACE_ID);
    let workspaceId: string;
    if (requestedWs) {
      if (!payload.ws.includes(requestedWs)) {
        throw unauthorized(`workspace ${requestedWs} not accessible by this user`);
      }
      workspaceId = requestedWs;
    } else if (payload.ws.length === 1) {
      workspaceId = payload.ws[0]!;
    } else {
      throw unauthorized(
        "multi-workspace user must specify X-FAKT-Workspace-Id header"
      );
    }

    c.set("userId", payload.sub);
    c.set("workspaceId", workspaceId);
    c.set("accessibleWorkspaceIds", payload.ws);
    await next();
  };
}

interface CookieReader {
  req: { header: (name: string) => string | undefined };
}

function extractToken(c: CookieReader): string | null {
  const auth = c.req.header(HEADER_AUTHORIZATION);
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token.length > 0) return token;
  }
  const cookie = c.req.header("cookie");
  if (cookie) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}
