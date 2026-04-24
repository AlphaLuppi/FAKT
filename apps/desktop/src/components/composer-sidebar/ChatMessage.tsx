/**
 * ChatMessage - composant d'affichage d'un message assistant ou user.
 *
 * Itere sur `message.blocks[]` et rend chaque bloc avec le composant adapte :
 *   - text       -> ChatMessageContent (markdown + HTML + SVG)
 *   - thinking   -> ThinkingBlock (carte repliable)
 *   - tool_use   -> ToolUseBlock (carte repliable avec JSON)
 *   - tool_result-> ToolResultBlock (carte repliable avec badge OK/ERREUR)
 *
 * Pour un message user, on affiche juste le texte brut (pas de markdown, les
 * users tapent du plain text). Le timestamp est affiche en dessous, police
 * mono.
 */

import { tokens } from "@fakt/design-tokens";
import type { ReactElement } from "react";
import { ChatMessageContent } from "./ChatMessageContent.js";
import { ExecutionTrace } from "./ExecutionTrace.js";
import { StreamingStatus } from "./StreamingStatus.js";
import { StreamingText } from "./StreamingText.js";
import type { ChatBlock, ChatMessageRich } from "./useChatStream.js";

type ExecBlock = Exclude<ChatBlock, { type: "text" }>;
type RenderItem =
  | { kind: "text"; block: Extract<ChatBlock, { type: "text" }>; idx: number }
  | { kind: "trace"; blocks: ExecBlock[]; startIdx: number };

/** Regroupe les blocs non-text consécutifs en une seule "trace" accordéon. */
function groupBlocks(blocks: ChatBlock[]): RenderItem[] {
  const items: RenderItem[] = [];
  let currentTrace: ExecBlock[] = [];
  let traceStartIdx = 0;
  blocks.forEach((b, i) => {
    if (b.type === "text") {
      if (currentTrace.length > 0) {
        items.push({ kind: "trace", blocks: currentTrace, startIdx: traceStartIdx });
        currentTrace = [];
      }
      items.push({ kind: "text", block: b, idx: i });
    } else {
      if (currentTrace.length === 0) traceStartIdx = i;
      currentTrace.push(b);
    }
  });
  if (currentTrace.length > 0) {
    items.push({ kind: "trace", blocks: currentTrace, startIdx: traceStartIdx });
  }
  return items;
}

interface ChatMessageProps {
  message: ChatMessageRich;
  timestamp: string;
}

function renderTextBlock(
  block: Extract<ChatBlock, { type: "text" }>,
  key: string,
  streaming: boolean
): ReactElement {
  // Pendant le streaming : typewriter (texte brut, pre-wrap).
  // A la fin : markdown complet avec coloration + SVG + tables.
  return streaming ? (
    <StreamingText key={key} text={block.text} streaming={streaming} />
  ) : (
    <ChatMessageContent key={key} content={block.text} />
  );
}

export function ChatMessage({ message, timestamp }: ChatMessageProps): ReactElement {
  const isUser = message.role === "user";
  const { color, font, fontSize, stroke, spacing } = tokens;

  // User : affichage simple texte (pas de markdown, juste pre-wrap)
  if (isUser) {
    const rawText = message.blocks
      .filter((b): b is Extract<ChatBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return (
      <div
        data-testid="composer-msg-user"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: spacing[1],
        }}
      >
        <div
          style={{
            maxWidth: "85%",
            border: `${stroke.hair} solid ${color.ink}`,
            background: color.accentSoft,
            padding: `${spacing[2]} ${spacing[3]}`,
            fontFamily: font.ui,
            fontSize: fontSize.sm,
            color: color.ink,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {rawText}
        </div>
        <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: color.muted }}>
          {timestamp}
        </div>
      </div>
    );
  }

  // Assistant : iterer sur les blocs
  return (
    <div
      data-testid="composer-msg-assistant"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: spacing[1],
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          width: "100%",
          border: `${stroke.hair} solid ${color.ink}`,
          background: color.paper,
          padding: `${spacing[2]} ${spacing[3]}`,
          fontFamily: font.ui,
          fontSize: fontSize.sm,
          color: color.ink,
          wordBreak: "break-word",
        }}
      >
        {groupBlocks(message.blocks).map((item) => {
          if (item.kind === "text") {
            return renderTextBlock(
              item.block,
              `${message.id}-b${item.idx}`,
              message.streaming
            );
          }
          return (
            <ExecutionTrace
              key={`${message.id}-trace${item.startIdx}`}
              idKey={`${message.id}-trace${item.startIdx}`}
              blocks={item.blocks}
              streaming={message.streaming}
            />
          );
        })}
        {message.streaming && message.blocks.length > 0 && (
          <span
            data-testid="streaming-cursor"
            style={{
              display: "inline-block",
              width: 6,
              height: 14,
              background: color.ink,
              marginLeft: 4,
              verticalAlign: "middle",
              animation: "blink 1s steps(2) infinite",
            }}
          >
            {" "}
          </span>
        )}
        {message.streaming && <StreamingStatus />}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: color.muted }}>
        {timestamp}
      </div>
    </div>
  );
}
