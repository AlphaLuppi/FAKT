import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { Button } from "../src/primitives/Button.js";
import { Canvas, type CanvasHandle } from "../src/specialized/Canvas.js";

export function CanvasExample(): ReactElement {
  const ref = useRef<CanvasHandle>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <Canvas ref={ref} width={480} height={180} />
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" onClick={() => ref.current?.clear()}>
          Effacer
        </Button>
        <Button onClick={() => setDataUrl(ref.current?.toDataURL() ?? null)}>Exporter PNG</Button>
      </div>
      {dataUrl !== null && (
        <img alt="Signature" src={dataUrl} style={{ border: "2px solid #000", maxWidth: 240 }} />
      )}
    </div>
  );
}
