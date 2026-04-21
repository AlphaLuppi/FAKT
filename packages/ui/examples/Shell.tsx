import type { ReactElement } from "react";
import { useState } from "react";
import { Shell } from "../src/layout/Shell.js";
import { Sidebar } from "../src/layout/Sidebar.js";
import { Topbar } from "../src/layout/Topbar.js";
import { Button } from "../src/primitives/Button.js";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "quotes", label: "Devis" },
  { id: "invoices", label: "Factures" },
];

export function ShellExample(): ReactElement {
  const [curr, setCurr] = useState("dashboard");
  return (
    <Shell
      sidebar={<Sidebar brand="FAKT" items={NAV} currentId={curr} onSelect={setCurr} />}
      topbar={
        <Topbar
          title="Dashboard"
          subtitle="3 devis à signer · 2 factures en retard"
          actions={<Button>Nouveau document</Button>}
        />
      }
    >
      <div style={{ padding: 24 }}>Contenu principal</div>
    </Shell>
  );
}
