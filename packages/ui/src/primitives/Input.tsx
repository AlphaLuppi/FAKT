import { tokens } from "@fakt/design-tokens";
import type { InputHTMLAttributes, ReactElement, ReactNode, TextareaHTMLAttributes } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { classNames } from "../utils/classNames.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, invalid, id, className, ...rest },
  ref
): ReactElement {
  const inputId =
    id ??
    (typeof label === "string" ? `input-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
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

export interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Hauteur minimale en pixels (défaut : hauteur d'une ligne). */
  minHeight?: number;
  /** Hauteur max avant scroll interne. */
  maxHeight?: number;
  "data-testid"?: string;
}

/**
 * Textarea single-line par défaut (rows=1) qui grandit automatiquement avec
 * le contenu. Appuyer sur Enter insère un \n et fait grandir la boîte.
 * Style Brutal : border 2px noir, zéro radius.
 *
 * Note : on recalcule scrollHeight à chaque changement de value — coût
 * négligeable pour les textes d'une ligne devis/facture.
 */
export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  function AutoGrowTextarea(
    { className, style, onInput, invalid, minHeight, maxHeight, value, ...rest },
    ref
  ): ReactElement {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = el.scrollHeight;
      el.style.height = `${next}px`;
    }, [value]);

    return (
      <textarea
        ref={innerRef}
        value={value}
        rows={1}
        onInput={(e): void => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
          if (onInput) onInput(e);
        }}
        className={classNames("fakt-input", invalid === true && "fakt-input--invalid", className)}
        aria-invalid={invalid === true ? true : undefined}
        style={{
          resize: "none",
          overflow: maxHeight !== undefined ? "auto" : "hidden",
          minHeight: minHeight ?? "2.25em",
          maxHeight,
          ...style,
        }}
        {...rest}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, invalid, id, className, ...rest },
  ref
): ReactElement {
  const areaId =
    id ??
    (typeof label === "string"
      ? `textarea-${label.replace(/\s+/g, "-").toLowerCase()}`
      : undefined);
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
