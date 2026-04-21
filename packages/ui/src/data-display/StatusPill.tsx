import type { ReactElement } from "react";
import { tokens } from "@fakt/design-tokens";

/** Statuts supportés pour devis + facture. */
export type StatusKind =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "refused"
  | "expired"
  | "paid"
  | "overdue"
  | "cancelled";

interface StatusStyle {
  label: string;
  bg: string;
}

const STATUS_STYLES: Record<StatusKind, StatusStyle> = {
  draft: { label: "Brouillon", bg: tokens.color.surface },
  sent: { label: "Envoyé", bg: tokens.color.infoBg },
  viewed: { label: "Vu", bg: tokens.color.warnBg },
  signed: { label: "Signé", bg: tokens.color.successBg },
  refused: { label: "Refusé", bg: tokens.color.dangerBg },
  expired: { label: "Expiré", bg: tokens.color.dangerBg },
  paid: { label: "Payée", bg: tokens.color.successBg },
  overdue: { label: "En retard", bg: tokens.color.dangerBg },
  cancelled: { label: "Annulé", bg: tokens.color.paper2 },
};

export interface StatusPillProps {
  status: StatusKind;
  size?: "sm" | "md";
  label?: string;
}

export function StatusPill({ status, size = "md", label }: StatusPillProps): ReactElement {
  const s = STATUS_STYLES[status];
  const sm = size === "sm";
  return (
    <span
      className="fakt-status"
      style={{
        background: s.bg,
        fontSize: sm ? "10px" : tokens.fontSize.xs,
        height: sm ? 18 : 22,
        padding: sm ? "0 6px" : "0 8px",
      }}
    >
      <span
        className="fakt-status__dot"
        style={{ width: sm ? 5 : 7, height: sm ? 5 : 7 }}
        aria-hidden
      />
      {label ?? s.label}
    </span>
  );
}
