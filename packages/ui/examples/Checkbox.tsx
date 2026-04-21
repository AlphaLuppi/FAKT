import type { ReactElement } from "react";
import { useState } from "react";
import { Checkbox } from "../src/primitives/Checkbox.js";

export function CheckboxExample(): ReactElement {
  const [checked, setChecked] = useState(false);
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <Checkbox
        checked={checked}
        onChange={(e) => setChecked(e.currentTarget.checked)}
        label="TVA non applicable, art. 293 B du CGI"
      />
      <Checkbox disabled label="Désactivé" />
    </div>
  );
}
