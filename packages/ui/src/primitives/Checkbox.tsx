import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { forwardRef } from "react";
import { tokens } from "@fakt/design-tokens";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, style, ...rest },
  ref,
): ReactElement {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacing[2],
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.sm,
        fontWeight: Number(tokens.fontWeight.reg),
        color: tokens.color.ink,
        cursor: rest.disabled === true ? "not-allowed" : "pointer",
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        ref={ref}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          width: 18,
          height: 18,
          margin: 0,
          background: tokens.color.surface,
          border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: rest.disabled === true ? "not-allowed" : "pointer",
          position: "relative",
          ...style,
        }}
        {...rest}
      />
      {label !== undefined && <span>{label}</span>}
    </label>
  );
});
