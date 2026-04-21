import type { ReactElement } from "react";
import { Toaster, toast } from "../src/feedback/Toast.js";
import { Button } from "../src/primitives/Button.js";

export function ToastExample(): ReactElement {
  return (
    <div style={{ padding: 24, display: "flex", gap: 8 }}>
      <Button onClick={() => toast("Devis enregistré")}>Default</Button>
      <Button variant="secondary" onClick={() => toast.success("Facture envoyée")}>
        Success
      </Button>
      <Button variant="danger" onClick={() => toast.error("Erreur réseau")}>
        Error
      </Button>
      <Toaster />
    </div>
  );
}
