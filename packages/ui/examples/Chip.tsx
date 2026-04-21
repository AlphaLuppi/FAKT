import type { ReactElement } from "react";
import { Chip } from "../src/data-display/Chip.js";

export function ChipExample(): ReactElement {
  return (
    <div style={{ padding: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Chip>Neutre</Chip>
      <Chip tone="accent">Accent</Chip>
      <Chip tone="warn">Attention</Chip>
      <Chip tone="danger">Danger</Chip>
      <Chip tone="success">Succès</Chip>
      <Chip tone="info">Info</Chip>
    </div>
  );
}
