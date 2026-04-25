/**
 * Singleton ApiClient — supporte deux modes de déploiement :
 *
 *   - **Mode "local"** (mode 1 sidecar) : récupère URL + token depuis
 *     `window.__FAKT_API_URL__` / `window.__FAKT_API_TOKEN__` injectés par Tauri,
 *     auth via header `X-FAKT-Token` (constant-time compare).
 *
 *   - **Mode "remote"** (mode 2 self-host) : URL configurable depuis Settings,
 *     auth via JWT — soit `Authorization: Bearer <jwt>` (en mémoire) soit cookie
 *     httpOnly `fakt_session`. `credentials: "include"` activé pour cross-origin.
 *
 * Détection : `window.__FAKT_MODE__` injecté par Rust. 1 = local sidecar, 2 = remote.
 * Override : `setMode()` / `setBaseUrl()` côté UI Settings.
 *
 * Errors : l'api-server renvoie `{ error: { code, message, details? } }`.
 * 401 en mode remote → dispatch `window.dispatchEvent(new CustomEvent("fakt:auth-expired"))`
 * pour que `useAuth` puisse rediriger vers /login.
 */

declare global {
  interface Window {
    __FAKT_API_URL__?: string;
    __FAKT_API_TOKEN__?: string;
    /** 0 = unset, 1 = local sidecar, 2 = remote backend */
    __FAKT_MODE__?: 0 | 1 | 2;
    __TAURI_INTERNALS__?: unknown;
  }
}

export const IS_TAURI: boolean =
  typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

export type ApiMode = "local" | "remote";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type QueryValue = string | number | boolean | undefined | null;
type QueryRecord = Record<string, QueryValue>;

function buildQueryString(query?: QueryRecord): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : "";
}

