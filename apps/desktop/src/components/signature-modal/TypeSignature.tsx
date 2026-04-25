import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import { Input } from "@fakt/ui";
import type { ReactElement } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface TypeSignatureHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
  toPngBytes: () => Promise<Uint8Array>;
}

export interface TypeSignatureProps {
  width?: number;
  height?: number;
  onChange?: (name: string) => void;
}

const CURSIVE_STACK = '"Brush Script MT", "Snell Roundhand", "Lucida Handwriting", cursive';

function decodeDataURL(dataUrl: string): Uint8Array {
  const idx = dataUrl.indexOf(",");
  if (idx < 0) return new Uint8Array();
  const b64 = dataUrl.slice(idx + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const TypeSignature = forwardRef<TypeSignatureHandle, TypeSignatureProps>(
  function TypeSignature({ width = 600, height = 200, onChange }, ref): ReactElement {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [name, setName] = useState("");

    const renderToCanvas = useCallback((value: string): void => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = tokens.color.surface;
      ctx.fillRect(0, 0, c.width, c.height);
      if (!value.trim()) return;
      ctx.fillStyle = tokens.color.ink;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const fontSize = Math.min(56, Math.max(28, (c.width * 0.9) / Math.max(value.length, 4)));
      ctx.font = `italic ${fontSize}px ${CURSIVE_STACK}`;
      ctx.fillText(value, c.width / 2, c.height / 2, c.width * 0.92);
    }, []);

    useEffect(() => {
      renderToCanvas(name);
    }, [name, renderToCanvas]);

    useImperativeHandle(
      ref,
      () => ({
        clear: (): void => {
          setName("");
        },
        isEmpty: (): boolean => name.trim() === "",
        toDataURL: (): string => {
          const c = canvasRef.current;
          return c ? c.toDataURL("image/png") : "";
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
      [name]
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}>
        <Input
          label={fr.signature.type}
          placeholder={fr.signature.modal.typePlaceholder}
          value={name}
          data-testid="signature-modal-type-input"
          onChange={(e): void => {
            const v = e.target.value;
            setName(v);
            if (onChange) onChange(v);
          }}
          maxLength={80}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          data-testid="signature-modal-type-canvas"
          aria-label="Aperçu signature cursive"
          role="img"
          style={{
            background: tokens.color.surface,
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            display: "block",
            width,
            height,
          }}
        />
      </div>
    );
  }
);
