/**
 * Cross-OS health check for Claude Code CLI.
 * FR-003: detects presence, version, path. Never throws.
 */

import type { CliInfo } from "./provider.ts";

// ─── OS detection ─────────────────────────────────────────────────────────────

type OsPlatform = "windows" | "macos" | "linux" | "unknown";

function detectPlatform(): OsPlatform {
  // In Tauri webview, navigator.platform is available.
  // In Node/Vitest test environment, process.platform is used.
  const platform =
    typeof process !== "undefined"
      ? process.platform
      : (typeof navigator !== "undefined" ? (navigator.platform ?? "") : "").toLowerCase();

  if (platform === "win32" || platform.startsWith("win")) return "windows";
  if (platform === "darwin" || platform.startsWith("mac")) return "macos";
  if (platform === "linux") return "linux";
  return "unknown";
}

function buildInstallHint(platform: OsPlatform): string {
  const url = "https://claude.ai/code";
  switch (platform) {
    case "windows":
      return `Installer Claude Code : winget install Anthropic.Claude  ou  ${url}`;
    case "macos":
      return `Installer Claude Code : brew install claude  ou  ${url}`;
    case "linux":
      return `Installer Claude Code : curl -fsSL ${url}/install.sh | bash  ou  ${url}`;
    default:
      return `Installer Claude Code : ${url}`;
  }
}

// ─── Version parsing ──────────────────────────────────────────────────────────

const VERSION_RE = /(\d+\.\d+(?:\.\d+)*)/;

function parseVersion(raw: string): string | undefined {
  const m = VERSION_RE.exec(raw);
  return m?.[1];
}

// ─── Tauri-side invocation ────────────────────────────────────────────────────

/**
 * In production (Tauri webview), delegates to the Rust command check_claude_cli.
 * In test / non-Tauri environments, falls back to null (no CLI available).
 * Rust side uses tokio::process::Command — NOT a shell, no injection risk.
 */
async function invokeCliCheck(): Promise<{ stdout: string; path: string } | null> {
  try {
    // Dynamic import avoids bundling @tauri-apps/api in test envs.
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ stdout: string; path: string }>("check_claude_cli");
    return result;
  } catch {
    // Not inside a Tauri context (unit tests, SSR…).
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns CliInfo for the current machine.
 * Safe to call at any time; never rejects.
 * Used by: onboarding wizard (FR-003) + settings tab.
 */
export async function healthCheck(): Promise<CliInfo> {
  const platform = detectPlatform();
  const installHint = buildInstallHint(platform);

  try {
    const result = await invokeCliCheck();
    if (result === null) {
      // Non-Tauri environment: treat as not installed.
      return { installed: false, installHint };
    }

    const version = parseVersion(result.stdout);
    const info: CliInfo = { installed: true, path: result.path };
    if (version !== undefined) info.version = version;
    return info;
  } catch {
    return { installed: false, installHint };
  }
}
