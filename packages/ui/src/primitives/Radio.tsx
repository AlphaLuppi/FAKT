import { tokens } from "@fakt/design-tokens";
import type { InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { forwardRef } from "react";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, style, ...rest },
  ref
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
        type="radio"
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

export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: ReactNode; disabled?: boolean }>;
  direction?: "row" | "column";
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  direction = "column",
}: RadioGroupProps): ReactElement {
  return (
    <div
      role="radiogroup"
      style={{
        display: "flex",
        flexDirection: direction,
        gap: tokens.spacing[3],
      }}
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name}
          value={o.value}
          checked={value === o.value}
          disabled={o.disabled === true}
          onChange={(e) => {
            if (onChange) onChange(e.currentTarget.value);
          }}
          label={o.label}
        />
      ))}
    </div>
  );
}
