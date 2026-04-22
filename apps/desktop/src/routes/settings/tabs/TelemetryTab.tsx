import { fr } from "@fakt/shared";
import { Button, Checkbox, toast } from "@fakt/ui";
import type { ReactElement } from "react";
import { useState } from "react";

/** Version de l'app injectée par Vite — fallback sur constante. */
const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";

declare const __APP_VERSION__: string | undefined;

interface Props {
  telemetryEnabled: boolean;
  verboseLogs: boolean;
  onTelemetryChange: (enabled: boolean) => Promise<void>;
  onVerboseChange: (enabled: boolean) => void;
}

export function TelemetryTab({
  telemetryEnabled,
  verboseLogs,
  onTelemetryChange,
  onVerboseChange,
}: Props): ReactElement {
  const [saving, setSaving] = useState(false);
  const [localTelemetry, setLocalTelemetry] = useState(telemetryEnabled);

  async function handleTelemetryToggle(enabled: boolean): Promise<void> {
    setLocalTelemetry(enabled);
    setSaving(true);
    try {
      await onTelemetryChange(enabled);
      toast.success(enabled ? "Télémétrie activée" : "Télémétrie désactivée");
    } catch {
      setLocalTelemetry(!enabled);
      toast.error(fr.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h3 style={sectionTitleStyle}>{fr.settings.telemetry.title}</h3>
      </div>

      <div style={sectionStyle}>
        <Checkbox
          label={fr.settings.telemetry.optIn}
          checked={localTelemetry}
          disabled={saving}
          onChange={(e) => {
            void handleTelemetryToggle(e.target.checked);
          }}
        />
        <p style={hintStyle}>{fr.settings.telemetry.description}</p>
      </div>

      <div style={sectionStyle}>
        <Checkbox
          label={fr.settings.telemetry.verboseLogs}
          checked={verboseLogs}
          onChange={(e) => onVerboseChange(e.target.checked)}
        />
        <p style={hintStyle}>{fr.settings.telemetry.verboseLogsHint}</p>
      </div>

      <div style={dividerStyle} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <InfoRow label={fr.settings.telemetry.appVersion} value={`v${APP_VERSION}`} mono />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open("https://github.com/AlphaLuppi/fakt/issues", "_blank")}
          >
            {fr.settings.telemetry.githubIssues}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open("https://github.com/AlphaLuppi/fakt/blob/main/CHANGELOG.md", "_blank")
            }
          >
            {fr.settings.telemetry.changelog}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: { label: string; value: string; mono?: boolean }): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: "var(--t-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--muted)",
          minWidth: 120,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono === true ? "var(--font-mono)" : "var(--font-ui)",
          fontSize: "var(--t-sm)",
          color: "var(--ink)",
        }}
      >
        {value}
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

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  marginLeft: 28,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-xs)",
  color: "var(--muted)",
  lineHeight: 1.5,
};

const dividerStyle: React.CSSProperties = {
  height: 2,
  background: "var(--line)",
};
