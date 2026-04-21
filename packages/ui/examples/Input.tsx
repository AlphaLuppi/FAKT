import type { ReactElement } from "react";
import { useState } from "react";
import { Input, Textarea } from "../src/primitives/Input.js";

export function InputExample(): ReactElement {
  const [value, setValue] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24, maxWidth: 480 }}>
      <Input
        label="Nom client"
        placeholder="Atelier Mercier"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
      <Input label="SIRET" hint="14 chiffres" placeholder="12345678900019" />
      <Input label="Email" type="email" invalid hint="Adresse invalide" />
      <Textarea label="Notes" placeholder="Précisions de la mission…" rows={5} />
    </div>
  );
}
