import type { ReactElement } from "react";
import { StatusPill } from "../src/data-display/StatusPill.js";

export function StatusPillExample(): ReactElement {
  return (
    <div style={{ padding: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
      <StatusPill status="draft" />
      <StatusPill status="sent" />
      <StatusPill status="viewed" />
      <StatusPill status="signed" />
      <StatusPill status="refused" />
      <StatusPill status="paid" />
      <StatusPill status="overdue" />
      <StatusPill status="cancelled" size="sm" />
    </div>
  );
}
