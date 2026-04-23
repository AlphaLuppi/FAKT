import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("GET /health", () => {
  it("répond 200 status=ok sans auth", async () => {
    const { app } = createTestApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string; db: string };
    expect(body.status).toBe("ok");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.db).toBe("ok");
  });

  it("expose header X-Request-Id", async () => {
    const { app } = createTestApp();
    const res = await app.request("/health");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("expose header X-FAKT-Api-Version", async () => {
    const { app } = createTestApp();
    const res = await app.request("/health");
    expect(res.headers.get("x-fakt-api-version")).toBe("0.1.1");
  });
});
