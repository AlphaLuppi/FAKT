/** Tokens Brutal Invoice — objet TS typé (source de vérité synchronisée avec tokens.css). */

export const tokens = {
  color: {
    ink: "#000000",
    ink2: "#000000",
    ink3: "#222222",
    muted: "#666666",
    muted2: "#999999",
    paper: "#F5F5F0",
    paper2: "#EDEDE5",
    surface: "#FFFFFF",
    line: "#000000",
    line2: "#000000",
    accent: "#000000",
    accentSoft: "#FFFF00",
    accentSubtle: "#FAFAFA",
    successBg: "#B9F5B0",
    warnBg: "#FFFF00",
    dangerBg: "#FF6B6B",
    infoBg: "#CCE5FF",
  },

  stroke: {
    hair: "1.5px",
    base: "2px",
    bold: "2.5px",
    thick: "3px",
  },

  /** Tous les radii sont 0 — règle absolue Brutal Invoice. */
  radius: {
    sm: "0px",
    base: "0px",
    lg: "0px",
    xl: "0px",
  },

  shadow: {
    sm: "3px 3px 0 #000",
    base: "5px 5px 0 #000",
    lg: "8px 8px 0 #000",
    xl: "12px 12px 0 #000",
  },

  font: {
    ui: '"Space Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
  },

  fontSize: {
    xs: "11px",
    sm: "12.5px",
    base: "14px",
    md: "16px",
    lg: "20px",
    xl: "28px",
    "2xl": "40px",
    display: "64px",
  },

  fontWeight: {
    reg: "500",
    med: "600",
    bold: "700",
    black: "800",
  },

  spacing: {
    0: "0",
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "24px",
    6: "32px",
    7: "48px",
    8: "64px",
  },
} as const;

export type Tokens = typeof tokens;

/** Helpers hover/press conformes Brutal Invoice. */
export const interactions = {
  hover: {
    background: tokens.color.ink,
    color: tokens.color.accentSoft,
  },
  /** transform + suppression ombre au clic. */
  press: {
    transform: "translate(3px, 3px)",
    boxShadow: "none",
  },
} as const;
