import type { ReactElement } from "react";
import { Avatar } from "../src/data-display/Avatar.js";

export function AvatarExample(): ReactElement {
  return (
    <div style={{ padding: 24, display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar name="Tom Andrieu" size={24} />
      <Avatar name="Atelier Mercier" size={32} />
      <Avatar name="Studio Orion" size={48} />
      <Avatar name="Cabinet Levant" size={64} bg="#FFFF00" />
    </div>
  );
}
