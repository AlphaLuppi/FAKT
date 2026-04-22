import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { forwardRef } from "react";
import { classNames } from "../utils/classNames.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", iconLeft, iconRight, className, children, type, ...rest },
  ref
): ReactElement {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classNames("fakt-btn", `fakt-btn--${variant}`, `fakt-btn--${size}`, className)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});
