import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { tokens } from "@fakt/design-tokens";
import { classNames } from "../utils/classNames.js";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "warn" | "danger" | "success" | "info" | "accent";
  children: ReactNode;
}

const BG_FOR_TONE: Record<NonNullable<ChipProps["tone"]>, string> = {
  neutral: tokens.color.surface,
  warn: tokens.color.warnBg,
  danger: tokens.color.dangerBg,
  success: tokens.color.successBg,
  info: tokens.color.infoBg,
  accent: tokens.color.accentSoft,
};

export function Chip({ tone = "neutral", className, style, children, ...rest }: ChipProps): ReactElement {
  return (
    <span
      className={classNames("fakt-chip", className)}
      style={{ background: BG_FOR_TONE[tone], ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}
