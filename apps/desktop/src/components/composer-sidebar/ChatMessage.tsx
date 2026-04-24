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
import { StreamingText } from "./StreamingText.js";
import { ThinkingBlock } from "./ThinkingBlock.js";
import { ToolResultBlock } from "./ToolResultBlock.js";
import { ToolUseBlock } from "./ToolUseBlock.js";
import type { ChatBlock, ChatMessageRich } from "./useChatStream.js";

interface ChatMessageProps {
  message: ChatMessageRich;
  timestamp: string;
}

function renderBlock(block: ChatBlock, key: string, streaming: boolean): ReactElement {
  switch (block.type) {
    case "text":
      // Pendant le streaming : typewriter (texte brut, pre-wrap).
      // A la fin : markdown complet avec coloration + SVG + tables.
      return streaming ? (
        <StreamingText key={key} text={block.text} streaming={streaming} />
      ) : (
        <ChatMessageContent key={key} content={block.text} />
      );
    case "thinking":
      return <ThinkingBlock key={key} thinking={block.thinking} streaming={streaming} />;
    case "tool_use":
      return <ToolUseBlock key={key} name={block.name} input={block.input} streaming={streaming} />;
    case "tool_result":
      return <ToolResultBlock key={key} content={block.content} isError={block.isError} />;
  }
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
        {message.blocks.length === 0 && message.streaming && (
          <div
            data-testid="msg-loading"
            style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: color.muted }}
          >
            ...
          </div>
        )}
        {message.blocks.map((block, idx) =>
          renderBlock(block, `${message.id}-b${idx}`, message.streaming)
        )}
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
      </div>
      <div style={{ fontFamily: font.mono, fontSize: fontSize.xs, color: color.muted }}>
        {timestamp}
      </div>
    </div>
  );
}
