import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwtAuthMiddleware } from "./auth/middleware-jwt.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler, requestIdMiddleware } from "./middleware/index.js";
import { createAuthRoutes } from "./routes/auth.js";
import {
  activityRoutes,
  backupsRoutes,
  clientsRoutes,
  healthRoutes,
  invoicesRoutes,
  numberingRoutes,
  quotesRoutes,
  renderRoutes,
  searchRoutes,
  servicesRoutes,
  settingsRoutes,
  signaturesRoutes,
  workspaceRoutes,
} from "./routes/index.js";
import type { AppConfig, AppEnv } from "./types.js";
import { API_VERSION } from "./types.js";

/**
 * Origins autorisés à appeler le serveur depuis le navigateur (CORS).
 *
 * Mode 1 (sidecar local 127.0.0.1) — bloquer les pages web tierces (DNS rebinding) :
 *   - http://localhost:1420   : Vite dev server (`bun run dev`)
 *   - tauri://localhost       : webview Tauri 2 macOS/Linux
 *   - http(s)://tauri.localhost : webview WebView2 sous Windows
 *
 * Mode 2 (self-host fakt.alphaluppi.fr) — accepter le frontend web AlphaLuppi :
 *   - https://fakt.alphaluppi.fr (servi par même Caddy, mais cookies cross-origin si IP différente)
 *   - tauri://localhost (l'app desktop pré-bakée AlphaLuppi qui tape sur le backend distant)
 *   - https://localhost:1420 (dev local desktop pointant sur backend remote)
 *
 * Variable d'env `FAKT_API_EXTRA_ORIGINS` (CSV) override.
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
 *
 * Mode 1 (local) : auth via header X-FAKT-Token (token shared, mono-user implicite).
 * Mode 2 (jwt+pg) : auth via JWT cookie/bearer, multi-user, /api/auth/* exposé.
 *
 * Chaîne middleware : cors → requestId → injecteurs db → auth (sauf /health, /api/auth) → routes.
 */
export function createApp(config: AppConfig): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const allowedOrigins = buildAllowedOrigins();
  app.use(
    "*",
    cors({
      origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
      allowHeaders: ["X-FAKT-Token", "Content-Type", "Authorization", "X-FAKT-Workspace-Id"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["X-Request-Id", "X-FAKT-Api-Version"],
      maxAge: 600,
      credentials: true,
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

  // Mode 2 : routes auth publiques (login/refresh/logout) — pas de middleware auth en amont.
  if (config.authMode === "jwt" && config.pgDb && config.jwtSecret) {
    const authRoutes = createAuthRoutes({
      pgDb: config.pgDb,
      jwtSecret: config.jwtSecret,
      ...(config.cookieDomain !== undefined ? { cookieDomain: config.cookieDomain } : {}),
      ...(config.cookieSecure !== undefined ? { cookieSecure: config.cookieSecure } : {}),
    });
    app.route("/api/auth", authRoutes);
  }

  // Toutes les autres routes /api/* → derrière middleware auth (mode 1 ou 2).
  if (config.authMode === "jwt" && config.jwtSecret) {
    app.use("/api/*", jwtAuthMiddleware(config.jwtSecret));
  } else {
    app.use("/api/*", authMiddleware(config.authToken));
  }

  app.route("/api/workspace", workspaceRoutes);
  app.route("/api/settings", settingsRoutes);
  app.route("/api/clients", clientsRoutes);
  app.route("/api/services", servicesRoutes);
  app.route("/api/numbering", numberingRoutes);
  app.route("/api/quotes", quotesRoutes);
  app.route("/api/invoices", invoicesRoutes);
  app.route("/api/activity", activityRoutes);
  app.route("/api/search", searchRoutes);
  app.route("/api", signaturesRoutes);
  app.route("/api/backups", backupsRoutes);
  app.route("/api/render", renderRoutes);

  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: `route ${c.req.method} ${c.req.path} introuvable` } },
      404
    )
  );

  app.onError(errorHandler);

  return app;
}
