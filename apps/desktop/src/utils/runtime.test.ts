import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRuntimeLabel, isDesktop, isWeb } from "./runtime.js";

/**
 * Tests unitaires pour les helpers runtime.
 *
 * isDesktop() = `window.__TAURI_INTERNALS__` truthy. En jsdom on simule.
 * Cleanup avant ET après chaque test pour s'isoler des autres fichiers
 * de tests qui peuvent set la propriété (ex: SignatureModal.test.tsx).
 *
 * Note : `tauriInvoke` n'est pas testé ici — il fait un dynamic import de
 * `@tauri-apps/api/core` qui peut être mocked par d'autres fichiers de tests
 * (vi.mock global). Le comportement est validé indirectement par les tests
 * qui consomment l'API (guard.test.ts en mode desktop, etc.).
 */

describe("utils/runtime", () => {
  beforeEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  describe("isDesktop / isWeb", () => {
    it("retourne web par défaut (window.__TAURI_INTERNALS__ absent)", () => {
      expect(isDesktop()).toBe(false);
      expect(isWeb()).toBe(true);
      expect(getRuntimeLabel()).toBe("web");
    });

    it("retourne desktop quand __TAURI_INTERNALS__ est présent", () => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
      expect(isDesktop()).toBe(true);
      expect(isWeb()).toBe(false);
      expect(getRuntimeLabel()).toBe("desktop");
    });

    it("isDesktop=false si __TAURI_INTERNALS__ est falsy (null, undefined, 0)", () => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = null;
      expect(isDesktop()).toBe(false);
    });

    it("isDesktop=true même si la valeur est un objet vide non-Tauri", () => {
      // Le test n'est pas strict sur le shape du __TAURI_INTERNALS__ — Boolean(value)
      // = true pour tout objet. C'est volontaire : pas de validation runtime
      // de la structure interne Tauri (pas notre rôle).
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {
        not: "real",
      };
      expect(isDesktop()).toBe(true);
    });
  });
});
