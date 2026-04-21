import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";
import { tokens } from "@fakt/design-tokens";
import { classNames } from "../utils/classNames.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, invalid, id, className, ...rest },
  ref,
): ReactElement {
  const inputId = id ?? (typeof label === "string" ? `input-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label
      htmlFor={inputId}
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
      <input
        id={inputId}
        ref={ref}
        className={classNames("fakt-input", invalid === true && "fakt-input--invalid", className)}
        aria-invalid={invalid === true ? true : undefined}
        {...rest}
      />
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

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, invalid, id, className, ...rest },
  ref,
): ReactElement {
  const areaId = id ?? (typeof label === "string" ? `textarea-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label
      htmlFor={areaId}
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
      <textarea
        id={areaId}
        ref={ref}
        className={classNames("fakt-input", invalid === true && "fakt-input--invalid", className)}
        aria-invalid={invalid === true ? true : undefined}
        rows={rest.rows ?? 4}
        style={{ resize: "vertical", minHeight: 96, ...rest.style }}
        {...rest}
      />
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
