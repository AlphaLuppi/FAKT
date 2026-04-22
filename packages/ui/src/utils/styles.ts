import { tokens } from "@fakt/design-tokens";
import type { CSSProperties } from "react";

/** Style de base pour un Card Brutal. */
export const cardStyle = (shadow: "sm" | "base" | "lg" = "base"): CSSProperties => ({
  background: tokens.color.surface,
  border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
  boxShadow: tokens.shadow[shadow],
  padding: tokens.spacing[5],
});

/** Style commun pour un bouton brutal. */
export const baseButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: tokens.spacing[2],
  fontFamily: tokens.font.ui,
  fontWeight: Number(tokens.fontWeight.bold),
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
  cursor: "pointer",
  transition:
    "transform 40ms ease-out, box-shadow 40ms ease-out, background 80ms ease-out, color 80ms ease-out",
  userSelect: "none",
};

/** Style commun pour un input brutal. */
export const baseInputStyle: CSSProperties = {
  fontFamily: tokens.font.ui,
  fontWeight: Number(tokens.fontWeight.reg),
  fontSize: tokens.fontSize.base,
  color: tokens.color.ink,
  background: tokens.color.surface,
  border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  outline: "none",
  width: "100%",
  lineHeight: 1.3,
};
