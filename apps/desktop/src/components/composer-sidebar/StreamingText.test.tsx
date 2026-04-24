/**
 * Tests StreamingText - typewriter animation.
 *
 * On ne teste pas le timing precis (non deterministe sous jsdom) - on
 * verifie que :
 *   - le composant rend avec un buffer `text` et un flag `streaming`
 *   - il expose les data-attributs utiles pour le debug / style
 *   - il ne crash pas sur `text=""` et ne casse pas quand `streaming` flip
 */

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StreamingText } from "./StreamingText.js";

describe("StreamingText", () => {
  it("rend un noeud avec data-streaming=true", () => {
    render(<StreamingText text="hello" streaming />);
    const node = screen.getByTestId("streaming-text");
    expect(node).toHaveAttribute("data-streaming", "true");
  });

  it("flip data-streaming=false quand streaming=false", () => {
    const { rerender } = render(<StreamingText text="hi" streaming />);
    rerender(<StreamingText text="hi" streaming={false} />);
    expect(screen.getByTestId("streaming-text")).toHaveAttribute("data-streaming", "false");
  });

  it("rend vide au mount (ante animation)", () => {
    render(<StreamingText text="abc" streaming />);
    expect(screen.getByTestId("streaming-text")).toHaveAttribute("data-len", "0");
  });

  it("progresse sur animation frames", async () => {
    // jsdom n'execute pas rAF seul - on stub rAF avec un compteur borne
    // pour eviter toute boucle infinie en cas de regression (le vrai rAF
    // depend des frames du browser, la c'est synchro + limite).
    const originalRAF = globalThis.requestAnimationFrame;
    const originalCAF = globalThis.cancelAnimationFrame;
    let frameCount = 0;
    const MAX_FRAMES = 20;
    let t = 0;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      if (frameCount >= MAX_FRAMES) return 0;
      frameCount += 1;
      t += 100; // 100ms par frame
      queueMicrotask(() => {
        cb(t);
      });
      return frameCount;
    };
    globalThis.cancelAnimationFrame = vi.fn();

    render(<StreamingText text="abcdefghij" streaming cps={100} />);
    await act(async () => {
      // Laisse les ticks borne passer.
      for (let i = 0; i < MAX_FRAMES + 2; i++) {
        await Promise.resolve();
      }
    });
    const len = Number(screen.getByTestId("streaming-text").getAttribute("data-len"));
    expect(len).toBeGreaterThan(0);

    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  it("tolere un reset (text shrink)", () => {
    const { rerender } = render(<StreamingText text="long string" streaming />);
    rerender(<StreamingText text="" streaming={false} />);
    // Ne doit pas crash, data-len coherent.
    const len = Number(screen.getByTestId("streaming-text").getAttribute("data-len"));
    expect(len).toBeGreaterThanOrEqual(0);
  });
});
