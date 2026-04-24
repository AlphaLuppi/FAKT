import { fr } from "@fakt/shared";
import { Button } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

type SessionStatus = "pending" | "streaming" | "done" | "error" | "timeout" | "cancelled";
type SessionKind = "extract_quote" | "chat" | "draft_email" | "unknown";

interface AiSession {
  id: string;
  kind: SessionKind | string;
  status: SessionStatus;
  prompt_preview: string;
  prompt_chars: number;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  token_events: number;
  cli_lines: number;
  error: string | null;
  stderr: string | null;
}

interface SessionsSnapshot {
  active: AiSession[];
  history: AiSession[];
}

async function fetchSessions(): Promise<SessionsSnapshot> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SessionsSnapshot>("list_ai_sessions");
}

async function clearHistory(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("clear_ai_sessions_history");
}

const REFRESH_MS = 1500;

export function AiSessionsTab(): ReactElement {
  const [snapshot, setSnapshot] = useState<SessionsSnapshot>({ active: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const snap = await fetchSessions();
      setSnapshot(snap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    return (): void => clearInterval(id);
  }, [autoRefresh, refresh]);

  async function handleClear(): Promise<void> {
    await clearHistory();
    await refresh();
  }

  const totalSessions = snapshot.active.length + snapshot.history.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={sectionTitleStyle}>{fr.settings.aiSessions.title}</h3>
        <p style={descStyle}>{fr.settings.aiSessions.description}</p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          {fr.settings.aiSessions.refresh}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void handleClear()}
          disabled={snapshot.history.length === 0}
        >
          {fr.settings.aiSessions.clearHistory}
        </Button>
        <label style={autoRefreshStyle}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span>{fr.settings.aiSessions.autoRefresh}</span>
        </label>
      </div>

      {error !== null && (
        <div role="alert" style={errorBoxStyle}>
          {error}
        </div>
      )}

      {totalSessions === 0 && !loading && error === null && (
        <div style={emptyStyle}>{fr.settings.aiSessions.empty}</div>
      )}

      {snapshot.active.length > 0 && (
        <SessionSection
          title={fr.settings.aiSessions.activeTitle}
          sessions={snapshot.active}
          accent
          expandedId={expandedId}
          onToggle={setExpandedId}
        />
      )}

      {snapshot.history.length > 0 && (
        <SessionSection
          title={fr.settings.aiSessions.historyTitle}
          sessions={snapshot.history}
          accent={false}
          expandedId={expandedId}
          onToggle={setExpandedId}
        />
      )}
    </div>
  );
}

function SessionSection({
  title,
  sessions,
  accent,
  expandedId,
  onToggle,
}: {
  title: string;
  sessions: AiSession[];
  accent: boolean;
  expandedId: string | null;
  onToggle: (id: string | null) => void;
}): ReactElement {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={sectionHeaderStyle(accent)}>
        <span>{title}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)" }}>
          {sessions.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            expanded={expandedId === session.id}
            onToggle={() => onToggle(expandedId === session.id ? null : session.id)}
          />
        ))}
      </div>
    </section>
  );
}

