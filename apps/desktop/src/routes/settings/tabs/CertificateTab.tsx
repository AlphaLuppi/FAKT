import { fr } from "@fakt/shared";
import type { Workspace } from "@fakt/shared";
import { Button, Modal, toast } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

/// Miroir de `crypto::cert::CertInfo` côté Rust (serde rename_all camelCase).
interface CertInfo {
  subjectCn: string;
  notBeforeIso: string;
  notAfterIso: string;
  serialHex: string;
  fingerprintSha256Hex: string;
}

interface CertGenerationResult {
  info: CertInfo;
  cert_pem: string;
  storage: { kind: "keychain" } | { kind: "fallback-file"; path: string };
}

async function invokeGetCertInfo(): Promise<CertInfo | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<CertInfo | null>("get_cert_info", { fallbackPassword: null });
  } catch {
    return null;
  }
}

async function invokeRotateCert(workspace: Workspace): Promise<CertGenerationResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CertGenerationResult>("rotate_cert", {
    args: {
      subject_dn: {
        common_name: workspace.name,
        organization: workspace.name,
        country: "FR",
        email: workspace.email,
      },
      fallback_password: null,
      archive_previous: true,
    },
  });
}

function computeValidityRemaining(notAfterIso: string): string {
  const end = new Date(notAfterIso);
  const now = new Date();
  const msLeft = end.getTime() - now.getTime();
  if (msLeft <= 0) return "Expiré";
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const years = Math.floor(daysLeft / 365);
  const months = Math.floor((daysLeft % 365) / 30);
  return fr.settings.certificate.validityRemaining(years, months);
}

interface Props {
  workspace: Workspace | null;
}

export function CertificateTab({ workspace }: Props): ReactElement {
  const [loading, setLoading] = useState(true);
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    void invokeGetCertInfo().then((info) => {
      setCertInfo(info);
      setLoading(false);
    });
  }, []);

  async function handleRotate(): Promise<void> {
    if (workspace === null) return;
    setRotating(true);
    setShowWarning(false);
    try {
      const result = await invokeRotateCert(workspace);
      setCertInfo(result.info);
      toast.success("Certificat régénéré avec succès");
    } catch (err) {
      const msg = err instanceof Error ? err.message : fr.errors.keychainError;
      toast.error(msg);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={sectionTitleStyle}>{fr.settings.certificate.title}</h3>
      </div>

      {loading ? (
        <p style={descStyle}>Chargement…</p>
      ) : certInfo !== null ? (
        <div style={cardStyle}>
          <div style={statusRowStyle}>
            <span style={checkmarkStyle}>✓</span>
            <span style={statusTextStyle}>{fr.settings.certificate.generated}</span>
          </div>
          <div style={metaStyle}>
            <MetaRow label={fr.settings.certificate.dn} value={certInfo.subjectCn} mono />
            <MetaRow
              label={fr.settings.certificate.fingerprint}
              value={certInfo.fingerprintSha256Hex}
              mono
            />
            <MetaRow
              label={fr.settings.certificate.expiry}
              value={`${certInfo.notAfterIso} — ${computeValidityRemaining(certInfo.notAfterIso)}`}
            />
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <p style={{ ...descStyle, margin: 0 }}>
            Aucun certificat actif. Utilisez l'assistant de premier lancement ou régénérez un
            certificat.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <Button
          variant={certInfo !== null ? "danger" : "primary"}
          onClick={() => setShowWarning(true)}
          disabled={rotating || workspace === null}
          data-testid={
            certInfo !== null ? "settings-certificate-rotate" : "settings-certificate-generate"
          }
        >
          {certInfo !== null ? fr.settings.certificate.rotate : fr.settings.certificate.generate}
        </Button>
      </div>

      <Modal
        open={showWarning}
        title={fr.settings.certificate.rotateWarningTitle}
        onClose={() => setShowWarning(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowWarning(false)}
              data-testid="settings-certificate-rotate-cancel"
            >
              {fr.settings.certificate.rotateCancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void handleRotate();
              }}
              disabled={rotating}
              data-testid="settings-certificate-rotate-confirm"
            >
              {rotating ? "Régénération…" : fr.settings.certificate.rotateConfirm}
            </Button>
          </>
        }
      >
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "var(--t-sm)",
            color: "var(--ink)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {fr.settings.certificate.rotateWarningBody}
        </p>
      </Modal>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: { label: string; value: string; mono?: boolean }): ReactElement {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: 10,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono === true ? "var(--font-mono)" : "var(--font-ui)",
          fontSize: "var(--t-sm)",
          color: "var(--ink)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
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

const descStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--muted)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "2.5px solid var(--ink)",
  padding: "16px 20px",
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
