import type { ReactElement, ReactNode } from "react";
import { tokens } from "@fakt/design-tokens";
import { classNames } from "../utils/classNames.js";

export interface TopbarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  className?: string;
}

export function Topbar({ title, subtitle, actions, search, className }: TopbarProps): ReactElement {
  return (
    <div className={classNames("fakt-topbar", className)}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {title !== undefined && (
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontWeight: Number(tokens.fontWeight.black),
              fontSize: tokens.fontSize.lg,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              color: tokens.color.ink,
              lineHeight: 1,
            }}
          >
            {title}
          </div>
        )}
        {subtitle !== undefined && (
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontWeight: Number(tokens.fontWeight.reg),
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {search !== undefined && <div>{search}</div>}
      {actions !== undefined && <div style={{ display: "flex", gap: tokens.spacing[2] }}>{actions}</div>}
    </div>
  );
}
