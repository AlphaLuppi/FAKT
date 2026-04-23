import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("CORS", () => {
  it("preflight OPTIONS depuis Vite dev (localhost:1420) est autorisé sans token", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:1420",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "X-FAKT-Token, Content-Type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:1420");
    const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    expect(allowHeaders).toContain("x-fakt-token");
    expect(allowHeaders).toContain("content-type");
    const allowMethods = (res.headers.get("access-control-allow-methods") ?? "").toUpperCase();
    expect(allowMethods).toContain("POST");
  });

  it("preflight OPTIONS depuis webview Tauri Windows (https://tauri.localhost) est autorisé", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "OPTIONS",
      headers: {
        Origin: "https://tauri.localhost",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://tauri.localhost");
  });

  it("requête GET réelle depuis origin allowed expose les headers custom", async () => {
    const { app, authHeaders } = createTestApp();
    const res = await app.request("/api/workspace", {
      headers: authHeaders({ Origin: "http://localhost:1420" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:1420");
    const exposed = (res.headers.get("access-control-expose-headers") ?? "").toLowerCase();
    expect(exposed).toContain("x-request-id");
    expect(exposed).toContain("x-fakt-api-version");
  });

  it("origin non whitelisté ne reçoit pas de header Access-Control-Allow-Origin", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/workspace", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
