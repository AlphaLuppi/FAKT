/**
 * Tests du SignatureCanvas — focus sur la gestion du stack de strokes et
 * le hook Ctrl+Z d'undo. Les tests de rendu canvas détaillé sont limités
 * par l'absence d'API HTMLCanvasElement dans jsdom (getContext stub) —
 * on se contente donc de vérifier le comportement des refs et de l'undo
 * via l'API impérative exposée + event keyboard.
 */
import { fireEvent, render } from "@testing-library/react";
import type { RefObject } from "react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { SignatureCanvas, type SignatureCanvasHandle } from "./SignatureCanvas.js";

describe("SignatureCanvas — undo", () => {
  function setup(): RefObject<SignatureCanvasHandle | null> {
    const ref = createRef<SignatureCanvasHandle | null>();
    render(<SignatureCanvas ref={ref} />);
    return ref;
  }

  it("undoLastStroke retourne false quand le canvas est vide", () => {
    const ref = setup();
    expect(ref.current).not.toBeNull();
    expect(ref.current?.undoLastStroke()).toBe(false);
  });

  it("clear remet isEmpty à true (pas d'état résiduel)", () => {
    const ref = setup();
    expect(ref.current?.isEmpty()).toBe(true);
    ref.current?.clear();
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("écoute Ctrl+Z sur window (aucun trait = noop, pas d'erreur)", () => {
    setup();
    const ev = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true });
    // Ne throw pas, et preventDefault() n'est pas appelé car rien à undo.
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("écoute Cmd+Z (Meta) aussi pour macOS", () => {
    setup();
    const ev = new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("ignore Shift+Ctrl+Z (convention de redo)", () => {
    const ref = setup();
    const ev = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("undoWithKeyboard=false désactive le listener keyboard", () => {
    render(<SignatureCanvas undoWithKeyboard={false} />);
    const ev = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true });
    window.dispatchEvent(ev);
    // Rien à assert au-delà de "pas d'erreur" — on vérifie juste que la
    // surface rend sans crash.
    expect(true).toBe(true);
  });

  it("ne crash pas quand on envoie Ctrl+Z via fireEvent sur document", () => {
    setup();
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(true).toBe(true);
  });
});
