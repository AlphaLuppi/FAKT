import type { ReactElement } from "react";
import { tokens } from "@fakt/design-tokens";
import { classNames } from "../utils/classNames.js";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  current?: boolean;
}

export interface BreadcrumbProps {
  items: ReadonlyArray<BreadcrumbItem>;
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps): ReactElement {
  return (
    <nav aria-label="Fil d'Ariane" className={classNames("fakt-breadcrumb", className)}>
      {items.map((it, i) => (
        <span
          key={`${it.label}-${i}`}
          style={{ display: "inline-flex", alignItems: "center", gap: tokens.spacing[2] }}
        >
          {i > 0 && (
            <span className="fakt-breadcrumb__sep" aria-hidden>
              /
            </span>
          )}
          <button
            type="button"
            className="fakt-breadcrumb__item"
            data-current={it.current === true ? "true" : "false"}
            onClick={() => {
              if (it.current !== true && it.onClick) it.onClick();
            }}
            aria-current={it.current === true ? "page" : undefined}
            disabled={it.current === true}
          >
            {it.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
