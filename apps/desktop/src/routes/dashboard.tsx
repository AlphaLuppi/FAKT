import type { ReactElement } from "react";
import { fr } from "@fakt/shared";

export function DashboardRoute(): ReactElement {
  return (
    <div style={{ padding: "var(--s-6)", display: "flex", flexDirection: "column", gap: "var(--s-5)" }}>
      <h1
        style={{
          font: "var(--w-black) var(--t-2xl)/1 var(--font-ui)",
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: "var(--ink)",
          margin: 0,
        }}
      >
        {fr.dashboard.title}
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--s-4)",
        }}
      >
        {[
          { label: fr.dashboard.kpi.signedRevenue, value: "0 €" },
          { label: fr.dashboard.kpi.pendingQuotes, value: "0" },
          { label: fr.dashboard.kpi.pendingPayments, value: "0 €" },
          { label: fr.dashboard.kpi.signatureRate, value: "—" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: "var(--surface)",
              border: "2.5px solid var(--ink)",
              padding: "var(--s-4)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--s-2)",
            }}
          >
            <div
              style={{
                fontSize: "var(--t-xs)",
                fontWeight: "var(--w-bold)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                fontFamily: "var(--font-ui)",
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: "var(--t-xl)",
                fontWeight: "var(--w-black)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: "2.5px solid var(--ink)",
          padding: "var(--s-7)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--s-4)",
          background: "var(--surface)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            fontSize: "var(--t-xl)",
            fontWeight: "var(--w-black)",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            fontFamily: "var(--font-ui)",
          }}
        >
          {fr.app.tagline}
        </div>
        <p style={{ color: "var(--muted)", margin: 0, fontFamily: "var(--font-ui)", fontSize: "var(--t-base)" }}>
          {fr.quotes.empty}
        </p>
        <button
          style={{
            background: "var(--accent-soft)",
            color: "var(--ink)",
            border: "2px solid var(--ink)",
            padding: "10px 24px",
            fontWeight: "var(--w-bold)",
            fontSize: "var(--t-base)",
            fontFamily: "var(--font-ui)",
            letterSpacing: "-0.01em",
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {fr.nav.newWithAi}
        </button>
      </div>
    </div>
  );
}
