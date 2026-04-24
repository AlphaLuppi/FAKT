import { fr } from "@fakt/shared";
import type { Workspace } from "@fakt/shared";
import { Toaster } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../../api/index.js";
import { CertificateTab } from "./tabs/CertificateTab.js";
import { ClaudeCliTab } from "./tabs/ClaudeCliTab.js";
import { IdentityTab } from "./tabs/IdentityTab.js";
import { TelemetryTab } from "./tabs/TelemetryTab.js";

type TabId = "identity" | "cli" | "certificate" | "telemetry";

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: "identity", label: fr.settings.tabs.identity },
  { id: "cli", label: fr.settings.tabs.cli },
  { id: "certificate", label: fr.settings.tabs.certificate },
  { id: "telemetry", label: fr.settings.tabs.telemetry },
];

/**
 * Charge le workspace via le sidecar. Retourne null si absent (onboarding
 * pas encore fait) ou si le sidecar n'est pas joignable (mode dev web
 * standalone).
 *
 * Note historique : utilisait auparavant un command Tauri `get_workspace`
 * qui n'existait PAS côté Rust — le workspace était toujours null et
 * l'écran Identity apparaissait vide. Switch vers `api.workspace.get()`.
 */
async function loadWorkspace(): Promise<Workspace | null> {
  try {
    return await api.workspace.get();
  } catch (err) {
    // NOT_FOUND = onboarding pas encore fait, pas une erreur.
    if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
    // NETWORK_ERROR en dev web pur : on retourne null pour ne pas casser l'UI.
    if (err instanceof ApiError && err.code === "NETWORK_ERROR") return null;
    throw err;
  }
}

/**
 * Persiste un flag telemetry via l'API settings.
 * Historique : utilisait `invoke("update_settings")` qui n'existait pas côté
 * Rust — le toggle ne persistait rien.
 */
async function saveTelemetryOpt(enabled: boolean): Promise<void> {
  await api.settings.set("telemetry_enabled", String(enabled));
}

export function SettingsRoute(): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [verboseLogs, setVerboseLogs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((ws) => {
        if (!cancelled) setWorkspace(ws);
      })
      .catch(() => {
        // Silencieux : ErrorBoundary attrape les erreurs fatales, ici on veut
        // que l'écran settings reste utilisable même si le fetch workspace rate.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTelemetryChange(enabled: boolean): Promise<void> {
    await saveTelemetryOpt(enabled);
    setTelemetryEnabled(enabled);
  }

  return (
    <div style={outerStyle}>
      <div style={headerStyle}>
        <h1 style={pageTitleStyle}>{fr.settings.title}</h1>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={tabButtonStyle(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={contentStyle} role="tabpanel">
        {activeTab === "identity" && (
          <IdentityTab workspace={workspace} onSaved={(updated) => setWorkspace(updated)} />
        )}
        {activeTab === "cli" && <ClaudeCliTab />}
        {activeTab === "certificate" && <CertificateTab workspace={workspace} />}
        {activeTab === "telemetry" && (
          <TelemetryTab
            telemetryEnabled={telemetryEnabled}
            verboseLogs={verboseLogs}
            onTelemetryChange={handleTelemetryChange}
            onVerboseChange={setVerboseLogs}
          />
        )}
      </div>

      <Toaster position="bottom-right" />
    </div>
  );
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    fontFamily: "var(--font-ui)",
    fontWeight: active ? 700 : 500,
    fontSize: "var(--t-sm)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--surface)" : "var(--ink)",
    border: "2px solid var(--ink)",
    marginRight: -2,
    cursor: "pointer",
    position: "relative",
    zIndex: active ? 1 : 0,
    boxShadow: active ? "none" : "none",
    transition: "none",
  };
}

const outerStyle: React.CSSProperties = {
  padding: "var(--s-7)",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  maxWidth: 800,
};

const headerStyle: React.CSSProperties = {
  marginBottom: 24,
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontWeight: 800,
  fontSize: "var(--t-2xl)",
  textTransform: "uppercase",
  letterSpacing: "-0.02em",
  color: "var(--ink)",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: "2px solid var(--ink)",
  marginBottom: -2,
};

const contentStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "2.5px solid var(--ink)",
  padding: "28px 32px",
  boxShadow: "5px 5px 0 var(--ink)",
};
