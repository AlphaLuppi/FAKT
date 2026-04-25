import { randomUUID } from "node:crypto";
import { type PgDbInstance, pgSchema } from "@fakt/db";
import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  REFRESH_TOKEN_TTL_SEC,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from "../auth/index.js";
import { unauthorized } from "../errors.js";
import { parseBody } from "../middleware/zod.js";
import type { AppEnv } from "../types.js";

/**
 * Routes auth pour mode 2 self-host + mode 3 SaaS.
 *
 * Préfixe : `/api/auth/*`. Public (pas de middleware JWT en amont — il auth ICI).
 * Active uniquement si `AUTH_MODE=jwt` ET `dbDialect=postgresql` (les tables
 * users/sessions/oauth_accounts n'existent qu'en schéma PG).
 *
 * Endpoints :
 *   POST /login    — email + password → access + refresh tokens (cookie + body).
 *   POST /refresh  — refresh token → nouveau access token (rotation refresh).
 *   POST /logout   — révoque le refresh token courant.
 *   GET  /me       — user courant + workspaces (depuis access token).
 */

export interface AuthRoutesConfig {
  pgDb: PgDbInstance;
  jwtSecret: string;
  /** Domaine cookie. Défaut absent → cookie attaché au domaine de la requête. */
  cookieDomain?: string;
  /** Secure cookie (HTTPS only). True en prod, false en dev local. */
  cookieSecure?: boolean;
}

const COOKIE_NAME = "fakt_session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export function createAuthRoutes(config: AuthRoutesConfig): Hono<AppEnv> {
  const { pgDb, jwtSecret, cookieDomain, cookieSecure = true } = config;
  const cookieOpts: { cookieDomain?: string; cookieSecure?: boolean } = {
    cookieSecure,
    ...(cookieDomain !== undefined ? { cookieDomain } : {}),
  };
  const app = new Hono<AppEnv>();

  app.post("/login", async (c) => {
    const body = await parseBody(c, loginSchema);
    const userRow = await pgDb
      .select()
      .from(pgSchema.users)
      .where(eq(pgSchema.users.email, body.email.toLowerCase()))
      .limit(1);
    const user = userRow[0];
    if (!user || !user.passwordHash || user.disabledAt !== null) {
      throw unauthorized("invalid email or password");
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      throw unauthorized("invalid email or password");
    }

    const userWs = await pgDb
      .select({ workspaceId: pgSchema.userWorkspaces.workspaceId })
      .from(pgSchema.userWorkspaces)
      .where(eq(pgSchema.userWorkspaces.userId, user.id));
    const workspaceIds = userWs.map((r) => r.workspaceId);
    if (workspaceIds.length === 0) {
      throw unauthorized("user has no workspace access");
    }

    const sessionId = randomUUID();
    const refreshToken = await signRefreshToken(jwtSecret, user.id, sessionId);
    const refreshTokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000);

    await pgDb.insert(pgSchema.sessions).values({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      userAgent: c.req.header("user-agent") ?? null,
      ipAddress: c.req.header("x-forwarded-for") ?? null,
      expiresAt,
    });
    await pgDb
      .update(pgSchema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(pgSchema.users.id, user.id));

    const accessToken = await signAccessToken(jwtSecret, user.id, workspaceIds);

    setSessionCookie(c, accessToken, cookieOpts);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      workspaces: workspaceIds,
      accessToken,
      refreshToken,
    });
  });

  app.post("/refresh", async (c) => {
    const body = await parseBody(c, refreshSchema);
    let payload;
    try {
      payload = await verifyRefreshToken(jwtSecret, body.refreshToken);
    } catch {
      throw unauthorized("invalid refresh token");
    }
    const tokenHash = await hashToken(body.refreshToken);
    const sessionRow = await pgDb
      .select()
      .from(pgSchema.sessions)
      .where(
        and(
          eq(pgSchema.sessions.id, payload.sid),
          eq(pgSchema.sessions.refreshTokenHash, tokenHash),
          isNull(pgSchema.sessions.revokedAt)
        )
      )
      .limit(1);
    const session = sessionRow[0];
    if (!session) {
      throw unauthorized("session not found or revoked");
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw unauthorized("session expired");
    }

    const userWs = await pgDb
      .select({ workspaceId: pgSchema.userWorkspaces.workspaceId })
      .from(pgSchema.userWorkspaces)
      .where(eq(pgSchema.userWorkspaces.userId, payload.sub));
    const workspaceIds = userWs.map((r) => r.workspaceId);
    if (workspaceIds.length === 0) {
      throw unauthorized("user has no workspace access");
    }

    const accessToken = await signAccessToken(jwtSecret, payload.sub, workspaceIds);
    setSessionCookie(c, accessToken, cookieOpts);

    return c.json({ accessToken, workspaces: workspaceIds });
  });

  app.post("/logout", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const refreshToken = (body as { refreshToken?: string }).refreshToken;
    if (refreshToken) {
      try {
        const payload = await verifyRefreshToken(jwtSecret, refreshToken);
        const tokenHash = await hashToken(refreshToken);
        await pgDb
          .update(pgSchema.sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(pgSchema.sessions.id, payload.sid),
              eq(pgSchema.sessions.refreshTokenHash, tokenHash)
            )
          );
      } catch {
        // ignore — logout doit toujours réussir côté client
      }
    }
    clearSessionCookie(c, cookieOpts);
    return c.json({ ok: true });
  });

  app.get("/me", async (c) => {
    const userId = c.get("userId" as never) as string | undefined;
    if (!userId) {
      throw unauthorized("not authenticated");
    }
    const userRow = await pgDb
      .select()
      .from(pgSchema.users)
      .where(eq(pgSchema.users.id, userId))
      .limit(1);
    const user = userRow[0];
    if (!user) {
      throw unauthorized("user not found");
    }
    const userWs = await pgDb
      .select({
        workspaceId: pgSchema.userWorkspaces.workspaceId,
        role: pgSchema.userWorkspaces.role,
      })
      .from(pgSchema.userWorkspaces)
      .where(eq(pgSchema.userWorkspaces.userId, user.id));
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      workspaces: userWs,
    });
  });

  return app;
}

interface CookieContext {
  header: (name: string, value: string, options?: { append?: boolean }) => void;
}

function setSessionCookie(
  c: CookieContext,
  token: string,
  opts: { cookieDomain?: string; cookieSecure?: boolean }
): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${15 * 60}`,
  ];
  if (opts.cookieSecure !== false) parts.push("Secure");
  if (opts.cookieDomain) parts.push(`Domain=${opts.cookieDomain}`);
  c.header("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(
  c: CookieContext,
  opts: { cookieDomain?: string; cookieSecure?: boolean }
): void {
  const parts = [`${COOKIE_NAME}=`, "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (opts.cookieSecure !== false) parts.push("Secure");
  if (opts.cookieDomain) parts.push(`Domain=${opts.cookieDomain}`);
  c.header("Set-Cookie", parts.join("; "));
}

export function isAuthRoutesAvailable(authMode: string, dbDialect: string): boolean {
  return authMode === "jwt" && dbDialect === "postgresql";
}
