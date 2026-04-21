import type { ReactElement } from "react";
import { Routes, Route } from "react-router";
import { Shell } from "./features/shell/Shell.js";
import { DashboardRoute } from "./routes/dashboard.js";

export function App(): ReactElement {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/quotes" element={<Placeholder title="Devis" />} />
        <Route path="/invoices" element={<Placeholder title="Factures" />} />
        <Route path="/clients" element={<Placeholder title="Clients" />} />
        <Route path="/services" element={<Placeholder title="Prestations" />} />
        <Route path="/settings" element={<Placeholder title="Paramètres" />} />
        <Route path="*" element={<Placeholder title="404 — Page introuvable" />} />
      </Routes>
    </Shell>
  );
}

function Placeholder({ title }: { title: string }): ReactElement {
  return (
    <div
      style={{
        padding: "var(--s-7)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-4)",
      }}
    >
      <h1
        style={{
          font: "var(--w-black) var(--t-2xl)/1 var(--font-ui)",
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: "var(--ink)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--muted)", margin: 0 }}>
        Cette section sera disponible en Wave 1.
      </p>
    </div>
  );
}
