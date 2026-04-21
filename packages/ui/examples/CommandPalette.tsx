import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { CommandPalette } from "../src/overlays/CommandPalette.js";
import { Button } from "../src/primitives/Button.js";

const ITEMS = [
  { id: "new-quote", label: "Nouveau devis", hint: "⌘N" },
  { id: "new-invoice", label: "Nouvelle facture", hint: "⌘⇧N" },
  { id: "new-client", label: "Nouveau client" },
  { id: "search", label: "Rechercher" },
];

export function CommandPaletteExample(): ReactElement {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => setOpen(true)}>Palette (⌘K)</Button>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        items={ITEMS}
        onSelect={(it) => alert(`Choisi : ${it.label}`)}
      />
    </div>
  );
}
