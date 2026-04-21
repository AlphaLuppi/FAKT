import type { ReactElement } from "react";
import { useState } from "react";
import { RadioGroup } from "../src/primitives/Radio.js";

export function RadioExample(): ReactElement {
  const [val, setVal] = useState("devis");
  return (
    <div style={{ padding: 24 }}>
      <RadioGroup
        name="doctype"
        value={val}
        onChange={setVal}
        options={[
          { value: "devis", label: "Devis" },
          { value: "facture", label: "Facture" },
        ]}
      />
    </div>
  );
}
