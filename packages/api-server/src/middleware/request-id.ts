import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import type { AppEnv } from "../types.js";

/** Assigne un UUID v4 à chaque requête, expose via c.var.requestId + header X-Request-Id. */
export function requestIdMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = randomUUID();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  };
}
