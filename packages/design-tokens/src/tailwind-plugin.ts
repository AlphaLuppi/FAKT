import { tokens } from "./tokens.js";

/**
 * Plugin Tailwind v4 — injecte les tokens Brutal Invoice.
 * Compatible Tailwind v4 (addBase API).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function brutalInvoicePlugin({ addBase }: { addBase: (base: Record<string, unknown>) => void }): void {
  addBase({
    ":root": {
      "--ink": tokens.color.ink,
      "--ink-2": tokens.color.ink2,
      "--ink-3": tokens.color.ink3,
      "--muted": tokens.color.muted,
      "--muted-2": tokens.color.muted2,
      "--paper": tokens.color.paper,
      "--paper-2": tokens.color.paper2,
      "--surface": tokens.color.surface,
      "--line": tokens.color.line,
      "--line-2": tokens.color.line2,
      "--accent": tokens.color.accent,
      "--accent-soft": tokens.color.accentSoft,
      "--accent-subtle": tokens.color.accentSubtle,
      "--success-bg": tokens.color.successBg,
      "--warn-bg": tokens.color.warnBg,
      "--danger-bg": tokens.color.dangerBg,
      "--info-bg": tokens.color.infoBg,
      "--shadow-sm": tokens.shadow.sm,
      "--shadow": tokens.shadow.base,
      "--shadow-lg": tokens.shadow.lg,
      "--shadow-xl": tokens.shadow.xl,
      "--font-ui": tokens.font.ui,
      "--font-mono": tokens.font.mono,
      "--r-sm": tokens.radius.sm,
      "--r": tokens.radius.base,
      "--r-lg": tokens.radius.lg,
      "--r-xl": tokens.radius.xl,
    },
  });
}

/** Config extend Tailwind pour utiliser les tokens Brutal Invoice. */
export const brutalExtend = {
  colors: {
    ink: "var(--ink)",
    "ink-2": "var(--ink-2)",
    "ink-3": "var(--ink-3)",
    muted: "var(--muted)",
    "muted-2": "var(--muted-2)",
    paper: "var(--paper)",
    "paper-2": "var(--paper-2)",
    surface: "var(--surface)",
    accent: "var(--accent)",
    "accent-soft": "var(--accent-soft)",
    "accent-subtle": "var(--accent-subtle)",
    "success-bg": "var(--success-bg)",
    "warn-bg": "var(--warn-bg)",
    "danger-bg": "var(--danger-bg)",
    "info-bg": "var(--info-bg)",
  },
  fontFamily: {
    ui: "var(--font-ui)",
    mono: "var(--font-mono)",
  },
  boxShadow: {
    brutal: "var(--shadow)",
    "brutal-sm": "var(--shadow-sm)",
    "brutal-lg": "var(--shadow-lg)",
    "brutal-xl": "var(--shadow-xl)",
  },
  borderRadius: {
    none: "0px",
    sm: "0px",
    DEFAULT: "0px",
    md: "0px",
    lg: "0px",
    xl: "0px",
    "2xl": "0px",
    "3xl": "0px",
    full: "0px",
  },
} as const;
