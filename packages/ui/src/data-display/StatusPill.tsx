import { tokens } from "@fakt/design-tokens";
import type { ReactElement } from "react";

/** Statuts supportés pour devis + facture. */
export type StatusKind =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "invoiced"
  | "refused"
  | "expired"
  | "paid"
  | "overdue"
  | "cancelled";

interface StatusStyle {
  label: string;
  bg: string;
  fg: string;
  dot: string;
  borderStyle?: "solid" | "dashed";
}

const STATUS_STYLES: Record<StatusKind, StatusStyle> = {
  draft: {
    label: "Brouillon",
    bg: tokens.color.paper,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  sent: {
    label: "Envoyé",
    bg: tokens.color.accentSoft,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  viewed: {
    label: "Vu",
    bg: tokens.color.infoBg,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  signed: {
    label: "Signé",
    bg: tokens.color.ink,
    fg: tokens.color.accentSoft,
    dot: tokens.color.accentSoft,
  },
  invoiced: {
    label: "Facturé",
    bg: tokens.color.paper2,
    fg: tokens.color.muted,
    dot: tokens.color.muted,
    borderStyle: "dashed",
  },
  refused: {
    label: "Refusé",
    bg: tokens.color.dangerBg,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  expired: {
    label: "Expiré",
    bg: tokens.color.dangerBg,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  paid: {
    label: "Payée",
    bg: tokens.color.successBg,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  overdue: {
    label: "En retard",
    bg: tokens.color.dangerBg,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
  cancelled: {
    label: "Annulé",
    bg: tokens.color.paper2,
    fg: tokens.color.ink,
    dot: tokens.color.ink,
  },
};

export interface StatusPillProps {
  status: StatusKind;
  size?: "sm" | "md";
  label?: string;
  "data-testid"?: string;
}

export function StatusPill({
  status,
  size = "md",
  label,
  "data-testid": testId,
}: StatusPillProps): ReactElement {
  const s = STATUS_STYLES[status];
  const sm = size === "sm";
  return (
    <span
      className="fakt-status"
      data-status={status}
      data-testid={testId}
      style={{
        background: s.bg,
        color: s.fg,
        fontSize: sm ? "10px" : tokens.fontSize.xs,
        height: sm ? 18 : 22,
        padding: sm ? "0 6px" : "0 8px",
        borderStyle: s.borderStyle ?? "solid",
      }}
    >
      <span
        className="fakt-status__dot"
        style={{
          width: sm ? 5 : 7,
          height: sm ? 5 : 7,
          background: s.dot,
        }}
        aria-hidden
      />
      {label ?? s.label}
    </span>
  );
}
