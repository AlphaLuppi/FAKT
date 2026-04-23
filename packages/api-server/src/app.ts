import { Hono } from "hono";
import { cors } from "hono/cors";
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
 * Origins autorisés à appeler le sidecar depuis le navigateur (CORS).
 * Le sidecar n'écoute que sur 127.0.0.1, donc l'attaque réseau distante est
 * impossible — la whitelist sert uniquement à bloquer les pages web tierces
 * que l'utilisateur visiterait en parallèle (DNS rebinding / fetch cross-origin).
 *  - http://localhost:1420   : Vite dev server (`bun run dev`)
 *  - tauri://localhost       : webview Tauri 2 macOS/Linux
 *  - http(s)://tauri.localhost : webview WebView2 sous Windows
 * Variable d'env `FAKT_API_EXTRA_ORIGINS` (CSV) pour les déploiements
 * self-host éventuels.
 */
const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  "http://localhost:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

function buildAllowedOrigins(): readonly string[] {
  const extra = process.env.FAKT_API_EXTRA_ORIGINS;
  if (!extra) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = extra
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return [...DEFAULT_ALLOWED_ORIGINS, ...parsed];
}

/**
 * Construit l'application Hono.
 * Chaîne de middlewares : cors → requestId → injecteurs db/token → auth (sauf /health) → routes.
 * Error handler branché via app.onError.
 */
export function createApp(config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const allowedOrigins = buildAllowedOrigins();
  app.use(
    "*",
    cors({
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
      allowHeaders: ["X-FAKT-Token", "Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["X-Request-Id", "X-FAKT-Api-Version"],
      maxAge: 600,
    })
  );

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
