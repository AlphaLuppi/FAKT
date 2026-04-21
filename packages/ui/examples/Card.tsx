import type { ReactElement } from "react";
import { Card } from "../src/layout/Card.js";

export function CardExample(): ReactElement {
  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
      <Card eyebrow="CA SIGNÉ" title="17 240 €" shadow="sm">
        <div style={{ fontSize: 12 }}>Avril 2026</div>
      </Card>
      <Card eyebrow="EN ATTENTE" title="3" shadow="base">
        <div style={{ fontSize: 12 }}>Devis à signer</div>
      </Card>
      <Card eyebrow="À ENCAISSER" title="8 420 €" shadow="lg">
        <div style={{ fontSize: 12 }}>2 factures en retard</div>
      </Card>
    </div>
  );
}
