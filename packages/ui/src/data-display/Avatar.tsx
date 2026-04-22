import { tokens } from "@fakt/design-tokens";
import type { ReactElement } from "react";

export interface AvatarProps {
  name: string;
  size?: number;
  initials?: string;
  bg?: string;
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0] ?? "";
  const second = words[1] ?? "";
  return (
    (first.charAt(0) + (second.charAt(0) ?? "")).toUpperCase() || first.charAt(0).toUpperCase()
  );
}

/** Avatar carré brutal (pas de border-radius). */
export function Avatar({ name, size = 32, initials, bg }: AvatarProps): ReactElement {
  const ini = initials ?? deriveInitials(name);
  const fs = Math.max(10, Math.round(size * 0.42));
  return (
    <span
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        background: bg ?? tokens.color.ink,
        color: bg === undefined ? tokens.color.surface : tokens.color.ink,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: tokens.font.ui,
        fontWeight: Number(tokens.fontWeight.black),
        fontSize: fs,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        textTransform: "uppercase",
      }}
    >
      {ini}
    </span>
  );
}
