import { tokens } from "@fakt/design-tokens";
import type { CSSProperties, ReactElement, PointerEvent as ReactPointerEvent } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { type Point, drawSmoothPath } from "./smoothing.js";

export interface SignatureCanvasHandle {
  clear: () => void;
  /** Retire le dernier trait (Ctrl+Z) et re-peint. Retourne false si aucun trait. */
  undoLastStroke: () => boolean;
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
  /** Capture Ctrl+Z / Cmd+Z globalement pour undo (défaut true). */
  undoWithKeyboard?: boolean;
  /**
   * Variante visuelle.
   * - "default" : look Brutal Invoice (fond papier, trait noir).
   * - "trackpad-mac" : reproduit le panneau de signature du trackpad
   *   MacBook (fond charcoal, trait blanc épais, placeholder centré).
   *   Activé automatiquement par SignatureModal sur macOS.
   */
  variant?: "default" | "trackpad-mac";
  /** Texte affiché en placeholder centré quand le canvas est vide. */
  placeholder?: string;
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

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas(
    {
      width = 600,
      height = 200,
      strokeColor,
      strokeWidth = 2.5,
      onStrokeEnd,
      undoWithKeyboard = true,
      variant = "default",
      placeholder,
    },
    ref
  ): ReactElement {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const pointsRef = useRef<Point[]>([]);
    const allStrokesRef = useRef<Point[][]>([]);
    const drawingRef = useRef(false);
    const hasInkRef = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    const isMacTrackpad = variant === "trackpad-mac";
    // Couleurs par défaut selon la variante.
    const effectiveStroke = strokeColor ?? (isMacTrackpad ? "#FFFFFF" : tokens.color.ink);
    const effectiveStrokeWidth = strokeWidth ?? (isMacTrackpad ? 4 : 2.5);
    const effectiveBackground = isMacTrackpad ? "#1C1C1E" : tokens.color.surface;
    const effectivePlaceholder = placeholder ?? (isMacTrackpad ? "Clique ici pour commencer" : "");

    const configureCtx = useCallback((): CanvasRenderingContext2D | null => {
      const c = canvasRef.current;
      if (!c) return null;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = effectiveStroke;
      ctx.lineWidth = effectiveStrokeWidth;
      return ctx;
    }, [effectiveStroke, effectiveStrokeWidth]);

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

    const undoLastStrokeImpl = useCallback((): boolean => {
      if (allStrokesRef.current.length === 0) return false;
      allStrokesRef.current = allStrokesRef.current.slice(0, -1);
      if (allStrokesRef.current.length === 0 && pointsRef.current.length === 0) {
        hasInkRef.current = false;
        setIsEmpty(true);
      }
      repaint();
      return true;
    }, [repaint]);

    // Capture globale Ctrl+Z / Cmd+Z — seul le dernier trait est retiré.
    // Attaché sur window pour fonctionner sans focus explicite sur le canvas.
    useEffect(() => {
      if (!undoWithKeyboard) return undefined;
      function onKey(e: KeyboardEvent): void {
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod) return;
        if (e.key.toLowerCase() !== "z") return;
        // On ignore Shift+Ctrl+Z (qui est conventionnellement redo).
        if (e.shiftKey) return;
        const c = canvasRef.current;
        if (!c) return;
        // Ne capture que si le canvas est visible / dans le DOM.
        if (!document.body.contains(c)) return;
        const did = undoLastStrokeImpl();
        if (did) e.preventDefault();
      }
      window.addEventListener("keydown", onKey);
      return (): void => window.removeEventListener("keydown", onKey);
    }, [undoWithKeyboard, undoLastStrokeImpl]);

    useImperativeHandle(
      ref,
      () => ({
        clear: (): void => {
          allStrokesRef.current = [];
          pointsRef.current = [];
          hasInkRef.current = false;
          drawingRef.current = false;
          setIsEmpty(true);
          const c = canvasRef.current;
          const ctx = configureCtx();
          if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
        },
        undoLastStroke: undoLastStrokeImpl,
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
      [configureCtx, undoLastStrokeImpl]
    );

    function pointFromEvent(e: ReactPointerEvent<HTMLCanvasElement>): Point {
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
      if (!hasInkRef.current) {
        hasInkRef.current = true;
        setIsEmpty(false);
      }
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

    const wrapperStyle: CSSProperties = {
      position: "relative",
      width,
      height,
      // En variante mac on enlève la bordure noire pour un look plus proche
      // du panneau natif (charcoal full-bleed). Variante default garde Brutal.
      border: isMacTrackpad
        ? `${tokens.stroke.base} solid #000000`
        : `${tokens.stroke.base} solid ${tokens.color.ink}`,
      background: effectiveBackground,
    };

    const placeholderStyle: CSSProperties = {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      fontFamily: tokens.font.ui,
      fontSize: tokens.fontSize.base,
      color: isMacTrackpad ? "rgba(255, 255, 255, 0.55)" : tokens.color.muted,
      letterSpacing: "0.02em",
      userSelect: "none",
    };

    return (
      <div style={wrapperStyle} data-testid="signature-canvas-wrapper">
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
            background: "transparent",
            cursor: "crosshair",
            touchAction: "none",
            display: "block",
            width,
            height,
          }}
        />
        {isEmpty && effectivePlaceholder && (
          <div style={placeholderStyle} data-testid="signature-canvas-placeholder">
            {effectivePlaceholder}
          </div>
        )}
      </div>
    );
  }
);
