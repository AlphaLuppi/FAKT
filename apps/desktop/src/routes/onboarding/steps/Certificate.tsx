import { fr } from "@fakt/shared";
import { Button, toast } from "@fakt/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { useOnboarding } from "../context.js";
import type { CertInfo } from "../context.js";

interface SubjectDn {
  common_name: string;
  organization: string;
  country: string;
  email: string;
}

/// Miroir de `crypto::cert::CertInfo` côté Rust (serde rename_all camelCase).
interface RustCertInfo {
  subjectCn: string;
  notBeforeIso: string;
  notAfterIso: string;
  serialHex: string;
  fingerprintSha256Hex: string;
}

interface CertGenerationResult {
  info: RustCertInfo;
  cert_pem: string;
  storage: { kind: "keychain" } | { kind: "fallback-file"; path: string };
}

async function invokeCertGenerate(subjectDn: SubjectDn): Promise<CertGenerationResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CertGenerationResult>("generate_cert", {
    subjectDn,
    fallbackPassword: null,
  });
}

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export function CertificateStep({ onNext, onPrev }: Props): ReactElement {
  const { state, setCertInfo } = useOnboarding();
  const [generating, setGenerating] = useState(false);
  const [certInfo, setLocalCertInfo] = useState<CertInfo | null>(state.certInfo);

  const identity = state.identity;

  async function handleGenerate(): Promise<void> {
    if (identity === null) return;

    setGenerating(true);
    try {
      const subjectDn: SubjectDn = {
        common_name: identity.name,
        organization: identity.name,
        country: "FR",
        email: identity.email,
      };
      const result = await invokeCertGenerate(subjectDn);
      const cert: CertInfo = {
        dn: result.info.subjectCn,
        fingerprint: result.info.fingerprintSha256Hex,
        notBefore: result.info.notBeforeIso,
        notAfter: result.info.notAfterIso,
        certPem: result.cert_pem,
        storage: result.storage.kind === "keychain" ? "keychain" : "fallback-file",
      };
      setLocalCertInfo(cert);
      setCertInfo(cert);
    } catch (err) {
      const msg = err instanceof Error ? err.message : fr.errors.keychainError;
      toast.error(msg, { duration: 6000 });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={headingStyle}>{fr.onboarding.step3.title}</h2>
        <p style={descStyle}>{fr.onboarding.step3.description}</p>
      </div>

      {certInfo === null ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <Button
              size="lg"
              onClick={() => {
                void handleGenerate();
              }}
              disabled={generating || identity === null}
            >
              {generating ? fr.onboarding.step3.generating : fr.onboarding.step3.generate}
            </Button>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={statusRowStyle}>
            <span style={checkmarkStyle}>✓</span>
            <span style={statusTextStyle}>{fr.onboarding.step3.generated}</span>
          </div>
          <div style={metaStyle}>
            <MetaRow label={fr.onboarding.step3.dn} value={certInfo.dn} mono />
            <MetaRow label={fr.onboarding.step3.fingerprint} value={certInfo.fingerprint} mono />
            <MetaRow
              label={fr.onboarding.step3.validFrom}
              value={`${certInfo.notBefore} — ${certInfo.notAfter}`}
            />
            <MetaRow
              label={fr.onboarding.step3.storedIn}
              value={
                certInfo.storage === "keychain"
                  ? fr.onboarding.step3.keychain
                  : fr.onboarding.step3.fallbackFile
              }
            />
          </div>
        </div>
      )}

      {certInfo === null && !generating && identity === null && (
        <p style={{ ...descStyle, color: "var(--ink)" }}>
          Complétez l'étape 1 (Identité) avant de générer le certificat.
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onPrev}>
          {fr.onboarding.prev}
        </Button>
        <div style={{ display: "flex", gap: 10 }}>
          {certInfo !== null && (
            <Button
              variant="ghost"
              onClick={() => {
                void handleGenerate();
              }}
              disabled={generating}
            >
              {fr.onboarding.step3.retry}
            </Button>
          )}
          <Button onClick={onNext} disabled={certInfo === null}>
            {fr.onboarding.next}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MetaRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function MetaRow({ label, value, mono }: MetaRowProps): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
      <span
        style={{
          color: "var(--muted)",
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: 11,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: "var(--ink)",
          fontFamily: mono === true ? "var(--font-mono)" : "var(--font-ui)",
          fontSize: "var(--t-sm)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
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

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "2.5px solid var(--ink)",
  padding: "20px 24px",
  boxShadow: "3px 3px 0 var(--ink)",
};

const statusRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 16,
};

const checkmarkStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  background: "var(--ink)",
  color: "var(--accent)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 14,
  flexShrink: 0,
};

const statusTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontWeight: 700,
  fontSize: "var(--t-base)",
  color: "var(--ink)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const metaStyle: React.CSSProperties = {
  paddingLeft: 4,
};
