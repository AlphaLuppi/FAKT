import { tokens } from "@fakt/design-tokens";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { forwardRef } from "react";
import { classNames } from "../utils/classNames.js";

export type CardShadow = "none" | "sm" | "base" | "lg";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  shadow?: CardShadow;
  padded?: boolean;
  title?: ReactNode;
  eyebrow?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { shadow = "base", padded = true, title, eyebrow, className, children, style, ...rest },
  ref
): ReactElement {
  const shadowClass =
    shadow === "none"
      ? undefined
      : shadow === "sm"
        ? "fakt-card--raised-sm"
        : shadow === "lg"
          ? "fakt-card--raised-lg"
          : "fakt-card--raised";

  return (
    <div
      ref={ref}
      className={classNames("fakt-card", shadowClass, className)}
      style={{
        padding: padded ? tokens.spacing[5] : 0,
        ...style,
      }}
      {...rest}
    >
      {(eyebrow !== undefined || title !== undefined) && (
        <header
          style={{
            marginBottom: tokens.spacing[3],
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[1],
          }}
        >
          {eyebrow !== undefined && (
            <div
              style={{
                fontFamily: tokens.font.ui,
                fontWeight: Number(tokens.fontWeight.bold),
                fontSize: tokens.fontSize.xs,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: tokens.color.muted,
              }}
            >
              {eyebrow}
            </div>
          )}
          {title !== undefined && (
            <div
              style={{
                fontFamily: tokens.font.ui,
                fontWeight: Number(tokens.fontWeight.black),
                fontSize: tokens.fontSize.lg,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: tokens.color.ink,
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
          )}
        </header>
      )}
      {children}
    </div>
  );
});
