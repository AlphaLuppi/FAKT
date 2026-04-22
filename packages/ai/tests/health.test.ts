/**
 * Unit tests for healthCheck cross-OS detection.
 * Does NOT require Claude CLI — mocks the Tauri invoke.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { healthCheck } from "../src/health.ts";

// ─── Mock @tauri-apps/api/core ────────────────────────────────────────────────

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

async function getInvokeMock() {
  const mod = await import("@tauri-apps/api/core");
  return vi.mocked(mod.invoke);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("healthCheck", () => {
  it("returns installed=true when CLI is found", async () => {
    const invoke = await getInvokeMock();
    invoke.mockResolvedValueOnce({
      stdout: "2.1.113 (Claude Code)",
      path: "/usr/local/bin/claude",
    });

    const info = await healthCheck();

    expect(info.installed).toBe(true);
    expect(info.version).toBe("2.1.113");
    expect(info.path).toBe("/usr/local/bin/claude");
    expect(info.installHint).toBeUndefined();
  });

  it("returns installed=false with installHint when CLI throws", async () => {
    const invoke = await getInvokeMock();
    invoke.mockRejectedValueOnce(new Error("command not found: claude"));

    const info = await healthCheck();

    expect(info.installed).toBe(false);
    expect(info.installHint).toBeDefined();
    expect(info.installHint).toContain("https://claude.ai/code");
  });

  it("returns installed=false in non-Tauri context (invoke returns null path)", async () => {
    // Simulate non-Tauri env by making import fail.
    const invoke = await getInvokeMock();
    invoke.mockRejectedValueOnce(new Error("Not in Tauri context"));

    const info = await healthCheck();

    expect(info.installed).toBe(false);
    expect(info.installHint).toBeDefined();
  });

  it("parses version with extra text correctly", async () => {
    const invoke = await getInvokeMock();
    invoke.mockResolvedValueOnce({
      stdout: "claude version 3.0.0-beta.1",
      path: "/home/user/.local/bin/claude",
    });

    const info = await healthCheck();

    expect(info.installed).toBe(true);
    expect(info.version).toBe("3.0.0");
  });

  it("handles stdout without version number gracefully", async () => {
    const invoke = await getInvokeMock();
    invoke.mockResolvedValueOnce({
      stdout: "OK",
      path: "/usr/bin/claude",
    });

    const info = await healthCheck();

    expect(info.installed).toBe(true);
    expect(info.version).toBeUndefined();
  });
});

describe("healthCheck installHint OS variants", () => {
  it("includes winget hint on Windows", async () => {
    // Simulate Windows platform.
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });

    const invoke = await getInvokeMock();
    invoke.mockRejectedValueOnce(new Error("not found"));

    const info = await healthCheck();
    expect(info.installHint).toContain("winget");

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("includes brew hint on macOS", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    const invoke = await getInvokeMock();
    invoke.mockRejectedValueOnce(new Error("not found"));

    const info = await healthCheck();
    expect(info.installHint).toContain("brew");

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("includes curl hint on Linux", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    const invoke = await getInvokeMock();
    invoke.mockRejectedValueOnce(new Error("not found"));

    const info = await healthCheck();
    expect(info.installHint).toContain("curl");

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});
