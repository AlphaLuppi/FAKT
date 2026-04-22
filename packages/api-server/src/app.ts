import { Hono } from "hono";
import { authMiddleware, errorHandler, requestIdMiddleware } from "./middleware/index.js";
import {
  activityRoutes,
  backupsRoutes,
  clientsRoutes,
  healthRoutes,
  invoicesRoutes,
  numberingRoutes,
  quotesRoutes,
  servicesRoutes,
  settingsRoutes,
  signaturesRoutes,
  workspaceRoutes,
} from "./routes/index.js";
import type { AppConfig, AppEnv } from "./types.js";
import { API_VERSION } from "./types.js";

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
    c.set("sqlite", config.sqlite);
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
  app.route("/api/services", servicesRoutes);
  app.route("/api/numbering", numberingRoutes);
  app.route("/api/quotes", quotesRoutes);
  app.route("/api/invoices", invoicesRoutes);
  app.route("/api/activity", activityRoutes);
  app.route("/api", signaturesRoutes);
  app.route("/api/backups", backupsRoutes);

  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: `route ${c.req.method} ${c.req.path} introuvable` } },
      404
    )
  );

  app.onError(errorHandler);

  return app;
}
