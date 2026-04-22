import type { ReactElement } from "react";
import { useState } from "react";
import { Button, toast } from "@fakt/ui";
import { fr } from "@fakt/shared";
import { useOnboarding } from "../context.js";

interface WorkspaceData {
  name: string;
  legalForm: string;
  siret: string;
  address: string;
  email: string;
  iban?: string | null;
  phone?: string | null;
  certPem?: string | null;
}

interface FaktApiGlobals {
  __FAKT_API_URL__?: string;
  __FAKT_API_TOKEN__?: string;
}

function apiGlobals(): FaktApiGlobals {
  if (typeof window === "undefined") return {};
  return window as unknown as FaktApiGlobals;
}

/**
 * Persiste le workspace via le sidecar Hono (POST /api/workspace si absent,
 * PATCH sinon). Mode dev standalone (pas de sidecar injecté) : no-op, pour
 * permettre à l'onboarding de terminer sans crash.
 */
async function persistWorkspace(data: WorkspaceData): Promise<void> {
  const g = apiGlobals();
  if (g.__FAKT_API_URL__ === undefined || g.__FAKT_API_TOKEN__ === undefined) {
    // Dev standalone sans sidecar — on ne bloque pas l'onboarding.
    return;
  }
  const baseUrl = g.__FAKT_API_URL__;
  const token = g.__FAKT_API_TOKEN__;

  const body = JSON.stringify({
    name: data.name,
    legalForm: data.legalForm,
    siret: data.siret,
    address: data.address,
    email: data.email,
    ...(data.iban !== null && data.iban !== undefined ? { iban: data.iban } : {}),
  });

  const headers = {
    "Content-Type": "application/json",
    "X-FAKT-Token": token,
  } as const;

  // Tente PATCH d'abord (workspace existant) ; si 404, bascule en POST (create).
  const patchRes = await fetch(`${baseUrl}/api/workspace`, {
    method: "PATCH",
    headers,
    body,
  }).catch(() => null);

  if (patchRes !== null && patchRes.ok) return;

  const postRes = await fetch(`${baseUrl}/api/workspace`, {
    method: "POST",
    headers,
    body,
  }).catch(() => null);

  if (postRes === null) {
    throw new Error("Impossible de joindre l'API locale FAKT.");
  }
  if (!postRes.ok && postRes.status !== 409) {
    const text = await postRes.text().catch(() => "");
    throw new Error(`Enregistrement workspace échoué : ${postRes.status} ${text}`);
  }
}

async function invokeSetupComplete(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("complete_setup");
  } catch {
    // Hors Tauri (dev web pur) : on ignore, le guard renvoie ready par défaut.
  }
}

interface Props {
  onPrev: () => void;
  onFinish: () => void;
}

export function RecapStep({ onPrev, onFinish }: Props): ReactElement {
  const { state } = useOnboarding();
  const [saving, setSaving] = useState(false);

  const { identity, cliInfo, cliSkipped, certInfo } = state;

  async function handleFinish(): Promise<void> {
    if (identity === null) return;

    setSaving(true);
    try {
      await persistWorkspace({
        name: identity.name,
        legalForm: identity.legalForm,
        siret: identity.siret,
        address: identity.address,
        email: identity.email,
        iban: identity.iban ?? null,
        phone: identity.phone ?? null,
        certPem: certInfo?.certPem ?? null,
      });
      await invokeSetupComplete();
      onFinish();
    } catch (err) {
      const msg = err instanceof Error ? err.message : fr.errors.generic;
      toast.error(msg, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={headingStyle}>{fr.onboarding.step4.title}</h2>
        <p style={descStyle}>{fr.onboarding.step4.description}</p>
      </div>

      <div style={gridStyle}>
        <RecapCard title={fr.onboarding.step4.identity}>
          {identity !== null ? (
            <>
              <RecapRow label={fr.settings.workspace.name} value={identity.name} />
              <RecapRow label={fr.settings.workspace.legalForm} value={identity.legalForm} />
              <RecapRow label={fr.settings.workspace.siret} value={identity.siret} mono />
              <RecapRow label={fr.settings.workspace.email} value={identity.email} />
            </>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: "var(--t-sm)" }}>Non renseigné</span>
          )}
        </RecapCard>

        <RecapCard title={fr.onboarding.step4.cli}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge ok={cliInfo?.installed === true && !cliSkipped} />
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--t-sm)", color: "var(--ink)" }}>
              {cliSkipped
                ? fr.onboarding.step4.cliSkipped
                : cliInfo?.installed === true
                ? fr.onboarding.step4.cliReady
                : fr.onboarding.step4.cliSkipped}
            </span>
          </div>
          {cliInfo?.version !== undefined && !cliSkipped && (
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)", color: "var(--muted)" }}>
              v{cliInfo.version}
            </p>
          )}
        </RecapCard>

        <RecapCard title={fr.onboarding.step4.certificate}>
          {certInfo !== null ? (
            <>
              <StatusBadge ok />
              <span style={{ fontFamily: "var(--font-ui)", fontSize: "var(--t-sm)", color: "var(--ink)", marginLeft: 8 }}>
                {fr.onboarding.step4.certActive}
              </span>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)", color: "var(--muted)", wordBreak: "break-all" }}>
                {certInfo.fingerprint.slice(0, 32)}…
              </p>
            </>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: "var(--t-sm)" }}>Non généré</span>
          )}
        </RecapCard>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onPrev}>
          {fr.onboarding.prev}
        </Button>
        <Button
          size="lg"
          onClick={() => { void handleFinish(); }}
          disabled={saving || identity === null}
        >
          {saving ? "Enregistrement…" : fr.onboarding.finish}
        </Button>
      </div>
    </div>
  );
}

function RecapCard({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <div style={{
      background: "var(--surface)",
      border: "2.5px solid var(--ink)",
      padding: "16px 20px",
      boxShadow: "3px 3px 0 var(--ink)",
    }}>
      <div style={{
        fontFamily: "var(--font-ui)",
        fontWeight: 800,
        fontSize: "var(--t-xs)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--ink)",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1.5px solid var(--line)",
      }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function RecapRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 6 }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
      <span style={{ fontFamily: mono === true ? "var(--font-mono)" : "var(--font-ui)", fontSize: "var(--t-sm)", color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }): ReactElement {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 20,
      height: 20,
      background: ok ? "var(--ink)" : "transparent",
      border: "2px solid var(--ink)",
      color: ok ? "var(--accent)" : "var(--ink)",
      fontWeight: 800,
      fontSize: 11,
      flexShrink: 0,
    }}>
      {ok ? "✓" : "—"}
    </span>
  );
}

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontWeight: 800,
  fontSize: "var(--t-xl)",
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};

const descStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--muted)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 16,
};
