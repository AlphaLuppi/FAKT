import { tokens } from "@fakt/design-tokens";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { useCallback, useId, useMemo } from "react";
import { classNames } from "../utils/classNames.js";

export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  "data-testid"?: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  /** Préfixe testid auto-appliqué : `${testIdPrefix}-${value}` sur chaque <button role="tab">. */
  testIdPrefix?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  testIdPrefix,
}: TabsProps): ReactElement {
  const baseId = useId();

  const indexByValue = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((i, idx) => map.set(i.value, idx));
    return map;
  }, [items]);

  const focusSibling = useCallback(
    (direction: 1 | -1): void => {
      const currentIdx = indexByValue.get(value) ?? 0;
      const len = items.length;
      let next = currentIdx;
      for (let step = 0; step < len; step += 1) {
        next = (next + direction + len) % len;
        const candidate = items[next];
        if (candidate && !candidate.disabled) {
          onChange(candidate.value);
          const id = `${baseId}-tab-${candidate.value}`;
          const el = document.getElementById(id);
          if (el) el.focus();
          return;
        }
      }
    },
    [items, indexByValue, value, onChange, baseId]
  );

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusSibling(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusSibling(-1);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={classNames("fakt-tabs", className)}
      style={{
        display: "inline-flex",
        gap: 0,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
      }}
    >
      {items.map((item) => {
        const selected = item.value === value;
        const id = `${baseId}-tab-${item.value}`;
        const panelId = `${baseId}-panel-${item.value}`;
        const explicitTestId = item["data-testid"];
        const computedTestId =
          explicitTestId ??
          (testIdPrefix !== undefined ? `${testIdPrefix}-${item.value}` : undefined);
        return (
          <button
            key={item.value}
            id={id}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            data-testid={computedTestId}
            onClick={(): void => {
              if (!item.disabled) onChange(item.value);
            }}
            onKeyDown={onKeyDown}
            className="fakt-tab"
            style={{
              background: selected ? tokens.color.accentSoft : tokens.color.surface,
              color: tokens.color.ink,
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
              border: "none",
              borderRight: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              cursor: item.disabled ? "not-allowed" : "pointer",
              opacity: item.disabled ? 0.45 : 1,
              height: 36,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function getTabPanelId(tabsBaseId: string, value: string): string {
  return `${tabsBaseId}-panel-${value}`;
}
