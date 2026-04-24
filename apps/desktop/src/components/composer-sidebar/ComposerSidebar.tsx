import { getAi } from "@fakt/ai";
import type { ChatMessage, DocContext } from "@fakt/ai";
import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { ChatMessageContent } from "./ChatMessageContent.js";
import { useComposerSidebar } from "./ComposerContext.js";
import { extractDeltaText, extractFinalText } from "./useChatStream.js";
import "highlight.js/styles/github-dark.css";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming: boolean;
  at: number;
}

function formatTimestamp(at: number): string {
  const diffMs = Date.now() - at;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  if (diffMs < 10000) return fr.composer.timestampJustNow;
  if (diffMin < 60) return fr.composer.timestampMinutesAgo(diffMin);
  return fr.composer.timestampHoursAgo(diffH);
}

function useDocContextFromRoute(): DocContext | null {
  const location = useLocation();
  const match = /^\/(quotes|invoices)\/([^/]+)$/.exec(location.pathname);
  if (!match) return null;
  const docType = match[1] === "quotes" ? ("quote" as const) : ("invoice" as const);
  return { docType, number: match[2] ?? "", clientName: "", amountCents: 0, status: "" };
}

const SUGGESTIONS = [
  fr.composer.suggestions.relance,
  fr.composer.suggestions.addDev,
  fr.composer.suggestions.resume,
] as const;

