import type { ReactElement } from "react";
import { Button } from "../src/primitives/Button.js";

export function ButtonExample(): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm">SM</Button>
        <Button size="md">MD</Button>
        <Button size="lg">LG</Button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button disabled>Disabled</Button>
        <Button onClick={() => alert("clicked")}>Cliquer</Button>
      </div>
    </div>
  );
}
