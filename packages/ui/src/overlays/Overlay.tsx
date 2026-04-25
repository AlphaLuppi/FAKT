import type { MouseEvent, ReactElement, ReactNode } from "react";
import { useEffect } from "react";
import { classNames } from "../utils/classNames.js";

export interface OverlayProps {
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  labelledBy?: string;
  "data-testid"?: string;
}

/** Scrim/backdrop brutal. Seule exception transparence dans le design system. */
export function Overlay({
  open,
  onClose,
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  labelledBy,
  "data-testid": testId,
}: OverlayProps): ReactElement | null {
  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const onBackdrop = (e: MouseEvent<HTMLDivElement>): void => {
    if (closeOnBackdropClick && e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className={classNames("fakt-overlay", className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      data-testid={testId}
      onClick={onBackdrop}
    >
      {children}
    </div>
  );
}
