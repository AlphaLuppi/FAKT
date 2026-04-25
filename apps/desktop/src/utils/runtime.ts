/**
 * Helpers de détection runtime : desktop (Tauri) vs web (navigateur).
 *
 * Utilisé pour gracefully dégrader les features desktop-only sur le web :
 *   - signature PAdES (clé privée keychain OS)
 *   - render PDF (Typst CLI local) — fallback endpoint serveur en web
 *   - .eml file pour client mail OS — fallback `mailto:` simple en web
 *   - workspace ZIP — fallback endpoint serveur en web
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function isWeb(): boolean {
  return !isDesktop();
}

export function getRuntimeLabel(): "desktop" | "web" {
  return isDesktop() ? "desktop" : "web";
}

/**
 * Wrapper Tauri invoke avec dynamic import.
 *
 * Permet d'éviter de bundler `@tauri-apps/api` dans le build web (gain ~200 KB)
 * et de throw proprement si invoqué en environnement non-Tauri.
 */
export async function tauriInvoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isDesktop()) {
    throw new Error(`Tauri command "${cmd}" not available on web — desktop app required`);
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
