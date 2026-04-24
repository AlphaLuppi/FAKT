/**
 * ToolUseBlock - carte repliable pour un appel d'outil MCP.
 *
 * Header : "OUTIL: <nom>" + chevron. Contenu : JSON formatte de l'input
 * appel par Claude. Replie par defaut. Style Brutal Invoice.
 */

import { tokens } from "@fakt/design-tokens";
import { type ReactElement, useState } from "react";

interface ToolUseBlockProps {
  name: string;
  input: unknown;
  streaming?: boolean;
  defaultOpen?: boolean;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolUseBlock({
  name,
  input,
  streaming = false,
  defaultOpen = false,
}: ToolUseBlockProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { color, font, fontSize, fontWeight, stroke, spacing } = tokens;

  return (
    <div
      data-testid="tool-use-block"
      style={{
        border: `${stroke.base} solid ${color.ink}`,
        background: color.surface,
        margin: `${spacing[1]} 0`,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        data-testid="tool-use-toggle"
        aria-expanded={isOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          width: "100%",
          padding: `${spacing[1]} ${spacing[2]}`,
          background: color.accentSoft,
          border: "none",
          borderBottom: isOpen ? `${stroke.hair} solid ${color.ink}` : "none",
          fontFamily: font.ui,
          fontSize: fontSize.xs,
          fontWeight: Number(fontWeight.black),
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: color.ink,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 10,
            transition: "transform 150ms ease-out",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          {">"}
        </span>
        <span>
          Outil : <span style={{ fontFamily: font.mono }}>{name}</span>
        </span>
        {streaming && (
          <span
            data-testid="tool-use-loading"
            style={{ fontFamily: font.mono, marginLeft: "auto" }}
          >
            ...
          </span>
        )}
      </button>
      {isOpen && (
        <pre
          style={{
            margin: 0,
            padding: spacing[2],
            fontFamily: font.mono,
            fontSize: fontSize.xs,
            color: color.ink,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowX: "auto",
          }}
        >
          {formatJson(input)}
        </pre>
      )}
    </div>
  );
}
