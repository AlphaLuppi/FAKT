/**
 * ExecutionTrace — accordion minimal qui regroupe tous les blocs non-text
 * consécutifs (thinking + tool_use + tool_result) d'un message assistant.
 *
 * Pattern UX : style ChatGPT / claude.ai — une seule ligne résumée
 * (repliée par défaut) avec l'état courant. Clic pour voir tout le détail.
 *
 * Collapsed : `▸ UTILISE {tool_name}…` ou `▸ {N} ÉTAPES (M OUTILS)` ou
 *             `▸ RÉFLEXION EN COURS…` selon l'état du run.
 * Expanded  : chaque bloc déroulé ligne par ligne, sans wrapper carte.
 */

import { tokens } from "@fakt/design-tokens";
import type { CSSProperties, ReactElement } from "react";
import { useMemo, useState } from "react";
import type { ChatBlock } from "./useChatStream.js";

type ExecBlock = Exclude<ChatBlock, { type: "text" }>;

interface ExecutionTraceProps {
  blocks: ExecBlock[];
  streaming: boolean;
  /** Clé stable pour le rendu (utilisée pour data-testid). */
  idKey: string;
}

/**
 * Calcule le résumé à afficher en mode collapsed en fonction de l'état.
 */
function computeSummary(blocks: ExecBlock[], streaming: boolean): string {
  const toolUses = blocks.filter((b) => b.type === "tool_use");
  const thinkings = blocks.filter((b) => b.type === "thinking");
  const last = blocks[blocks.length - 1];

  if (streaming && last) {
    if (last.type === "tool_use") return `Utilise ${last.name}…`;
    if (last.type === "thinking") return "Réflexion en cours…";
    if (last.type === "tool_result") return "Traite le résultat…";
  }

  const parts: string[] = [];
  if (thinkings.length > 0)
    parts.push(`${thinkings.length} réflexion${thinkings.length > 1 ? "s" : ""}`);
  if (toolUses.length === 1 && toolUses[0]) {
    // Un seul outil → afficher son nom pour donner du contexte dès le collapse.
    parts.push(`outil ${toolUses[0].name}`);
  } else if (toolUses.length > 1) {
    parts.push(`${toolUses.length} outils`);
  }
  if (parts.length === 0) return `${blocks.length} étape${blocks.length > 1 ? "s" : ""}`;
  return parts.join(" · ");
}

function formatJson(input: unknown): string {
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function renderDetailBlock(block: ExecBlock, idx: number, keyPrefix: string): ReactElement {
  const { color, font, fontSize, spacing } = tokens;

  const baseStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: spacing[1],
    padding: `${spacing[2]} ${spacing[3]}`,
    borderTop: idx === 0 ? "none" : `1px solid ${color.line}`,
  };

  const labelStyle: CSSProperties = {
    fontFamily: font.ui,
    fontSize: fontSize.xs,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: color.ink,
  };

  const contentStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: fontSize.xs,
    color: color.muted,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
  };

  if (block.type === "thinking") {
    return (
      <div
        key={`${keyPrefix}-d${idx}`}
        data-testid={`${keyPrefix}-thinking-${idx}`}
        style={baseStyle}
      >
        <span style={labelStyle}>Réflexion</span>
        <pre style={contentStyle}>{block.thinking}</pre>
      </div>
    );
  }
  if (block.type === "tool_use") {
    return (
      <div key={`${keyPrefix}-d${idx}`} data-testid={`${keyPrefix}-tool-${idx}`} style={baseStyle}>
        <span style={labelStyle}>
          Outil : <span style={{ color: color.ink, fontFamily: font.mono }}>{block.name}</span>
        </span>
        <pre style={contentStyle}>{formatJson(block.input)}</pre>
      </div>
    );
  }
  // tool_result
  const badgeBg = block.isError ? "#D97777" : tokens.color.accentSoft;
  return (
    <div key={`${keyPrefix}-d${idx}`} data-testid={`${keyPrefix}-result-${idx}`} style={baseStyle}>
      <span style={labelStyle}>
        Résultat{" "}
        <span
          style={{
            display: "inline-block",
            padding: "1px 6px",
            background: badgeBg,
            border: `1px solid ${color.ink}`,
            fontFamily: font.mono,
            fontSize: fontSize.xs,
            marginLeft: spacing[1],
          }}
        >
          {block.isError ? "ERREUR" : "OK"}
        </span>
      </span>
      <pre style={contentStyle}>{block.content}</pre>
    </div>
  );
}

export function ExecutionTrace({ blocks, streaming, idKey }: ExecutionTraceProps): ReactElement {
  const [open, setOpen] = useState(false);
  const { color, font, fontSize, spacing } = tokens;

  const summary = useMemo(() => computeSummary(blocks, streaming), [blocks, streaming]);

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    width: "100%",
    padding: `${spacing[2]} ${spacing[3]}`,
    border: `1.5px solid ${color.ink}`,
    background: open ? color.paper2 : color.surface,
    fontFamily: font.ui,
    fontSize: fontSize.xs,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: color.ink,
    cursor: "pointer",
    textAlign: "left",
  };

  const chevronStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: fontSize.sm,
    display: "inline-block",
    width: 12,
    transition: "transform 120ms ease-out",
    transform: open ? "rotate(90deg)" : "none",
  };

  return (
    <div
      data-testid={`${idKey}-trace`}
      data-open={open ? "true" : "false"}
      style={{ display: "flex", flexDirection: "column", marginTop: spacing[2] }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={headerStyle}
        data-testid={`${idKey}-trace-toggle`}
      >
        <span aria-hidden="true" style={chevronStyle}>
          ▶
        </span>
        <span style={{ flex: 1 }}>{summary}</span>
        {streaming && (
          <span aria-hidden="true" style={{ fontFamily: font.mono, color: color.muted }}>
            …
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            border: `1.5px solid ${color.ink}`,
            borderTop: "none",
            background: color.surface,
          }}
          data-testid={`${idKey}-trace-details`}
        >
          {blocks.map((b, i) => renderDetailBlock(b, i, idKey))}
        </div>
      )}
    </div>
  );
}
