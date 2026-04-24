/**
 * ThinkingBlock - carte repliable pour l'extended thinking (raisonnement Claude).
 *
 * Style Claude Desktop : header "THINKING" + chevron, contenu texte mono gris
 * replie par defaut. Mise en forme Brutal Invoice : fond blanc, border 2px
 * noir, typo mono JetBrains pour le corps, header Space Grotesk UPPERCASE.
 */

import { tokens } from "@fakt/design-tokens";
import { type ReactElement, useState } from "react";

interface ThinkingBlockProps {
  thinking: string;
  /** Si true, affiche un indicateur "..." pour signaler un stream en cours. */
  streaming?: boolean;
  /** Ouvert par defaut (utile pour les demos). */
  defaultOpen?: boolean;
}

export function ThinkingBlock({
  thinking,
  streaming = false,
  defaultOpen = false,
}: ThinkingBlockProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { color, font, fontSize, fontWeight, stroke, spacing } = tokens;

  return (
    <div
      data-testid="thinking-block"
      style={{
        border: `${stroke.base} solid ${color.ink}`,
        background: color.surface,
        margin: `${spacing[1]} 0`,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        data-testid="thinking-toggle"
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
        <span>Thinking</span>
        {streaming && (
          <span
            data-testid="thinking-loading"
            style={{ fontFamily: font.mono, marginLeft: "auto" }}
          >
            ...
          </span>
        )}
      </button>
      {isOpen && (
        <div
          style={{
            padding: spacing[2],
            fontFamily: font.mono,
            fontSize: fontSize.xs,
            color: color.ink3,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.5,
          }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
}
