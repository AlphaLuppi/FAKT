import type {
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { tokens } from "@fakt/design-tokens";
import { drawSmoothPath, type Point } from "./smoothing.js";

export interface SignatureCanvasHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
  toPngBytes: () => Promise<Uint8Array>;
}

export interface SignatureCanvasProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onStrokeEnd?: () => void;
}

function decodeDataURL(dataUrl: string): Uint8Array {
  const idx = dataUrl.indexOf(",");
  if (idx < 0) return new Uint8Array();
  const b64 = dataUrl.slice(idx + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  SignatureCanvasProps
>(function SignatureCanvas(
  {
    width = 600,
    height = 200,
    strokeColor,
    strokeWidth = 2.5,
    onStrokeEnd,
  },
  ref,
): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const allStrokesRef = useRef<Point[][]>([]);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);

  const configureCtx = useCallback((): CanvasRenderingContext2D | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor ?? tokens.color.ink;
    ctx.lineWidth = strokeWidth;
    return ctx;
  }, [strokeColor, strokeWidth]);

  useEffect(() => {
    configureCtx();
  }, [configureCtx]);

  const repaint = useCallback((): void => {
    const ctx = configureCtx();
    const c = canvasRef.current;
    if (!ctx || !c) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const stroke of allStrokesRef.current) {
      drawSmoothPath(ctx, stroke);
    }
    if (drawingRef.current) {
      drawSmoothPath(ctx, pointsRef.current);
    }
  }, [configureCtx]);

  useImperativeHandle(
    ref,
    () => ({
      clear: (): void => {
        allStrokesRef.current = [];
        pointsRef.current = [];
        hasInkRef.current = false;
        drawingRef.current = false;
        const c = canvasRef.current;
        const ctx = configureCtx();
        if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
      },
      isEmpty: (): boolean => !hasInkRef.current,
      toDataURL: (): string => {
        const c = canvasRef.current;
        if (!c) return "";
        return c.toDataURL("image/png");
      },
      toPngBytes: async (): Promise<Uint8Array> => {
        const c = canvasRef.current;
        if (!c) return new Uint8Array();
        if (typeof c.toBlob === "function") {
          return new Promise<Uint8Array>((resolve) => {
            c.toBlob(async (blob) => {
              if (!blob) {
                resolve(decodeDataURL(c.toDataURL("image/png")));
                return;
              }
              if (typeof blob.arrayBuffer === "function") {
                const buf = await blob.arrayBuffer();
                resolve(new Uint8Array(buf));
                return;
              }
              resolve(decodeDataURL(c.toDataURL("image/png")));
            }, "image/png");
          });
        }
        return decodeDataURL(c.toDataURL("image/png"));
      },
    }),
    [configureCtx],
  );

  function pointFromEvent(
    e: ReactPointerEvent<HTMLCanvasElement>,
  ): Point {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    pointsRef.current = [pointFromEvent(e)];
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!drawingRef.current) return;
    pointsRef.current.push(pointFromEvent(e));
    hasInkRef.current = true;
    repaint();
  }

  function endStroke(e: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
    if (pointsRef.current.length > 1) {
      allStrokesRef.current.push(pointsRef.current);
    }
    pointsRef.current = [];
    repaint();
    if (onStrokeEnd) onStrokeEnd();
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="signature-canvas"
      aria-label="Zone de signature manuscrite"
      role="img"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      style={{
        background: tokens.color.surface,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        cursor: "crosshair",
        touchAction: "none",
        display: "block",
        width,
        height,
      }}
    />
  );
});
