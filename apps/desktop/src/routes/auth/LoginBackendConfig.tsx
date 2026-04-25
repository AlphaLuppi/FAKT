import { type ReactElement, useEffect, useState } from "react";
import { type ApiMode, getApiClient } from "../../api/client.js";
import { isDesktop, tauriInvoke } from "../../utils/runtime.js";

/**
 * Configuration du backend depuis l'écran de login (desktop uniquement).
 *
 * Affiche un disclosure discret "Configurer le backend" sous le form. Permet
 * de :
 *   - Basculer entre mode "Local" (sidecar Bun spawné par Tauri sur le poste)
 *     et mode "Distant" (api-server self-host AlphaLuppi).
 *   - Personnaliser l'URL en mode distant (utile pour un serveur de test ou
 *     un déploiement custom).
 *
 * En web (mode 2 navigateur), ce composant est invisible — le mode est
 * forcément "remote" et l'URL est bakée au build.
 *
 * Au save, la config est persistée via Tauri command `set_backend_mode`
 * (écriture `app_data_dir/backend.json`) puis l'app **relaunch** pour que
 * `lib.rs` lise la nouvelle config et spawn (ou non) le sidecar.
 *
 * Brutal Invoice strict : bordures 2px, fonts uppercase, accent jaune pour
 * l'action principale, ombre plate au pressed. Compact pour ne pas alourdir
 * la page de login.
 */

interface BackendConfigState {
  mode: ApiMode;
  url: string;
}

type HealthStatus = "unknown" | "ok" | "ko" | "checking";

const DEFAULT_REMOTE_URL = "https://api.fakt.alphaluppi.fr";

export function LoginBackendConfig(): ReactElement | null {
  // Web : pas de toggle possible, le mode est imposé.
  if (!isDesktop()) return null;
  return <LoginBackendConfigDesktop />;
}

