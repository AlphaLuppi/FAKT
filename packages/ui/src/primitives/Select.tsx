import { tokens } from "@fakt/design-tokens";
import type { ReactElement, ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { classNames } from "../utils/classNames.js";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, invalid, options, placeholder, id, className, ...rest },
  ref
): ReactElement {
  const selectId =
    id ??
    (typeof label === "string" ? `select-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label
      htmlFor={selectId}
      style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[1] }}
    >
      {label !== undefined && (
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.bold),
            fontSize: tokens.fontSize.xs,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: tokens.color.ink,
          }}
        >
          {label}
        </span>
      )}
      <select
        id={selectId}
        ref={ref}
        className={classNames("fakt-input", invalid === true && "fakt-input--invalid", className)}
        aria-invalid={invalid === true ? true : undefined}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled === true}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint !== undefined && (
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: invalid === true ? tokens.color.ink : tokens.color.muted,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
});
