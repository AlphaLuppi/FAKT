import { describe, expect, it, vi } from "vitest";
import { buildQuadSegment, drawSmoothPath, smoothStroke } from "./smoothing.js";

describe("smoothStroke", () => {
  it("produit N-1 segments pour N points", () => {
    const segs = smoothStroke([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
      { x: 30, y: 15 },
    ]);
    expect(segs).toHaveLength(3);
  });

  it("calcule le milieu comme point de contrôle médian", () => {
    const seg = buildQuadSegment({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(seg.control).toEqual({ x: 10, y: 0 });
    expect(seg.to).toEqual({ x: 5, y: 0 });
  });

  it("retourne un tableau vide pour 0 ou 1 point", () => {
    expect(smoothStroke([])).toEqual([]);
    expect(smoothStroke([{ x: 1, y: 1 }])).toEqual([]);
  });
});

describe("drawSmoothPath", () => {
  function makeCtx(): CanvasRenderingContext2D {
    return {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  it("n'appelle rien pour < 2 points", () => {
    const ctx = makeCtx();
    drawSmoothPath(ctx, []);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("appelle quadraticCurveTo pour chaque pair intermédiaire", () => {
    const ctx = makeCtx();
    drawSmoothPath(ctx, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
      { x: 30, y: 10 },
    ]);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    // 2 courbes intermédiaires + 1 lineTo final
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenCalledWith(30, 10);
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
