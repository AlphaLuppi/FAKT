import { tokens } from "@fakt/design-tokens";
import type { ReactElement, ReactNode } from "react";
import { classNames } from "../utils/classNames.js";

export interface SidebarItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  "data-testid"?: string;
}

export interface SidebarProps {
  brand?: ReactNode;
  items: ReadonlyArray<SidebarItem>;
  currentId?: string;
  onSelect?: (id: string) => void;
  footer?: ReactNode;
  className?: string;
  /** Préfixe testid auto-appliqué : `${testIdPrefix}-${id}` sur chaque item nav. */
  testIdPrefix?: string;
  "data-testid"?: string;
}

export function Sidebar({
  brand,
  items,
  currentId,
  onSelect,
  footer,
  className,
  testIdPrefix,
  "data-testid": testId,
}: SidebarProps): ReactElement {
  return (
    <aside className={classNames("fakt-sidebar", className)} data-testid={testId}>
      {brand !== undefined && (
        <div
          style={{
            padding: `${tokens.spacing[5]} ${tokens.spacing[4]}`,
            borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.black),
            fontSize: tokens.fontSize.lg,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            color: tokens.color.ink,
          }}
        >
          {brand}
        </div>
      )}
      <nav
        style={{
          padding: tokens.spacing[2],
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[1],
        }}
      >
        {items.map((it) => {
          const explicitTestId = it["data-testid"];
          const computedTestId =
            explicitTestId ?? (testIdPrefix !== undefined ? `${testIdPrefix}-${it.id}` : undefined);
          return (
            <button
              key={it.id}
              type="button"
              className="fakt-sidebar__item"
              data-active={currentId === it.id ? "true" : "false"}
              data-testid={computedTestId}
              onClick={() => onSelect?.(it.id)}
            >
              {it.icon}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge !== undefined && (
                <span
                  style={{
                    fontFamily: tokens.font.mono,
                    fontSize: tokens.fontSize.xs,
                    padding: "1px 6px",
                    border: `${tokens.stroke.hair} solid currentColor`,
                  }}
                >
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {footer !== undefined && (
        <div
          style={{
            padding: tokens.spacing[3],
            borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
