import type { ChangeEvent, InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { forwardRef, useEffect, useState } from "react";
import { tokens } from "@fakt/design-tokens";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, style, checked, defaultChecked, onChange, disabled, ...rest },
  ref,
): ReactElement {
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = useState<boolean>(
    checked ?? defaultChecked ?? false,
  );

  useEffect(() => {
    if (isControlled) setInternalChecked(checked as boolean);
  }, [isControlled, checked]);

  const visualChecked = isControlled ? (checked as boolean) : internalChecked;

  function handleChange(e: ChangeEvent<HTMLInputElement>): void {
    if (!isControlled) setInternalChecked(e.target.checked);
    onChange?.(e);
  }

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
        cursor: disabled === true ? "not-allowed" : "pointer",
        userSelect: "none",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          flexShrink: 0,
          background: visualChecked ? tokens.color.ink : tokens.color.surface,
          border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
          transition: "background 60ms linear",
        }}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={isControlled ? checked : undefined}
          defaultChecked={isControlled ? undefined : defaultChecked}
          onChange={handleChange}
          disabled={disabled}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            opacity: 0,
            cursor: disabled === true ? "not-allowed" : "pointer",
            ...style,
          }}
          {...rest}
        />
        {visualChecked && (
          <svg
            aria-hidden="true"
            viewBox="0 0 14 14"
            width="12"
            height="12"
            style={{ pointerEvents: "none", display: "block" }}
          >
            <path
              d="M2 7.2l3.2 3.2L12 3.6"
              stroke="#FFFF00"
              strokeWidth="2.4"
              strokeLinecap="square"
              strokeLinejoin="miter"
              fill="none"
            />
          </svg>
        )}
      </span>
      {label !== undefined && <span>{label}</span>}
    </label>
  );
});
