export interface Point {
  x: number;
  y: number;
}

export interface QuadSegment {
  from: Point;
  control: Point;
  to: Point;
}

/**
 * Trace le segment {prev, curr, next} avec un smoothing quadratique
 * en utilisant le milieu entre `prev` et `curr` comme point de contrôle.
 * Approche classique "midpoint quadratic" — 0 dep, stable et rapide.
 */
export function buildQuadSegment(prev: Point, curr: Point): QuadSegment {
  const mid: Point = {
    x: (prev.x + curr.x) / 2,
    y: (prev.y + curr.y) / 2,
  };
  return {
    from: prev,
    control: curr,
    to: mid,
  };
}

/** Lisse une séquence brute de points en QuadSegments ordonnés. */
export function smoothStroke(points: Point[]): QuadSegment[] {
  const segments: QuadSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    segments.push(buildQuadSegment(a, b));
  }
  return segments;
}

/**
 * Trace la séquence entière sur le contexte 2D.
 * Utilise `quadraticCurveTo` pour un rendu manuscrit propre.
 */
export function drawSmoothPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = points[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const pNext = points[i + 1];
    if (!p || !pNext) continue;
    const midX = (p.x + pNext.x) / 2;
    const midY = (p.y + pNext.y) / 2;
    ctx.quadraticCurveTo(p.x, p.y, midX, midY);
  }
  const last = points[points.length - 1];
  if (last) ctx.lineTo(last.x, last.y);
  ctx.stroke();
}
