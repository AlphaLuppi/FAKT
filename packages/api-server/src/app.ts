import { Hono } from "hono";
import type { AppConfig, AppEnv } from "./types.js";
import { API_VERSION } from "./types.js";
import {
  authMiddleware,
  errorHandler,
  requestIdMiddleware,
} from "./middleware/index.js";
import {
  healthRoutes,
  workspaceRoutes,
  settingsRoutes,
  clientsRoutes,
} from "./routes/index.js";

/**
 * Construit l'application Hono.
 * Chaîne de middlewares : requestId → injecteurs db/token → auth (sauf /health) → routes.
 * Error handler branché via app.onError.
 */
export function createApp(config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", requestIdMiddleware());

  app.use("*", async (c, next) => {
    c.set("db", config.db);
    c.set("authToken", config.authToken);
    c.header("X-FAKT-Api-Version", API_VERSION);
    await next();
  });

  app.route("/health", healthRoutes);

  const auth = authMiddleware(config.authToken);
  app.use("/api/*", auth);

  app.route("/api/workspace", workspaceRoutes);
  app.route("/api/settings", settingsRoutes);
  app.route("/api/clients", clientsRoutes);

  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: `route ${c.req.method} ${c.req.path} introuvable` } },
      404
    )
  );

  app.onError(errorHandler);

  return app;
}
