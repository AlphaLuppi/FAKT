import { tokens } from "@fakt/design-tokens";
import type {
  CanvasHTMLAttributes,
  ReactElement,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export interface CanvasHandle {
  clear: () => void;
  toDataURL: (type?: string) => string;
  isEmpty: () => boolean;
}

export interface CanvasProps
  extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "width" | "height"> {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onStrokeEnd?: () => void;
}

/** Canvas HTML5 pour signature manuscrite. Export PNG dataURL via ref. */
export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { width = 480, height = 180, strokeColor, strokeWidth = 2.5, onStrokeEnd, style, ...rest },
  ref
): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }, []);

  const setupCtx = useCallback((): void => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor ?? tokens.color.ink;
    ctx.lineWidth = strokeWidth;
  }, [getCtx, strokeColor, strokeWidth]);

  useEffect(() => {
    setupCtx();
  }, [setupCtx]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const ctx = getCtx();
        const c = canvasRef.current;
        if (!ctx || !c) return;
        ctx.clearRect(0, 0, c.width, c.height);
        hasInkRef.current = false;
      },
      toDataURL: (type?: string) => {
        const c = canvasRef.current;
        if (!c) return "";
        return c.toDataURL(type ?? "image/png");
      },
      isEmpty: () => !hasInkRef.current,
    }),
    [getCtx]
  );

  const pointFromEvent = (
    e: ReactMouseEvent<HTMLCanvasElement> | ReactPointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const curr = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    lastPointRef.current = curr;
    hasInkRef.current = true;
  };

  const endStroke = (e: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe: pointer might already be released
    }
    if (onStrokeEnd) onStrokeEnd();
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      style={{
        background: tokens.color.surface,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        cursor: "crosshair",
        touchAction: "none",
        display: "block",
        ...style,
      }}
      {...rest}
    />
  );
});
