import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, ApiError, getApiClient, setApiClient } from "./client.js";

describe("ApiClient", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setApiClient(null);
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("envoie le header X-FAKT-Token et encode la query string", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = new ApiClient("http://127.0.0.1:8765", "secret");
    await client.get("/api/clients", { search: "ACME", limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8765/api/clients?search=ACME&limit=10");
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-FAKT-Token"]).toBe("secret");
  });

  it("ajoute Content-Type: application/json sur POST avec body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "abc" }));
    const client = new ApiClient("http://x", "t");
    await client.post("/api/clients", { name: "Jean" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Jean" }));
  });

  it("mappe 404 vers ApiError code NOT_FOUND", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { error: { code: "NOT_FOUND", message: "missing" } }),
    );
    const client = new ApiClient("http://x", "t");
    await expect(client.get("/api/clients/missing")).rejects.toMatchObject({
      name: "ApiError",
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("mappe 422 VALIDATION_ERROR", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        error: { code: "VALIDATION_ERROR", message: "invalid", details: { foo: "bar" } },
      }),
    );
    const client = new ApiClient("http://x", "t");
    try {
      await client.post("/api/clients", { bad: true });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.code).toBe("VALIDATION_ERROR");
      expect(e.details).toEqual({ foo: "bar" });
    }
  });

  it("mappe 409 CONFLICT", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: "CONFLICT", message: "dup" } }),
    );
    const client = new ApiClient("http://x", "t");
    await expect(client.post("/api/workspace", {})).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("mappe 401 UNAUTHORIZED", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "nope" } }),
    );
    const client = new ApiClient("http://x", "t");
    await expect(client.get("/api/clients")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("traduit une erreur réseau fetch en NETWORK_ERROR", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    const client = new ApiClient("http://x", "t");
    try {
      await client.get("/api/clients");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const e = err as ApiError;
      expect(e.code).toBe("NETWORK_ERROR");
      expect(e.status).toBe(0);
    }
  });

  it("renvoie undefined sur 204 No Content", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient("http://x", "t");
    const res = await client.delete<void>("/api/clients/abc");
    expect(res).toBeUndefined();
  });

  it("renvoie undefined sur 200 avec body vide (Content-Length: 0)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { "Content-Length": "0" },
      }),
    );
    const client = new ApiClient("http://x", "t");
    const res = await client.post<void>("/api/ping");
    expect(res).toBeUndefined();
  });

  it("renvoie undefined sur 200 JSON avec body vide sans Content-Length", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new ApiClient("http://x", "t");
    const res = await client.post<void>("/api/ping");
    expect(res).toBeUndefined();
  });

  it("préserve l'ordre alphabétique des segments de path et gère les slashes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    const client = new ApiClient("http://127.0.0.1:8765/", "t");
    await client.get("api/workspace");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://127.0.0.1:8765/api/workspace");
  });

  it("ignore les valeurs undefined/null dans la query string", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    const client = new ApiClient("http://x", "t");
    await client.get("/api/clients", { search: "A", limit: undefined, offset: null });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://x/api/clients?search=A");
  });

  it("singleton getApiClient retourne la même instance", () => {
    setApiClient(null);
    const a = getApiClient();
    const b = getApiClient();
    expect(a).toBe(b);
  });

  it("setApiClient permet d'injecter un double en test", async () => {
    const stub = new ApiClient("http://stub", "stub-token");
    setApiClient(stub);
    expect(getApiClient()).toBe(stub);
    setApiClient(null);
    expect(getApiClient()).not.toBe(stub);
  });
});
