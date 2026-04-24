/**
 * ToolResultBlock - carte repliable pour un retour d'outil MCP.
 *
 * Header : "Resultat" + badge "OK" (vert doux) ou "ERREUR" (rouge). Contenu :
 * texte brut ou JSON formatte. Respecte Brutal Invoice - le succes utilise
 * `successBg` (B9F5B0 vert pastel) et l'erreur `dangerBg` (FF6B6B).
 */

import { tokens } from "@fakt/design-tokens";
import { type ReactElement, useState } from "react";

interface ToolResultBlockProps {
  content: string;
  isError: boolean;
  defaultOpen?: boolean;
}

export function ToolResultBlock({
  content,
  isError,
  defaultOpen = false,
}: ToolResultBlockProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { color, font, fontSize, fontWeight, stroke, spacing } = tokens;

  const badgeBg = isError ? color.dangerBg : color.successBg;
  const badgeLabel = isError ? "ERREUR" : "OK";

  return (
    <div
      data-testid="tool-result-block"
      style={{
        border: `${stroke.base} solid ${color.ink}`,
        background: color.surface,
        margin: `${spacing[1]} 0`,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        data-testid="tool-result-toggle"
        aria-expanded={isOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          width: "100%",
          padding: `${spacing[1]} ${spacing[2]}`,
          background: color.paper,
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
        <span>Resultat</span>
        <span
          data-testid="tool-result-badge"
          style={{
            marginLeft: "auto",
            padding: "1px 6px",
            border: `${stroke.hair} solid ${color.ink}`,
            background: badgeBg,
            fontFamily: font.mono,
            fontSize: fontSize.xs,
            letterSpacing: "0.04em",
          }}
        >
          {badgeLabel}
        </span>
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
          {content}
        </pre>
      )}
    </div>
  );
}
