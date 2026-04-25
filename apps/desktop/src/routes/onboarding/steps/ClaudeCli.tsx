import { healthCheck } from "@fakt/ai";
import type { CliInfo } from "@fakt/ai";
import { fr } from "@fakt/shared";
import { Button, Checkbox } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useOnboarding } from "../context.js";

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export function ClaudeCliStep({ onNext, onPrev }: Props): ReactElement {
  const { state, setCliInfo } = useOnboarding();
  const [loading, setLoading] = useState(false);
  const [cliInfo, setLocalCliInfo] = useState<CliInfo | null>(state.cliInfo);
  const [skipped, setSkipped] = useState(state.cliSkipped);

  async function runCheck(): Promise<void> {
    setLoading(true);
    try {
      const info = await healthCheck();
      setLocalCliInfo(info);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cliInfo === null) {
      void runCheck();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional on mount only

  function handleNext(): void {
    setCliInfo(cliInfo ?? { installed: false }, skipped);
    onNext();
  }

  const canProceed = skipped || cliInfo?.installed === true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={headingStyle}>{fr.onboarding.step2.title}</h2>
        <p style={descStyle}>{fr.onboarding.step2.description}</p>
      </div>

      <div style={cardStyle}>
        {loading && (
          <div style={statusRowStyle} data-testid="wizard-claudecli-status-checking">
            <span style={dotStyle("checking")} />
            <span style={statusTextStyle}>{fr.onboarding.step2.checking}</span>
          </div>
        )}

        {!loading && cliInfo !== null && (
          <>
            <div
              style={statusRowStyle}
              data-testid={
                cliInfo.installed ? "wizard-claudecli-status-ok" : "wizard-claudecli-status-missing"
              }
            >
              <span style={dotStyle(cliInfo.installed ? "ok" : "missing")} />
              <span style={statusTextStyle}>
                {cliInfo.installed ? fr.onboarding.step2.detected : fr.onboarding.step2.missing}
              </span>
            </div>

            {cliInfo.installed && cliInfo.version !== undefined && (
              <div style={metaStyle}>
                <MetaRow label={fr.onboarding.step2.version} value={cliInfo.version} />
                {cliInfo.path !== undefined && (
                  <MetaRow label={fr.onboarding.step2.path} value={cliInfo.path} mono />
                )}
              </div>
            )}

            {!cliInfo.installed && cliInfo.installHint !== undefined && (
              <div style={{ marginTop: 12 }}>
                <p style={{ ...descStyle, marginTop: 0 }}>{cliInfo.installHint}</p>
              </div>
            )}
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={() => {
              void runCheck();
            }}
            disabled={loading}
            data-testid="wizard-claudecli-recheck"
          >
            {fr.onboarding.step2.recheck}
          </Button>
          {cliInfo !== null && !cliInfo.installed && (
            <Button
              variant="ghost"
              onClick={() => {
                window.open("https://claude.ai/code", "_blank");
              }}
              data-testid="wizard-claudecli-open-install-page"
            >
              {fr.onboarding.step2.openInstallPage}
            </Button>
          )}
        </div>
      </div>

      <Checkbox
        label={fr.onboarding.step2.skipLabel}
        checked={skipped}
        onChange={(e) => setSkipped(e.target.checked)}
        data-testid="wizard-claudecli-skip"
      />
      {skipped && <p style={{ ...descStyle, marginTop: -12 }}>{fr.onboarding.step2.skipHint}</p>}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Button variant="secondary" onClick={onPrev} data-testid="wizard-prev">
          {fr.onboarding.prev}
        </Button>
        <Button onClick={handleNext} disabled={!canProceed} data-testid="wizard-next">
          {fr.onboarding.next}
        </Button>
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
    <div style={{ display: "flex", gap: 8, fontSize: "var(--t-sm)", fontFamily: "var(--font-ui)" }}>
      <span
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontSize: 11,
        }}
      >
        {label}
      </span>
      <span
        style={{ color: "var(--ink)", fontFamily: mono === true ? "var(--font-mono)" : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

type DotKind = "checking" | "ok" | "missing";

function dotStyle(kind: DotKind): React.CSSProperties {
  const bg = kind === "ok" ? "#000" : kind === "missing" ? "#000" : "var(--muted)";
  const border =
    kind === "ok"
      ? "2px solid #000"
      : kind === "missing"
        ? "2px solid #000"
        : "2px solid var(--muted)";
  return {
    width: 12,
    height: 12,
    background:
      kind === "ok" ? "var(--accent)" : kind === "missing" ? "transparent" : "transparent",
    border,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-block",
    // Brutal override: dot only uses borderRadius for circle indicator
  };
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
  marginTop: 12,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  paddingLeft: 22,
};
