import type { ReactElement } from "react";
import { useState } from "react";
import { Button, toast } from "@fakt/ui";
import { fr, type LegalForm } from "@fakt/shared";
import { useOnboarding } from "../context.js";
import { api, ApiError } from "../../../api/index.js";

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

const LEGAL_FORMS: readonly LegalForm[] = [
  "Micro-entreprise",
  "EURL",
  "SASU",
  "SAS",
  "SARL",
  "SA",
  "Autre",
];

function asLegalForm(v: string): LegalForm {
  return (LEGAL_FORMS as readonly string[]).includes(v) ? (v as LegalForm) : "Autre";
}

/**
 * Persiste le workspace via le sidecar Bun+Hono (PATCH si existant, POST
 * sinon — capture l'erreur NOT_FOUND pour basculer en création).
 * En dev web standalone sans sidecar injecté, l'ApiError NETWORK_ERROR est
 * remontée pour que l'utilisateur voie le problème.
 */
async function persistWorkspace(data: WorkspaceData): Promise<void> {
  const payload = {
    name: data.name,
    legalForm: asLegalForm(data.legalForm),
    siret: data.siret,
    address: data.address,
    email: data.email,
    iban: data.iban ?? null,
  };

  try {
    await api.workspace.update(payload);
    return;
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "NOT_FOUND") {
      throw err;
    }
  }

  try {
    await api.workspace.create(payload);
  } catch (err) {
    if (err instanceof ApiError && err.code === "CONFLICT") {
      // Race : un autre onglet a créé entre-temps — on retente un update.
      await api.workspace.update(payload);
      return;
    }
    throw err;
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