export function ComposerSidebar(): ReactElement {
  const { isOpen, close, pendingContext, pendingMessage, clearPending } = useComposerSidebar();
  const routeContext = useDocContextFromRoute();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeContext: DocContext | null = pendingContext ?? (contextEnabled ? routeContext : null);

  useEffect(() => {
    if (pendingMessage) {
      setInput(pendingMessage);
      clearPending();
    }
  }, [pendingMessage, clearPending]);

  // Auto-scroll intelligent : ne bondit en bas que si l'user était déjà
  // "near bottom" avant le dernier render. Évite de ré-écraser le scroll
  // quand l'user remonte pour lire les anciens messages pendant un streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || streaming) return;
      const userMsg: DisplayMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
        streaming: false,
        at: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setStreaming(true);
      const assistantMsgId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "", streaming: true, at: Date.now() },
      ]);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text.trim() },
      ];
      try {
        const ai = getAi();
        let accumulated = "";
        const chatOpts = activeContext
          ? { context: activeContext, signal: controller.signal }
          : { signal: controller.signal };
        for await (const event of ai.chat(history, chatOpts)) {
          if (event.type === "delta") {
            // Historique - `String(event.data)` produisait "[object Object]" quand
            // le provider CLI Rust envoie `data: { text: "..." }`. On route
            // proprement via `extractDeltaText` qui gere mock (string) + CLI
            // (object) + Anthropic SDK (delta.text / delta.thinking).
            const delta = extractDeltaText(event.data);
            if (!delta) continue;
            accumulated += delta;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
            );
          } else if (event.type === "done") {
            const final = extractFinalText(event.data, accumulated);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: final, streaming: false } : m
              )
            );
            break;
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: `Erreur : ${event.message}`, streaming: false }
                  : m
              )
            );
            break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: `Erreur : ${msg}`, streaming: false } : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming, activeContext]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  const handleReset = useCallback((): void => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
  }, []);

  const handleCancel = useCallback((): void => {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }, []);

  if (!isOpen) return <></>;

  const ink = tokens.color.ink;
  const surface = tokens.color.surface;
  const paper = tokens.color.paper;
  const accent = tokens.color.accentSoft;
  const muted = tokens.color.muted;
  const danger = tokens.color.dangerBg;
  const bold = tokens.stroke.bold;
  const base = tokens.stroke.base;
  const hair = tokens.stroke.hair;
  const s2 = tokens.spacing[2];
  const s3 = tokens.spacing[3];
  const s4 = tokens.spacing[4];
  const s5 = tokens.spacing[5];
  const fxs = tokens.fontSize.xs;
  const fsm = tokens.fontSize.sm;
  const fmd = tokens.fontSize.md;
  const wBold = Number(tokens.fontWeight.bold);
  const wBlack = Number(tokens.fontWeight.black);
  const fontUi = tokens.font.ui;
  const fontMono = tokens.font.mono;

  const disabledSend = streaming || !input.trim();

  return (
    <div
      data-testid="composer-sidebar"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 400,
        height: "100vh",
        background: surface,
        borderLeft: `${bold} solid ${ink}`,
        boxShadow: tokens.shadow.base,
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${s3} ${s4}`,
          borderBottom: `${base} solid ${ink}`,
          display: "flex",
          alignItems: "center",
          gap: s3,
          background: surface,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            fontFamily: fontUi,
            fontSize: fsm,
            fontWeight: wBlack,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            color: ink,
          }}
        >
          {fr.composer.title}
        </div>
        <button
          type="button"
          onClick={handleReset}
          data-testid="composer-reset"
          style={{
            padding: "4px 8px",
            border: `${hair} solid ${ink}`,
            background: "transparent",
            fontFamily: fontUi,
            fontSize: fxs,
            fontWeight: wBold,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: muted,
            cursor: "pointer",
          }}
        >
          {fr.composer.reset}
        </button>
        <button
          type="button"
          onClick={close}
          data-testid="composer-close"
          aria-label="Fermer"
          style={{
            width: 28,
            height: 28,
            border: `${base} solid ${ink}`,
            background: surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontFamily: fontUi,
            fontSize: fmd,
            color: ink,
          }}
        >
          x
        </button>
      </div>

      {/* Context bar */}
      {(activeContext ?? routeContext) && (
        <div
          style={{
            padding: `${s2} ${s4}`,
            borderBottom: `${hair} solid ${ink}`,
            display: "flex",
            alignItems: "center",
            gap: s2,
            background: contextEnabled ? accent : paper,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: fontUi,
              fontSize: fxs,
              fontWeight: wBold,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: ink,
              flex: 1,
            }}
          >
            {contextEnabled && activeContext
              ? `${fr.composer.contextActive} : ${activeContext.docType === "quote" ? "D" : "F"}${activeContext.number}`
              : fr.composer.contextDisabled}
          </span>
          <button
            type="button"
            onClick={() => setContextEnabled((v) => !v)}
            style={{
              padding: "2px 6px",
              border: `${hair} solid ${ink}`,
              background: "transparent",
              fontFamily: fontUi,
              fontSize: fxs,
              fontWeight: wBold,
              textTransform: "uppercase",
              color: ink,
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            {contextEnabled ? fr.composer.contextToggle : fr.composer.contextLabel}
          </button>
        </div>
      )}

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: s4,
          display: "flex",
          flexDirection: "column",
          gap: s3,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: muted,
              fontFamily: fontUi,
              fontSize: fsm,
              textAlign: "center",
              marginTop: s5,
            }}
          >
            {fr.composer.placeholder}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div
          style={{
            padding: `${s2} ${s4}`,
            borderTop: `${hair} solid ${ink}`,
            display: "flex",
            flexWrap: "wrap",
            gap: s2,
            flexShrink: 0,
          }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void sendMessage(s)}
              style={{
                padding: "4px 10px",
                border: `${hair} solid ${ink}`,
                background: paper,
                fontFamily: fontUi,
                fontSize: fxs,
                color: ink,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          borderTop: `${bold} solid ${ink}`,
          padding: s3,
          display: "flex",
          flexDirection: "column",
          gap: s2,
          flexShrink: 0,
          background: surface,
        }}
      >
        {streaming && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleCancel}
              data-testid="composer-cancel"
              style={{
                padding: "4px 10px",
                border: `${hair} solid ${ink}`,
                background: danger,
                fontFamily: fontUi,
                fontSize: fxs,
                fontWeight: wBold,
                textTransform: "uppercase",
                color: ink,
                cursor: "pointer",
              }}
            >
              {fr.composer.cancel}
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: s2 }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={fr.composer.placeholder}
            disabled={streaming}
            data-testid="composer-input"
            rows={3}
            style={{
              flex: 1,
              border: `${base} solid ${ink}`,
              background: surface,
              fontFamily: fontUi,
              fontSize: fsm,
              color: ink,
              padding: s2,
              resize: "none",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={disabledSend}
            data-testid="composer-send"
            style={{
              padding: `${s2} ${s3}`,
              border: `${bold} solid ${ink}`,
              background: disabledSend ? paper : ink,
              color: disabledSend ? muted : accent,
              fontFamily: fontUi,
              fontSize: fxs,
              fontWeight: wBlack,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: disabledSend ? "not-allowed" : "pointer",
              alignSelf: "flex-end",
              height: 40,
            }}
          >
            {fr.composer.send}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }): ReactElement {
  const isUser = message.role === "user";
  return (
    <div
      data-testid={`composer-msg-${message.role}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: tokens.spacing[1],
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
          background: isUser ? tokens.color.accentSoft : tokens.color.paper,
          padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          color: tokens.color.ink,
          wordBreak: "break-word",
        }}
      >
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
        ) : (
          <ChatMessageContent content={message.content} />
        )}
        {message.streaming && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 14,
              background: tokens.color.ink,
              marginLeft: 4,
              verticalAlign: "middle",
            }}
          >
            {" "}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize.xs,
          color: tokens.color.muted,
        }}
      >
        {formatTimestamp(message.at)}
      </div>
    </div>
  );
}