function SessionRow({
  session,
  expanded,
  onToggle,
}: {
  session: AiSession;
  expanded: boolean;
  onToggle: () => void;
}): ReactElement {
  const kindLabel =
    session.kind === "extract_quote"
      ? fr.settings.aiSessions.kinds.extract_quote
      : session.kind === "chat"
        ? fr.settings.aiSessions.kinds.chat
        : session.kind === "draft_email"
          ? fr.settings.aiSessions.kinds.draft_email
          : fr.settings.aiSessions.kinds.unknown;

  return (
    <div style={rowCardStyle(session.status)}>
      <button type="button" style={rowHeaderStyle} onClick={onToggle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={session.status} />
            <span style={kindLabelStyle}>{kindLabel}</span>
            <span style={monoSmallStyle}>{formatDuration(session)}</span>
          </div>
          <div style={previewLineStyle}>
            {session.prompt_preview.replaceAll("\n", " ") || "—"}
          </div>
          {session.error !== null && (
            <div style={errorLineStyle}>⚠ {session.error}</div>
          )}
        </div>
        <span style={caretStyle}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={detailsStyle}>
          <DetailRow label="ID" value={<code style={codeStyle}>{session.id}</code>} />
          <DetailRow label={fr.settings.aiSessions.colStarted} value={formatDate(session.started_at)} />
          <DetailRow
            label={fr.settings.aiSessions.promptChars}
            value={session.prompt_chars.toString()}
          />
          <DetailRow
            label={fr.settings.aiSessions.tokenEvents}
            value={session.token_events.toString()}
          />
          <DetailRow
            label={fr.settings.aiSessions.cliLines}
            value={session.cli_lines.toString()}
          />
          <div>
            <div style={detailHeadingStyle}>{fr.settings.aiSessions.promptPreview}</div>
            <pre style={preStyle}>{session.prompt_preview}</pre>
          </div>
          <div>
            <div style={detailHeadingStyle}>{fr.settings.aiSessions.stderrTitle}</div>
            <pre style={{ ...preStyle, background: session.stderr !== null ? "#2a1a1a" : undefined, color: session.stderr !== null ? "#ffcccc" : undefined }}>
              {session.stderr ?? fr.settings.aiSessions.noStderr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): ReactElement {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={detailLabelStyle}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-sm)" }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }): ReactElement {
  const color = STATUS_COLORS[status];
  const label = fr.settings.aiSessions.statusLabel[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        background: color.bg,
        color: color.fg,
        border: `2px solid ${color.border}`,
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {(status === "streaming" || status === "pending") && (
        <span style={pulseStyle} />
      )}
      {label}
    </span>
  );
}

const STATUS_COLORS: Record<
  SessionStatus,
  { bg: string; fg: string; border: string }
> = {
  pending: { bg: "var(--paper)", fg: "var(--ink)", border: "var(--ink)" },
  streaming: { bg: "var(--accent)", fg: "var(--ink)", border: "var(--ink)" },
  done: { bg: "var(--ink)", fg: "var(--accent)", border: "var(--ink)" },
  error: { bg: "#ff3333", fg: "#fff", border: "var(--ink)" },
  timeout: { bg: "#ff3333", fg: "#fff", border: "var(--ink)" },
  cancelled: { bg: "var(--muted)", fg: "#fff", border: "var(--ink)" },
};

function formatDuration(session: AiSession): string {
  if (session.duration_ms !== null) {
    return `${(session.duration_ms / 1000).toFixed(2)} s`;
  }
  const elapsed = Date.now() - session.started_at;
  return `${(elapsed / 1000).toFixed(1)} s…`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Styles (Brutal Invoice) ──────────────────────────────────────────────────

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

const autoRefreshStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  fontWeight: 500,
  color: "var(--ink)",
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  border: "2px dashed var(--ink)",
  padding: 24,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--muted)",
  textAlign: "center",
};

const errorBoxStyle: React.CSSProperties = {
  border: "2.5px solid var(--ink)",
  background: "#ff3333",
  color: "#fff",
  padding: 12,
  fontFamily: "var(--font-ui)",
  fontWeight: 700,
};

function sectionHeaderStyle(accent: boolean): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 14px",
    background: accent ? "var(--accent)" : "var(--ink)",
    color: accent ? "var(--ink)" : "var(--accent)",
    border: "2px solid var(--ink)",
    fontFamily: "var(--font-ui)",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "var(--t-xs)",
  };
}

function rowCardStyle(status: SessionStatus): React.CSSProperties {
  const isActive = status === "streaming" || status === "pending";
  return {
    background: "var(--surface)",
    border: "2.5px solid var(--ink)",
    boxShadow: isActive ? "5px 5px 0 var(--accent)" : "3px 3px 0 var(--ink)",
    overflow: "hidden",
  };
}

const rowHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "14px 18px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
  fontFamily: "inherit",
};

const kindLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontWeight: 700,
  fontSize: "var(--t-sm)",
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};

const monoSmallStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--t-xs)",
  color: "var(--muted)",
  fontVariantNumeric: "tabular-nums",
};

const previewLineStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--t-xs)",
  color: "var(--muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const errorLineStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-xs)",
  fontWeight: 700,
  color: "#c00",
};

const caretStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  color: "var(--muted)",
  alignSelf: "center",
};

const detailsStyle: React.CSSProperties = {
  padding: "16px 18px",
  borderTop: "2px solid var(--ink)",
  background: "var(--paper)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const detailLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-xs)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted)",
  minWidth: 140,
};

const detailHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-xs)",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ink)",
  marginBottom: 6,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  background: "#1a1a1a",
  color: "#f0f0f0",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--t-xs)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 260,
  overflow: "auto",
  border: "2px solid var(--ink)",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--t-xs)",
  background: "var(--paper)",
  padding: "2px 6px",
  border: "1.5px solid var(--ink)",
};

const pulseStyle: React.CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 8,
  background: "currentColor",
  animation: "ai-session-pulse 1s ease-in-out infinite",
};

// Keyframes injectées une fois au chargement du module.
if (typeof document !== "undefined") {
  const KEY = "ai-session-pulse-style";
  if (document.getElementById(KEY) === null) {
    const styleEl = document.createElement("style");
    styleEl.id = KEY;
    styleEl.textContent = `@keyframes ai-session-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`;
    document.head.appendChild(styleEl);
  }
}
