import type { MiddlewareHandler } from "hono";
import { timingSafeEqual } from "node:crypto";
import type { AppEnv } from "../types.js";
import { unauthorized } from "../errors.js";

const HEADER = "x-fakt-token";

/** Compare deux strings en temps constant (CSRF / timing attack resistance). */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Vérifie le header X-FAKT-Token en temps constant.
 * Le token est partagé au spawn du sidecar (env FAKT_API_TOKEN) et injecté
 * dans le webview Tauri via window.__FAKT_API_TOKEN__.
 */
export function authMiddleware(expectedToken: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const provided = c.req.header(HEADER);
    if (!provided) throw unauthorized("header X-FAKT-Token requis");
    if (!constantTimeEquals(provided, expectedToken)) throw unauthorized();
    await next();
  };
}
