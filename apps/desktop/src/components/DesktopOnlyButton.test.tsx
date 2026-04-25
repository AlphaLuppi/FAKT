import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DesktopOnlyButton } from "./DesktopOnlyButton.js";

/**
 * Tests unitaires pour DesktopOnlyButton.
 *
 * isDesktop() détecte la présence de `window.__TAURI_INTERNALS__`. En jsdom
 * (mode test), cette propriété est absente par défaut → comportement web.
 * Pour simuler le mode desktop, on l'injecte manuellement.
 */

describe("<DesktopOnlyButton />", () => {
  describe("en mode web (navigateur)", () => {
    afterEach(() => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = undefined;
    });

    it("rend le bouton désactivé", () => {
      render(<DesktopOnlyButton>Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button", { name: /signer/i });
      expect(btn).toBeDisabled();
    });

    it("ajoute un title tooltip par défaut en français", () => {
      render(<DesktopOnlyButton>Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button");
      expect(btn).toHaveAttribute("title");
      expect(btn.getAttribute("title")).toMatch(/desktop/i);
    });

    it("respecte un title custom via prop desktopOnlyTooltip", () => {
      render(
        <DesktopOnlyButton desktopOnlyTooltip="Action perso uniquement">Signer</DesktopOnlyButton>
      );
      const btn = screen.getByRole("button");
      expect(btn.getAttribute("title")).toBe("Action perso uniquement");
    });

    it("ajoute data-desktop-only=true (pour query CSS / E2E)", () => {
      render(<DesktopOnlyButton>Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button");
      expect(btn.getAttribute("data-desktop-only")).toBe("true");
    });
  });

  describe("en mode desktop (Tauri)", () => {
    beforeEach(() => {
      // Simule l'env Tauri : window.__TAURI_INTERNALS__ présent.
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    });

    afterEach(() => {
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = undefined;
    });

    it("rend le bouton actif (pas de désactivation forcée)", () => {
      render(<DesktopOnlyButton>Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button", { name: /signer/i });
      expect(btn).not.toBeDisabled();
    });

    it("respecte un disabled explicite passé en prop", () => {
      render(<DesktopOnlyButton disabled>Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
    });

    it("ne pose pas de title par défaut (laisse vide ou la prop title)", () => {
      render(<DesktopOnlyButton title="Custom">Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button");
      expect(btn.getAttribute("title")).toBe("Custom");
    });

    it("ne pose pas data-desktop-only", () => {
      render(<DesktopOnlyButton>Signer</DesktopOnlyButton>);
      const btn = screen.getByRole("button");
      expect(btn.getAttribute("data-desktop-only")).toBeNull();
    });
  });
});
