/**
 * Client HTTP vers le sidecar api-server de FAKT.
 *
 * Connexion paramétrée par les env vars injectées par le Rust `spawn_claude` :
 *   - `FAKT_API_URL`    — ex: "http://127.0.0.1:8765"
 *   - `FAKT_API_TOKEN`  — token partagé sidecar
 *
 * Pas de retry, pas de cache — ce client est éphémère (durée de vie d'un
 * appel `claude --mcp-config`). Les erreurs sont propagées telles quelles
 * pour que Claude les voit dans le tool_result.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

function getBaseUrl(): string {
  const url = process.env["FAKT_API_URL"];
  if (!url || url.length === 0) {
    throw new Error(
      "FAKT_API_URL absent — le MCP server doit être lancé par Claude CLI via spawn_claude (Tauri)."
    );
  }
  return url.replace(/\/$/, "");
}

function getToken(): string {
  const token = process.env["FAKT_API_TOKEN"];
  if (!token || token.length === 0) {
    throw new Error("FAKT_API_TOKEN absent — impossible de contacter le sidecar.");
  }
  return token;
}

type QueryValue = string | number | boolean | undefined | null;

function toQuery(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s.length > 0 ? `?${s}` : "";
}

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Record<string, QueryValue>; body?: unknown } = {}
): Promise<T> {
  const url = `${getBaseUrl()}${path}${toQuery(opts.query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-FAKT-Token": getToken(),
    },
    signal: controller.signal,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiClientError(0, "NETWORK_ERROR", `Échec requête ${method} ${path} : ${msg}`);
  }
  clearTimeout(timer);

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const body = parsed as ErrorBody;
    const code = body?.error?.code ?? "INTERNAL_ERROR";
    const message = body?.error?.message ?? `HTTP ${response.status}`;
    throw new ApiClientError(response.status, code, message, body?.error?.details);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T>(path: string, query?: Record<string, QueryValue>): Promise<T> => {
    const opts: { query?: Record<string, QueryValue> } = {};
    if (query !== undefined) opts.query = query;
    return request<T>("GET", path, opts);
  },
  post: <T>(path: string, body?: unknown, query?: Record<string, QueryValue>): Promise<T> => {
    const opts: { body?: unknown; query?: Record<string, QueryValue> } = {};
    if (body !== undefined) opts.body = body;
    if (query !== undefined) opts.query = query;
    return request<T>("POST", path, opts);
  },
  patch: <T>(path: string, body?: unknown): Promise<T> => {
    const opts: { body?: unknown } = {};
    if (body !== undefined) opts.body = body;
    return request<T>("PATCH", path, opts);
  },
  delete: <T>(path: string): Promise<T> => request<T>("DELETE", path),
};
