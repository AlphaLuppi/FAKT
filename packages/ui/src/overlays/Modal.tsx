import { tokens } from "@fakt/design-tokens";
import type { ReactElement, ReactNode } from "react";
import { Button } from "../primitives/Button.js";
import { Overlay } from "./Overlay.js";

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Testid sur le wrapper backdrop (overlay scrim). */
  "data-testid"?: string;
  /** Testid sur le `<div class="fakt-modal">` (panneau de contenu). */
  testIdContent?: string;
  /** Testid sur le bouton de fermeture (croix). */
  testIdClose?: string;
}

const SIZE_WIDTHS: Record<NonNullable<ModalProps["size"]>, number> = {
  sm: 400,
  md: 560,
  lg: 800,
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
  "data-testid": testId,
  testIdContent,
  testIdClose,
}: ModalProps): ReactElement | null {
  if (!open) return null;
  const titleId =
    typeof title === "string"
      ? `modal-title-${title.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`
      : undefined;
  return (
    <Overlay
      open={open}
      {...(onClose ? { onClose } : {})}
      {...(titleId !== undefined ? { labelledBy: titleId } : {})}
      {...(testId !== undefined ? { "data-testid": testId } : {})}
    >
      <div className="fakt-modal" data-testid={testIdContent} style={{ width: SIZE_WIDTHS[size] }}>
        {title !== undefined && (
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: tokens.spacing[4],
              paddingBottom: tokens.spacing[3],
              borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            }}
          >
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontFamily: tokens.font.ui,
                fontWeight: Number(tokens.fontWeight.black),
                fontSize: tokens.fontSize.xl,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: tokens.color.ink,
              }}
            >
              {title}
            </h2>
            {onClose !== undefined && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Fermer"
                data-testid={testIdClose}
              >
                X
              </Button>
            )}
          </header>
        )}
        <div>{children}</div>
        {footer !== undefined && (
          <footer
            style={{
              marginTop: tokens.spacing[4],
              paddingTop: tokens.spacing[3],
              borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              display: "flex",
              gap: tokens.spacing[2],
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </Overlay>
  );
}