function statusToCode(status: number, fallback?: ApiErrorCode): ApiErrorCode {
  if (fallback) return fallback;
  switch (status) {
    case 400:
    case 422:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    default:
      return "INTERNAL_ERROR";
  }
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const err = (value as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return false;
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string";
}

export class ApiClient {
  #baseUrl: string;
  #token: string;
  #mode: ApiMode;
  /** JWT bearer en mémoire pour mode remote (cookie httpOnly est l'autorité primaire) */
  #jwtBearer: string | null = null;
  /** Workspace courant (mode remote, header X-FAKT-Workspace-Id) */
  #workspaceId: string | null = null;

  constructor(baseUrl?: string, token?: string, mode?: ApiMode) {
    this.#mode = mode ?? ApiClient.resolveMode();
    this.#baseUrl = (baseUrl ?? ApiClient.resolveBaseUrl(this.#mode)).replace(/\/+$/, "");
    this.#token = token ?? ApiClient.resolveToken();
  }

  static resolveMode(): ApiMode {
    if (typeof window !== "undefined" && window.__FAKT_MODE__ === 2) {
      return "remote";
    }
    const env = readEnv();
    if (env.VITE_FAKT_DEFAULT_MODE === "remote") return "remote";
    if (env.FAKT_TARGET === "web") return "remote"; // build web ⇒ toujours remote
    return "local";
  }

  static resolveBaseUrl(mode: ApiMode): string {
    if (typeof window !== "undefined" && window.__FAKT_API_URL__) {
      return window.__FAKT_API_URL__;
    }
    const env = readEnv();
    if (mode === "remote") {
      if (
        typeof env.VITE_FAKT_DEFAULT_BACKEND_URL === "string" &&
        env.VITE_FAKT_DEFAULT_BACKEND_URL.length > 0
      ) {
        return env.VITE_FAKT_DEFAULT_BACKEND_URL;
      }
      // En mode web, fallback sur l'origin courant (frontend + api-server même domaine)
      if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
      }
    }
    if (typeof env.VITE_FAKT_API_URL === "string" && env.VITE_FAKT_API_URL.length > 0) {
      return env.VITE_FAKT_API_URL;
    }
    return "http://127.0.0.1:8765";
  }

  static resolveToken(): string {
    if (typeof window !== "undefined" && window.__FAKT_API_TOKEN__) {
      return window.__FAKT_API_TOKEN__;
    }
    const env = readEnv();
    if (typeof env.VITE_FAKT_API_TOKEN === "string" && env.VITE_FAKT_API_TOKEN.length > 0) {
      return env.VITE_FAKT_API_TOKEN;
    }
    return "";
  }

  setToken(token: string): void {
    this.#token = token;
  }

  setBaseUrl(baseUrl: string): void {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
  }

  setMode(mode: ApiMode): void {
    this.#mode = mode;
  }

  setJwtBearer(jwt: string | null): void {
    this.#jwtBearer = jwt;
  }

  setWorkspaceId(workspaceId: string | null): void {
    this.#workspaceId = workspaceId;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  get mode(): ApiMode {
    return this.#mode;
  }

  async get<T>(path: string, query?: QueryRecord): Promise<T> {
    return this.#request<T>("GET", path, query, undefined);
  }

  async post<T>(path: string, body?: unknown, query?: QueryRecord): Promise<T> {
    return this.#request<T>("POST", path, query, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>("PATCH", path, undefined, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.#request<T>("PUT", path, undefined, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.#request<T>("DELETE", path, undefined, undefined);
  }

  async #request<T>(
    method: string,
    path: string,
    query: QueryRecord | undefined,
    body: unknown
  ): Promise<T> {
    const url = `${this.#baseUrl}${path.startsWith("/") ? path : `/${path}`}${buildQueryString(query)}`;
    const headers: Record<string, string> = {};

    if (this.#mode === "local") {
      // Mode 1 sidecar : token shared X-FAKT-Token
      if (this.#token) headers["X-FAKT-Token"] = this.#token;
    } else {
      // Mode 2 remote : Bearer JWT (et cookie httpOnly via credentials: include)
      if (this.#jwtBearer) headers["Authorization"] = `Bearer ${this.#jwtBearer}`;
      if (this.#workspaceId) headers["X-FAKT-Workspace-Id"] = this.#workspaceId;
    }

    const init: RequestInit = {
      method,
      headers,
      ...(this.#mode === "remote" ? { credentials: "include" } : {}),
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ApiError("NETWORK_ERROR", `network error: ${msg}`, 0);
    }

    if (response.status === 204 || response.headers.get("Content-Length") === "0") {
      return undefined as T;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    const isJson = contentType.includes("application/json");
    let payload: unknown;
    if (isJson) {
      const text = await response.text();
      if (text.length === 0) {
        return undefined as T;
      }
      payload = JSON.parse(text);
    } else {
      const text = await response.text();
      if (response.ok && text.length === 0) {
        return undefined as T;
      }
      payload = text;
    }

    if (!response.ok) {
      // Mode 2 : 401 → notifier useAuth pour redirect /login
      if (response.status === 401 && this.#mode === "remote" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fakt:auth-expired"));
      }
      if (isApiErrorBody(payload)) {
        const raw = payload.error.code;
        const code = statusToCode(response.status, isKnownCode(raw) ? raw : undefined);
        throw new ApiError(code, payload.error.message, response.status, payload.error.details);
      }
      throw new ApiError(
        statusToCode(response.status),
        typeof payload === "string" && payload.length > 0 ? payload : `HTTP ${response.status}`,
        response.status
      );
    }

    return payload as T;
  }
}

function readEnv(): Record<string, string | undefined> {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return meta.env ?? {};
  } catch {
    return {};
  }
}

const KNOWN_CODES: readonly ApiErrorCode[] = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INVALID_TRANSITION",
  "INTERNAL_ERROR",
  "NETWORK_ERROR",
];

function isKnownCode(value: string): value is ApiErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(value);
}

let singleton: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!singleton) singleton = new ApiClient();
  return singleton;
}

/** Test helper : remplace le singleton (rétablit le défaut si `null`). */
export function setApiClient(client: ApiClient | null): void {
  singleton = client;
}

/** Helper : reset le singleton après changement de mode/URL via Settings. */
export function resetApiClient(): void {
  singleton = null;
}
