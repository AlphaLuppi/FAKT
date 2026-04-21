import type { ReactElement } from "react";
import { useState } from "react";
import { Sidebar } from "../src/layout/Sidebar.js";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "quotes", label: "Devis", badge: 7 },
  { id: "invoices", label: "Factures", badge: 12 },
  { id: "clients", label: "Clients", badge: 6 },
  { id: "services", label: "Prestations" },
];

export function SidebarExample(): ReactElement {
  const [curr, setCurr] = useState("dashboard");
  return (
    <div style={{ display: "flex", minHeight: 400 }}>
      <Sidebar
        brand="FAKT"
        items={NAV}
        currentId={curr}
        onSelect={setCurr}
        footer={<div style={{ fontSize: 11 }}>v0.1.0</div>}
      />
    </div>
  );
}
