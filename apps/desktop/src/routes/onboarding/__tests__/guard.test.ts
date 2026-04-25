import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @tauri-apps/api/core avant l'import du module
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { useOnboardingGuard } from "../guard.js";

// Test unitaire du comportement de checkSetupCompleted (via mock)
describe("useOnboardingGuard — comportement du guard", () => {
  // Le guard branche desktop/web sur isDesktop() = présence de
  // window.__TAURI_INTERNALS__. On simule l'env Tauri pour tester le path
  // desktop (qui invoque is_setup_completed). Le path web (api.workspace.get())
  // est testé séparément si besoin.
  beforeAll(() => {
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  });
  afterAll(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("retourne 'loading' initialement", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { invoke } = await import("@tauri-apps/api/core");

    // Bloquer la résolution pour observer l'état loading
    let resolve!: (v: boolean) => void;
    vi.mocked(invoke).mockReturnValue(
      new Promise<boolean>((r) => {
        resolve = r;
      })
    );

    const { result } = renderHook(() => useOnboardingGuard());
    expect(result.current).toBe("loading");

    // Résoudre pour nettoyer
    resolve(true);
  });

  it("retourne 'ready' quand is_setup_completed = true", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { invoke } = await import("@tauri-apps/api/core");

    vi.mocked(invoke).mockResolvedValue(true);

    const { result } = renderHook(() => useOnboardingGuard());

    // Attendre la mise à jour async
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBe("ready");
  });

  it("retourne 'needs-onboarding' quand is_setup_completed = false", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { invoke } = await import("@tauri-apps/api/core");

    vi.mocked(invoke).mockResolvedValue(false);

    const { result } = renderHook(() => useOnboardingGuard());

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBe("needs-onboarding");
  });

  it("retourne 'ready' si invoke lève une erreur (hors contexte Tauri)", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { invoke } = await import("@tauri-apps/api/core");

    vi.mocked(invoke).mockRejectedValue(new Error("Not in Tauri"));

    const { result } = renderHook(() => useOnboardingGuard());

    await new Promise((r) => setTimeout(r, 50));
    // Hors Tauri : considéré comme ready pour ne pas bloquer le dev
    expect(result.current).toBe("ready");
  });
});
