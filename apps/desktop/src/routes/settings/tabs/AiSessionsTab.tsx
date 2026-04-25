import { fr } from "@fakt/shared";
import { Button, Checkbox } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { useVerboseAiMode } from "../../../hooks/useVerboseAiMode.js";

type SessionStatus = "pending" | "streaming" | "done" | "error" | "timeout" | "cancelled";
type SessionKind = "extract_quote" | "chat" | "draft_email" | "unknown";

interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
  is_error: boolean;
  started_at: number;
  ended_at: number | null;
}

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
  response_text: string;
  final_result: unknown;
  tool_calls: ToolCallRecord[];
  raw_events: string[];
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
  const { verbose, setVerbose } = useVerboseAiMode();
  const [snapshot, setSnapshot] = useState<SessionsSnapshot>({ active: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  // Sessions dont le détail est ouvert. On permet plusieurs à la fois pour que
  // l'utilisateur puisse comparer, et on auto-expand les runs actifs.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Auto-expand les sessions actives (streaming/pending) pour voir la sortie
  // en live sans avoir à cliquer. Quand elles terminent, l'auto-expand devient
  // auto-collapse (sauf si l'user l'a explicitement ré-ouvert).
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const s of snapshot.active) {
        if (!next.has(s.id)) {
          next.add(s.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [snapshot.active]);

  function toggleExpanded(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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

      <div style={verboseSectionStyle} data-testid="settings-ai-verbose-section">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={verboseTitleStyle}>{fr.settings.aiSessions.verboseModeTitle}</span>
          <p style={verboseHintStyle}>{fr.settings.aiSessions.verboseModeHint}</p>
        </div>
        <Checkbox
          label={fr.settings.aiSessions.verboseModeLabel}
          checked={verbose}
          onChange={(e) => setVerbose(e.target.checked)}
          data-testid="settings-ai-verbose-toggle"
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="secondary"
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="settings-ai-refresh"
        >
          {fr.settings.aiSessions.refresh}
        </Button>
        <Button
          variant="ghost"
          onClick={() => void handleClear()}
          disabled={snapshot.history.length === 0}
          data-testid="settings-ai-clear-history"
        >
          {fr.settings.aiSessions.clearHistory}
        </Button>
        <label style={autoRefreshStyle}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            data-testid="settings-ai-auto-refresh"
          />
          <span>{fr.settings.aiSessions.autoRefresh}</span>
        </label>
      </div>

      {error !== null && (
        <div role="alert" style={errorBoxStyle} data-testid="settings-ai-error">
          {error}
        </div>
      )}

      {totalSessions === 0 && !loading && error === null && (
        <div style={emptyStyle} data-testid="settings-ai-empty">
          {fr.settings.aiSessions.empty}
        </div>
      )}

      {snapshot.active.length > 0 && (
        <SessionSection
          title={fr.settings.aiSessions.activeTitle}
          sessions={snapshot.active}
          accent
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
        />
      )}

      {snapshot.history.length > 0 && (
        <SessionSection
          title={fr.settings.aiSessions.historyTitle}
          sessions={snapshot.history}
          accent={false}
          expandedIds={expandedIds}
          onToggle={toggleExpanded}
        />
      )}
    </div>
  );
}

function SessionSection({
  title,
  sessions,
  accent,
  expandedIds,
  onToggle,
}: {
  title: string;
  sessions: AiSession[];
  accent: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
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
            expanded={expandedIds.has(session.id)}
            onToggle={() => onToggle(session.id)}
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
    <div style={rowCardStyle(session.status)} data-testid={`settings-ai-session-${session.id}`}>
      <button
        type="button"
        style={rowHeaderStyle}
        onClick={onToggle}
        data-testid={`settings-ai-session-toggle-${session.id}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={session.status} />
            <span style={kindLabelStyle}>{kindLabel}</span>
            <span style={monoSmallStyle}>{formatDuration(session)}</span>
          </div>
          <div style={previewLineStyle}>{session.prompt_preview.replaceAll("\n", " ") || "—"}</div>
          {session.error !== null && <div style={errorLineStyle}>⚠ {session.error}</div>}
        </div>
        <span style={caretStyle}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={detailsStyle}>
          <div style={metaGridStyle}>
            <DetailRow label="ID" value={<code style={codeStyle}>{session.id}</code>} />
            <DetailRow
              label={fr.settings.aiSessions.colStarted}
              value={formatDate(session.started_at)}
            />
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
            {session.tool_calls.length > 0 && (
              <DetailRow
                label={fr.settings.aiSessions.toolCallsCount}
                value={session.tool_calls.length.toString()}
              />
            )}
          </div>

          {session.response_text.length > 0 && (
            <div>
              <div style={detailHeadingStyle}>
                {fr.settings.aiSessions.responseTitle}
                {session.status === "streaming" && (
                  <span style={liveBadgeStyle}>{fr.settings.aiSessions.live}</span>
                )}
              </div>
              <pre style={{ ...preStyle, background: "var(--paper)", color: "var(--ink)" }}>
                {session.response_text}
              </pre>
            </div>
          )}

          {session.tool_calls.length > 0 && (
            <div>
              <div style={detailHeadingStyle}>{fr.settings.aiSessions.toolCallsTitle}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {session.tool_calls.map((tc, idx) => (
                  <ToolCallCard key={idx} call={tc} />
                ))}
              </div>
            </div>
          )}

          {session.final_result !== null && session.final_result !== undefined && (
            <div>
              <div style={detailHeadingStyle}>{fr.settings.aiSessions.finalResultTitle}</div>
              <pre style={preStyle}>{formatJson(session.final_result)}</pre>
            </div>
          )}

          <div>
            <div style={detailHeadingStyle}>{fr.settings.aiSessions.promptPreview}</div>
            <pre style={preStyle}>{session.prompt_preview}</pre>
          </div>

          <div>
            <div style={detailHeadingStyle}>{fr.settings.aiSessions.stderrTitle}</div>
            <pre
              style={{
                ...preStyle,
                background: session.stderr !== null ? "#2a1a1a" : undefined,
                color: session.stderr !== null ? "#ffcccc" : undefined,
              }}
            >
              {session.stderr ?? fr.settings.aiSessions.noStderr}
            </pre>
          </div>

          {session.raw_events.length > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary
                style={detailHeadingStyle}
                data-testid={`settings-ai-session-raw-events-toggle-${session.id}`}
              >
                {fr.settings.aiSessions.rawEventsTitle} ({session.raw_events.length})
              </summary>
              <pre style={{ ...preStyle, maxHeight: 400 }}>{session.raw_events.join("\n")}</pre>
            </details>
          )}
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

function ToolCallCard({ call }: { call: ToolCallRecord }): ReactElement {
  const duration =
    call.ended_at !== null ? `${((call.ended_at - call.started_at) / 1000).toFixed(2)} s` : "…";
  return (
    <div
      style={{
        border: `2px solid ${call.is_error ? "#c00" : "var(--ink)"}`,
        background: call.ended_at === null ? "var(--accent)" : "var(--surface)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
          {call.is_error ? "⚠" : call.ended_at === null ? "◌" : "✓"} {call.name}
        </span>
        <span style={monoSmallStyle}>{duration}</span>
      </div>
      <div>
        <div style={{ ...detailHeadingStyle, marginBottom: 4 }}>input</div>
        <pre style={{ ...preStyle, maxHeight: 160 }}>{formatJson(call.input)}</pre>
      </div>
      {call.output !== null && call.output !== undefined && (
        <div>
          <div style={{ ...detailHeadingStyle, marginBottom: 4 }}>output</div>
          <pre style={{ ...preStyle, maxHeight: 160 }}>{formatJson(call.output)}</pre>
        </div>
      )}
    </div>
  );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function StatusBadge({ status }: { status: SessionStatus }): ReactElement {
  const color = STATUS_COLORS[status];
  const label = fr.settings.aiSessions.statusLabel[status];
  return (
    <span
      data-testid={`settings-ai-status-${status}`}
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
      {(status === "streaming" || status === "pending") && <span style={pulseStyle} />}
      {label}
    </span>
  );
}

const STATUS_COLORS: Record<SessionStatus, { bg: string; fg: string; border: string }> = {
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

const verboseSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 14,
  border: "2px solid var(--ink)",
  background: "var(--paper)",
  boxShadow: "3px 3px 0 var(--ink)",
};

const verboseTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontWeight: 800,
  fontSize: "var(--t-sm)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ink)",
};

const verboseHintStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-xs)",
  color: "var(--muted)",
  lineHeight: 1.5,
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
  gap: 14,
};

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 8,
  padding: 10,
  background: "var(--surface)",
  border: "2px solid var(--ink)",
};

const liveBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 10,
  padding: "2px 6px",
  background: "#c00",
  color: "#fff",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  verticalAlign: "middle",
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
    styleEl.textContent =
      "@keyframes ai-session-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }";
    document.head.appendChild(styleEl);
  }
}
