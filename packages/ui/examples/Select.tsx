import type { ReactElement } from "react";
import { useState } from "react";
import { Select } from "../src/primitives/Select.js";

export function SelectExample(): ReactElement {
  const [v, setV] = useState("jour");
  return (
    <div style={{ padding: 24, maxWidth: 320 }}>
      <Select
        label="Unité"
        value={v}
        onChange={(e) => setV(e.currentTarget.value)}
        options={[
          { value: "jour", label: "Jour" },
          { value: "heure", label: "Heure" },
          { value: "forfait", label: "Forfait" },
        ]}
      />
    </div>
  );
}
