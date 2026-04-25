import { Button, Input, toast } from "@fakt/ui";
import { type ReactElement, useEffect, useState } from "react";
import { type ApiMode, getApiClient, resetApiClient } from "../../../api/client.js";
import { useAuth } from "../../../hooks/useAuth.js";
import { isDesktop, tauriInvoke } from "../../../utils/runtime.js";

/**
 * Onglet Settings "Backend" — bascule entre sidecar local (mode 1) et backend
 * distant (mode 2 self-host).
 *
 * Sur le web, le mode est forcé à "remote" (pas de sidecar disponible).
 * Sur le desktop, l'utilisateur peut choisir.
 *
 * Le mode + URL sont persistés via Tauri command `set_backend_mode` qui écrit
 * dans `app_data_dir/backend.json`. Le prochain lancement de l'app prend le
 * nouveau mode (skip spawn sidecar côté Rust si mode=remote).
 *
 * Design Brutal Invoice strict (radio segmenté, bordure 2px, jaune primary
 * pour l'action principale).
 */

interface BackendConfig {
  mode: ApiMode;
  url: string;
}

type HealthStatus = "unknown" | "ok" | "ko" | "checking";

const DEFAULT_REMOTE_URL = "https://fakt.alphaluppi.fr";

export function BackendTab(): ReactElement {
  const { logout, status } = useAuth();
  const [config, setConfig] = useState<BackendConfig>(() => initialConfig());
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("unknown");
  const [saving, setSaving] = useState(false);

  // Auto-test la connexion quand l'URL change (debounced via timeout)
  useEffect(() => {
    if (config.mode !== "remote" || !isValidUrl(config.url)) {
      setHealthStatus("unknown");
      return;
    }
    const timer = setTimeout(() => {
      void checkHealth(config.url, setHealthStatus);
    }, 500);
    return () => clearTimeout(timer);
  }, [config.mode, config.url]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      // Persiste côté Rust si on est sur desktop
      if (isDesktop()) {
        await tauriInvoke("set_backend_mode", {
          mode: config.mode,
          url: config.mode === "remote" ? config.url : null,
        });
      }
      // Reconfigure le client en mémoire immédiatement
      const client = getApiClient();
      client.setMode(config.mode);
      if (config.mode === "remote" && config.url) {
        client.setBaseUrl(config.url);
      }
      resetApiClient();
      toast.success("Backend reconfiguré. Redémarrez l'app pour appliquer complètement.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(`Échec sauvegarde : ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    toast.success("Déconnecté");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={sectionTitleStyle}>Backend</h3>
        <p style={descStyle}>
          Choisissez où FAKT stocke vos données : sur ce poste (mode solo) ou sur un serveur partagé
          (mode équipe self-host).
        </p>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Mode</label>
        <div style={{ display: "flex", gap: 0 }} role="radiogroup">
          <ModeRadioButton
            label="Local (sidecar)"
            description="Données sur ce poste"
            checked={config.mode === "local"}
            disabled={!isDesktop()}
            onSelect={() => setConfig({ ...config, mode: "local" })}
            data-testid="settings-backend-mode-local"
          />
          <ModeRadioButton
            label="Distant (équipe)"
            description="Backend self-host partagé"
            checked={config.mode === "remote"}
            onSelect={() => setConfig({ ...config, mode: "remote" })}
            data-testid="settings-backend-mode-remote"
          />
        </div>
        {!isDesktop() && (
          <p style={hintStyle}>Le mode local est uniquement disponible sur l'app desktop.</p>
        )}
      </div>

      {config.mode === "remote" && (
        <div style={sectionStyle}>
          <label htmlFor="backend-url" style={labelStyle}>
            URL du backend
          </label>
          <Input
            id="backend-url"
            type="url"
            value={config.url}
            placeholder={DEFAULT_REMOTE_URL}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            data-testid="settings-backend-url"
          />
          <HealthBadge status={healthStatus} />
        </div>
      )}

      <div style={dividerStyle} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saving}
          data-testid="settings-backend-submit"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {config.mode === "remote" && status === "authenticated" && (
          <Button
            variant="ghost"
            onClick={() => void handleLogout()}
            data-testid="settings-backend-logout"
          >
            Se déconnecter
          </Button>
        )}
      </div>
    </div>
  );
}

function ModeRadioButton({
  label,
  description,
  checked,
  disabled,
  onSelect,
  "data-testid": dataTestId,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  "data-testid"?: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      disabled={disabled}
      data-testid={dataTestId}
      style={{
        flex: 1,
        padding: "12px 16px",
        border: "2px solid var(--ink)",
        background: checked ? "var(--accent-soft)" : "var(--surface)",
        color: "var(--ink)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        textAlign: "left",
        marginRight: -2,
        boxShadow: checked ? "3px 3px 0 var(--ink)" : "none",
        position: "relative",
        zIndex: checked ? 1 : 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 800,
          fontSize: "var(--t-sm)",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          fontSize: "var(--t-xs)",
          marginTop: 4,
        }}
      >
        {description}
      </div>
    </button>
  );
}

function HealthBadge({ status }: { status: HealthStatus }): ReactElement | null {
  if (status === "unknown") return null;
  const config = healthBadgeConfig(status);
  return (
    <div
      data-testid={`settings-backend-health-${status}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        border: "1.5px solid var(--ink)",
        background: config.bg,
        font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--ink)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          background: config.dot,
          border: "1px solid var(--ink)",
        }}
      />
      {config.label}
    </div>
  );
}

function healthBadgeConfig(status: HealthStatus): { label: string; bg: string; dot: string } {
  switch (status) {
    case "ok":
      return { label: "Connecté", bg: "var(--accent)", dot: "var(--accent)" };
    case "ko":
      return { label: "Inaccessible", bg: "var(--surface)", dot: "#FF3B30" };
    case "checking":
      return { label: "Test en cours…", bg: "var(--surface)", dot: "var(--ink)" };
    default:
      return { label: "Inconnu", bg: "var(--surface)", dot: "var(--surface)" };
  }
}

async function checkHealth(url: string, setStatus: (s: HealthStatus) => void): Promise<void> {
  setStatus("checking");
  try {
    const cleaned = url.replace(/\/+$/, "");
    const response = await fetch(`${cleaned}/health`, { method: "GET" });
    setStatus(response.ok ? "ok" : "ko");
  } catch {
    setStatus("ko");
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function initialConfig(): BackendConfig {
  const client = getApiClient();
  return {
    mode: client.mode,
    url: client.mode === "remote" ? client.baseUrl : DEFAULT_REMOTE_URL,
  };
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontWeight: 800,
  fontSize: "var(--t-lg)",
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontWeight: 700,
  fontSize: "var(--t-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ink)",
};

const descStyle: React.CSSProperties = {
  margin: 0,
  marginTop: 8,
  fontFamily: "var(--font-ui)",
  fontWeight: 500,
  fontSize: "var(--t-sm)",
  color: "var(--ink)",
  lineHeight: 1.5,
  opacity: 0.8,
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-xs)",
  color: "var(--muted)",
  lineHeight: 1.5,
};

const dividerStyle: React.CSSProperties = {
  height: 2,
  background: "var(--line)",
};