function LoginBackendConfigDesktop(): ReactElement {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<BackendConfigState>(() => initialFromClient());
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("unknown");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // À l'ouverture, on récupère la config persistée côté Rust (peut différer du
  // client en mémoire si l'utilisateur a déjà touché Settings dans la session).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const dto = await tauriInvoke<{ mode: string; url: string | null }>("get_backend_mode");
        if (cancelled) return;
        setConfig({
          mode: dto.mode === "local" ? "local" : "remote",
          url: dto.url ?? DEFAULT_REMOTE_URL,
        });
      } catch {
        // Premier launch : pas de fichier backend.json — on garde les defaults
        // dérivés du client en mémoire.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-ping /health quand l'URL change (debounced) — feedback visuel immédiat.
  useEffect(() => {
    if (!open || config.mode !== "remote" || !isValidUrl(config.url)) {
      setHealthStatus("unknown");
      return;
    }
    const timer = setTimeout(() => {
      void checkHealth(config.url, setHealthStatus);
    }, 500);
    return () => clearTimeout(timer);
  }, [open, config.mode, config.url]);

  async function handleApply(): Promise<void> {
    setError(null);
    if (config.mode === "remote" && !isValidUrl(config.url)) {
      setError("URL invalide.");
      return;
    }
    setSaving(true);
    try {
      await tauriInvoke("set_backend_mode", {
        mode: config.mode,
        url: config.mode === "remote" ? config.url : null,
      });
      // Relance l'app pour que lib.rs spawn (ou skip) le sidecar selon la nouvelle config.
      const proc = (await import("@tauri-apps/plugin-process")) as {
        relaunch: () => Promise<void>;
      };
      await proc.relaunch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Échec : ${msg}`);
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="login-backend-toggle"
        style={{
          marginTop: "var(--s-4)",
          padding: "var(--s-2) var(--s-3)",
          background: "transparent",
          border: "none",
          borderTop: "1.5px solid var(--line)",
          width: "100%",
          font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--muted)",
          cursor: "pointer",
        }}
      >
        Configurer le backend ▾
      </button>
    );
  }

  return (
    <div
      data-testid="login-backend-config"
      style={{
        marginTop: "var(--s-4)",
        padding: "var(--s-4)",
        border: "2px solid var(--ink)",
        background: "var(--paper-2)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink)",
          }}
        >
          Backend
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-testid="login-backend-close"
          aria-label="Fermer"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            font: "var(--w-bold) var(--t-sm)/1 var(--font-ui)",
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          ▴
        </button>
      </div>

      <div role="radiogroup" style={{ display: "flex", gap: 0 }}>
        <ModeButton
          label="Local"
          description="Sidecar sur ce poste"
          checked={config.mode === "local"}
          onSelect={() => setConfig({ ...config, mode: "local" })}
          data-testid="login-backend-mode-local"
        />
        <ModeButton
          label="Distant"
          description="Backend self-host"
          checked={config.mode === "remote"}
          onSelect={() => setConfig({ ...config, mode: "remote" })}
          data-testid="login-backend-mode-remote"
        />
      </div>

      {config.mode === "remote" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          <label
            htmlFor="login-backend-url"
            style={{
              font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink)",
            }}
          >
            URL du backend
          </label>
          <input
            id="login-backend-url"
            type="url"
            value={config.url}
            placeholder={DEFAULT_REMOTE_URL}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            data-testid="login-backend-url"
            style={{
              width: "100%",
              padding: "var(--s-2) var(--s-3)",
              border: "2px solid var(--ink)",
              background: "var(--surface)",
              font: "var(--w-med) var(--t-sm) var(--font-mono)",
              color: "var(--ink)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <HealthBadge status={healthStatus} />
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="login-backend-error"
          style={{
            padding: "var(--s-2) var(--s-3)",
            background: "var(--danger-bg)",
            border: "2px solid var(--ink)",
            font: "var(--w-bold) var(--t-xs)/1.4 var(--font-ui)",
            color: "var(--ink)",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleApply()}
        disabled={saving}
        data-testid="login-backend-apply"
        style={{
          padding: "var(--s-3) var(--s-4)",
          border: "2px solid var(--ink)",
          background: saving ? "var(--paper-2)" : "var(--accent-soft)",
          color: "var(--ink)",
          font: "var(--w-black) var(--t-sm)/1 var(--font-ui)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          cursor: saving ? "not-allowed" : "pointer",
          boxShadow: saving ? "none" : "3px 3px 0 var(--ink)",
        }}
      >
        {saving ? "Redémarrage…" : "Appliquer & redémarrer"}
      </button>

      <p
        style={{
          margin: 0,
          font: "var(--w-med) var(--t-xs)/1.4 var(--font-ui)",
          color: "var(--muted)",
        }}
      >
        L'app redémarre pour appliquer le changement.
        {config.mode === "local" && " En mode Local, l'authentification est désactivée."}
      </p>
    </div>
  );
}

function ModeButton({
  label,
  description,
  checked,
  onSelect,
  "data-testid": dataTestId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  "data-testid"?: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      data-testid={dataTestId}
      style={{
        flex: 1,
        padding: "var(--s-2) var(--s-3)",
        border: "2px solid var(--ink)",
        background: checked ? "var(--accent-soft)" : "var(--surface)",
        color: "var(--ink)",
        textAlign: "left",
        marginRight: -2,
        cursor: "pointer",
        boxShadow: checked ? "3px 3px 0 var(--ink)" : "none",
        position: "relative",
        zIndex: checked ? 1 : 0,
      }}
    >
      <div
        style={{
          font: "var(--w-black) var(--t-xs)/1 var(--font-ui)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "var(--w-med) var(--t-xs)/1 var(--font-ui)",
          marginTop: 4,
          color: "var(--muted)",
        }}
      >
        {description}
      </div>
    </button>
  );
}

function HealthBadge({ status }: { status: HealthStatus }): ReactElement | null {
  if (status === "unknown") return null;
  const cfg = healthBadgeConfig(status);
  return (
    <div
      data-testid={`login-backend-health-${status}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        border: "1.5px solid var(--ink)",
        background: cfg.bg,
        font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--ink)",
        alignSelf: "flex-start",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          background: cfg.dot,
          border: "1px solid var(--ink)",
        }}
      />
      {cfg.label}
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
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function initialFromClient(): BackendConfigState {
  const client = getApiClient();
  return {
    mode: client.mode,
    url: client.mode === "remote" ? client.baseUrl : DEFAULT_REMOTE_URL,
  };
}
