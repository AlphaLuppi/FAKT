import { healthCheck } from "@fakt/ai";
import type { CliInfo } from "@fakt/ai";
import { fr } from "@fakt/shared";
import { Button } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

export function ClaudeCliTab(): ReactElement {
  const [loading, setLoading] = useState(true);
  const [cliInfo, setCliInfo] = useState<CliInfo | null>(null);

  async function runCheck(): Promise<void> {
    setLoading(true);
    try {
      const info = await healthCheck();
      setCliInfo(info);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runCheck();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={sectionTitleStyle}>{fr.settings.cli.title}</h3>
        <p style={descStyle}>{fr.settings.cli.description}</p>
      </div>

      <div style={cardStyle}>
        <div style={rowStyle}>
          <span style={labelStyle}>{fr.settings.cli.status}</span>
          {loading ? (
            <span style={mutedStyle}>Vérification…</span>
          ) : cliInfo !== null ? (
            <StatusBadge
              installed={cliInfo.installed}
              {...(cliInfo.version !== undefined ? { version: cliInfo.version } : {})}
            />
          ) : null}
        </div>

        {!loading && cliInfo?.installed === true && cliInfo.path !== undefined && (
          <div style={{ ...rowStyle, marginTop: 8 }}>
            <span style={labelStyle}>Chemin</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--t-sm)",
                color: "var(--ink)",
              }}
            >
              {cliInfo.path}
            </span>
          </div>
        )}

        {!loading && cliInfo?.installed !== true && cliInfo?.installHint !== undefined && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 16px",
              background: "var(--paper)",
              border: "2px solid var(--ink)",
            }}
          >
            <p style={{ ...descStyle, margin: 0, color: "var(--ink)" }}>{cliInfo.installHint}</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button
          variant="secondary"
          onClick={() => {
            void runCheck();
          }}
          disabled={loading}
        >
          {fr.settings.cli.recheck}
        </Button>
        {cliInfo !== null && !cliInfo.installed && (
          <Button variant="ghost" onClick={() => window.open("https://claude.ai/code", "_blank")}>
            {fr.settings.cli.openInstallPage}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() =>
            window.open("https://docs.anthropic.com/en/docs/claude-code/overview", "_blank")
          }
        >
          {fr.settings.cli.docLink}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({
  installed,
  version,
}: { installed: boolean; version?: string }): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          background: installed ? "var(--ink)" : "transparent",
          border: "2px solid var(--ink)",
          color: installed ? "var(--accent)" : "var(--ink)",
          fontWeight: 800,
          fontSize: 11,
        }}
      >
        {installed ? "✓" : "✗"}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: "var(--t-sm)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {installed
          ? `${fr.onboarding.step2.detected}${version !== undefined ? ` — v${version}` : ""}`
          : fr.onboarding.step2.missing}
      </span>
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
  margin: "6px 0 0",
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontWeight: 700,
  fontSize: "var(--t-xs)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  minWidth: 80,
};

const mutedStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--muted)",
};
