import { tokens } from "@fakt/design-tokens";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { useCallback, useId, useMemo } from "react";
import { classNames } from "../utils/classNames.js";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  "data-testid"?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
  /** Si true (défaut), s'étend sur 100% — sinon inline-flex. */
  fullWidth?: boolean;
  /** Préfixe testid auto-appliqué : `${testIdPrefix}-${value}` sur chaque <button>. */
  testIdPrefix?: string;
}

/**
 * Contrôle segmenté style Brutal Invoice : N segments égaux, full-width par
 * défaut, segment actif en jaune accent / inactif en papier. Bordure 2px noir
 * continue autour + séparateurs 2px entre segments. Pas de radius.
 *
 * Accessible : role="tablist", aria-selected + navigation flèches ←/→.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  fullWidth = true,
  testIdPrefix,
}: SegmentedControlProps<T>): ReactElement {
  const baseId = useId();

  const indexByValue = useMemo(() => {
    const map = new Map<T, number>();
    options.forEach((o, idx) => map.set(o.value, idx));
    return map;
  }, [options]);

  const focusSibling = useCallback(
    (direction: 1 | -1): void => {
      const currentIdx = indexByValue.get(value) ?? 0;
      const len = options.length;
      let next = currentIdx;
      for (let step = 0; step < len; step += 1) {
        next = (next + direction + len) % len;
        const candidate = options[next];
        if (candidate && !candidate.disabled) {
          onChange(candidate.value);
          const id = `${baseId}-seg-${candidate.value}`;
          const el = document.getElementById(id);
          if (el) el.focus();
          return;
        }
      }
    },
    [options, indexByValue, value, onChange, baseId]
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
      className={classNames("fakt-segmented", className)}
      style={{
        display: fullWidth ? "grid" : "inline-grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
        width: fullWidth ? "100%" : "auto",
      }}
    >
      {options.map((option, idx) => {
        const selected = option.value === value;
        const id = `${baseId}-seg-${option.value}`;
        const isLast = idx === options.length - 1;
        const explicitTestId = option["data-testid"];
        const computedTestId =
          explicitTestId ??
          (testIdPrefix !== undefined ? `${testIdPrefix}-${option.value}` : undefined);
        return (
          <button
            key={option.value}
            id={id}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            data-testid={computedTestId}
            onClick={(): void => {
              if (!option.disabled) onChange(option.value);
            }}
            onKeyDown={onKeyDown}
            className="fakt-segmented__item"
            data-selected={selected || undefined}
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
              borderRight: isLast ? "none" : `${tokens.stroke.base} solid ${tokens.color.ink}`,
              cursor: option.disabled ? "not-allowed" : "pointer",
              opacity: option.disabled ? 0.45 : 1,
              height: 40,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
