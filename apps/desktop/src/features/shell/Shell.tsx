import { fr } from "@fakt/shared";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "../../components/command-palette/CommandPaletteProvider.js";
import {
  ComposerSidebarProvider,
  useComposerSidebar,
} from "../../components/composer-sidebar/ComposerContext.js";
import { ComposerSidebar } from "../../components/composer-sidebar/ComposerSidebar.js";
import { ShortcutsOverlay } from "../../components/shortcuts-overlay/ShortcutsOverlay.js";
import { buildShortcuts, matchesShortcut } from "../../shortcuts.js";
import { UpdateBanner, UpdaterProvider } from "../updater/index.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";

const NAV_ITEMS = [
  { id: "dashboard", label: fr.nav.dashboard, path: "/" },
  { id: "quotes", label: fr.nav.quotes, path: "/quotes" },
  { id: "invoices", label: fr.nav.invoices, path: "/invoices" },
  { id: "clients", label: fr.nav.clients, path: "/clients" },
  { id: "services", label: fr.nav.services, path: "/services" },
  { id: "archive", label: fr.nav.archive, path: "/archive" },
] as const;

// BottomNav mobile : on garde 5 items max (les 5 premiers de NAV_ITEMS).
// Le 6e (archive) reste accessible via la palette de commandes ⌘K.
const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps): ReactElement {
  return (
    <UpdaterProvider>
      <CommandPaletteProvider>
        <ComposerSidebarProvider>
          <ShellInner>{children}</ShellInner>
        </ComposerSidebarProvider>
      </CommandPaletteProvider>
    </UpdaterProvider>
  );
}

function ShellInner({ children }: ShellProps): ReactElement {
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();
  const { open: openPalette } = useCommandPalette();
  const { toggle: toggleComposer } = useComposerSidebar();

  useEffect(() => {
    const shortcuts = buildShortcuts({
      onNewQuote: () => void navigate("/quotes/new?mode=manual"),
      onNewInvoice: () => void navigate("/invoices/new"),
      onToggleComposer: toggleComposer,
      onShowHelp: () => setShowHelp((v) => !v),
    });

    const handler = (e: KeyboardEvent): void => {
      // ⌘K is handled by CommandPaletteProvider
      if ((e.metaKey || e.ctrlKey) && e.key === "k") return;

      for (const shortcut of shortcuts) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate, openPalette, toggleComposer]);

  return (
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
        <UpdateBanner />
        <Topbar />
        <main
          className="fakt-shell-main"
          data-testid="shell-main"
          style={{
            flex: 1,
            overflow: "auto",
            background: "var(--paper)",
          }}
        >
          {children}
        </main>
      </div>
      <ComposerSidebar />
      <BottomNav />
      {showHelp && <ShortcutsOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function Sidebar(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside
      className="fakt-shell-sidebar"
      data-testid="sidebar"
      style={{
        width: 232,
        background: "var(--surface)",
        borderRight: "2px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "18px 10px 8px" }}>
        <button
          type="button"
          onClick={() => void navigate("/quotes/new?mode=ai")}
          data-testid="sidebar-new-with-ai"
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
            item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);

          return (
            <button
              key={item.id}
              onClick={() => void navigate(item.path)}
              data-testid={`sidebar-link-${item.id}`}
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
          data-testid="sidebar-link-settings"
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

/**
 * Bottom navigation pour mobile (mode 2 web AlphaLuppi).
 * Affichée seulement à @media (max-width: 768px) via responsive.css.
 * Reprend les 5 premiers items de NAV_ITEMS (archive accessible via ⌘K).
 */
function BottomNav(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav className="fakt-bottom-nav" aria-label="Navigation mobile" data-testid="bottom-nav">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive =
          item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);

        return (
          <button
            key={item.id}
            onClick={() => void navigate(item.path)}
            data-testid={`nav-bottom-${item.id}`}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 4px",
              color: isActive ? "var(--surface)" : "var(--ink-3)",
              background: isActive ? "var(--ink)" : "transparent",
              border: "none",
              fontWeight: isActive ? 800 : 600,
              fontSize: 11,
              fontFamily: "var(--font-ui)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function Topbar(): ReactElement {
  const location = useLocation();
  const { open } = useCommandPalette();
  const { toggle: toggleComposer, isOpen: composerOpen } = useComposerSidebar();

  const currentNav = NAV_ITEMS.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  );

  const title = currentNav?.label ?? fr.nav.settings;

  return (
    <div
      className="fakt-shell-topbar"
      data-testid="topbar"
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
          className="fakt-shell-title"
          data-testid="topbar-title"
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

      {/* Workspace switcher (caché en MVP avec 1 workspace, futur multi-workspace) */}
      <WorkspaceSwitcher />

      {/* Bouton Composer IA */}
      <button
        onClick={toggleComposer}
        data-testid="topbar-composer-toggle"
        aria-label="Composer IA (Ctrl+/)"
        title="Composer IA (Ctrl+/)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          border: "2px solid var(--ink)",
          background: composerOpen ? "var(--ink)" : "transparent",
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          fontWeight: 700,
          color: composerOpen ? "var(--accent-soft)" : "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span className="fakt-topbar-button-text">{fr.composer.title}</span>
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
          ⌘/
        </kbd>
      </button>

      {/* Bouton ⌘K */}
      <button
        onClick={open}
        data-testid="topbar-search-trigger"
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
        <span className="fakt-topbar-button-text">{fr.search.placeholder}</span>
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
