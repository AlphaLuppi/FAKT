import type { ReactNode, ReactElement } from "react";
import { useNavigate, useLocation } from "react-router";
import { fr } from "@fakt/shared";
import { CommandPaletteProvider, useCommandPalette } from "../../components/command-palette/CommandPaletteProvider.js";

const NAV_ITEMS = [
  { id: "dashboard", label: fr.nav.dashboard, path: "/" },
  { id: "quotes", label: fr.nav.quotes, path: "/quotes" },
  { id: "invoices", label: fr.nav.invoices, path: "/invoices" },
  { id: "clients", label: fr.nav.clients, path: "/clients" },
  { id: "services", label: fr.nav.services, path: "/services" },
] as const;

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps): ReactElement {
  return (
    <CommandPaletteProvider>
      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "var(--paper)",
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Topbar />
          <main
            style={{
              flex: 1,
              overflow: "auto",
              background: "var(--paper)",
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}

function Sidebar(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside
      style={{
        width: 232,
        background: "var(--surface)",
        borderRight: "2px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "18px 16px 12px",
          borderBottom: "2px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: "var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: "var(--accent-soft)",
              fontWeight: 800,
              fontSize: 13,
              fontFamily: "var(--font-ui)",
              letterSpacing: "-0.02em",
            }}
          >
            F
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "var(--ink)",
              fontFamily: "var(--font-ui)",
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            {fr.app.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-ui)" }}>
            v0.1.0
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 10px 8px" }}>
        <button
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 36,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "var(--font-ui)",
            background: "var(--ink)",
            color: "var(--accent-soft)",
            border: "2px solid var(--ink)",
            cursor: "pointer",
            letterSpacing: "-0.01em",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {fr.nav.newWithAi}
        </button>
      </div>

      <nav style={{ padding: "4px 8px", flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.path);

          return (
            <button
              key={item.id}
              onClick={() => void navigate(item.path)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                color: isActive ? "var(--surface)" : "var(--ink-3)",
                background: isActive ? "var(--ink)" : "transparent",
                border: "none",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                fontFamily: "var(--font-ui)",
                cursor: "pointer",
                marginBottom: 2,
                textAlign: "left",
              }}
            >
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 10, borderTop: "2px solid var(--line)" }}>
        <button
          onClick={() => void navigate("/settings")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            color: "var(--muted)",
            background: "transparent",
            border: "none",
            fontSize: 12,
            fontFamily: "var(--font-ui)",
            cursor: "pointer",
          }}
        >
          {fr.nav.settings}
        </button>
      </div>
    </aside>
  );
}

function Topbar(): ReactElement {
  const location = useLocation();
  const { open } = useCommandPalette();

  const currentNav = NAV_ITEMS.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  );

  const title = currentNav?.label ?? fr.nav.settings;

  return (
    <div
      style={{
        height: 56,
        borderBottom: "2px solid var(--line)",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--ink)",
            fontFamily: "var(--font-ui)",
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      </div>

      {/* Bouton ⌘K */}
      <button
        onClick={open}
        aria-label="Recherche globale"
        title="Recherche globale (⌘K / Ctrl+K)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          border: "2px solid var(--ink)",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span>{fr.search.placeholder}</span>
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            padding: "1px 6px",
            border: "1.5px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
          }}
        >
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
