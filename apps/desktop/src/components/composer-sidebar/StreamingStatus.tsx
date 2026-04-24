/**
 * StreamingStatus — bandeau discret affiché sous le message assistant
 * pendant qu'il streame. Style Brutal Invoice.
 *
 * Spinner ASCII braille (10 frames) à gauche, libellé UPPERCASE à droite.
 * Quand la CLI n'émet pas les events thinking/tool, ce composant rend
 * au moins visible le fait que l'IA travaille.
 */

import { tokens } from "@fakt/design-tokens";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

interface StreamingStatusProps {
  /** Libellé affiché à droite du spinner (UPPERCASE rendered). */
  label?: string;
}

export function StreamingStatus({ label = "L'IA RÉFLÉCHIT" }: StreamingStatusProps): ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const { color, font, fontSize, spacing, stroke } = tokens;

  return (
    <div
      data-testid="streaming-status"
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        marginTop: spacing[2],
        padding: `${spacing[1]} ${spacing[3]}`,
        border: `${stroke.hair} solid ${color.ink}`,
        background: color.surface,
        fontFamily: font.ui,
        fontSize: fontSize.xs,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: color.ink,
        width: "fit-content",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: font.mono,
          fontSize: fontSize.sm,
          color: color.ink,
          display: "inline-block",
          minWidth: 14,
          textAlign: "center",
        }}
      >
        {SPINNER_FRAMES[frame]}
      </span>
      <span>{label}…</span>
    </div>
  );
}
