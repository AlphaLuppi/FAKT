import { getAi } from "@fakt/ai";
import type { ChatMessage, DocContext } from "@fakt/ai";
import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useVerboseAiMode } from "../../hooks/useVerboseAiMode.js";
import { ChatMessage as ChatMessageView } from "./ChatMessage.js";
import { useComposerSidebar } from "./ComposerContext.js";
import type { ChatBlock, ChatMessageRich } from "./useChatStream.js";
import { applyStreamEventToBlocks, extractFinalText } from "./useChatStream.js";
import "highlight.js/styles/github-dark.css";

/**
 * Helper : concatene tous les blocs texte d'un message en une string unique.
 * Sert a l'historique envoye a Claude - les blocs thinking / tool_* sont
 * meta-data locales, pas reinjectees dans l'API.
 */
function blocksToString(blocks: ChatBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      return "";
    })
    .join("");
}

/**
 * À la réception du `done`, remplace le dernier TextBlock par la version
 * finale (proprement markdownifiée côté CLI) ou append un nouveau bloc si
 * aucun TextBlock n'avait été streamé (ex : message 100% tool_use).
 */
function finalizeBlocksWithText(blocks: ChatBlock[], final: string): ChatBlock[] {
  if (final.length === 0) return blocks;
  let lastTextIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b && b.type === "text") {
      lastTextIdx = i;
      break;
    }
  }
  if (lastTextIdx === -1) {
    return [...blocks, { type: "text", text: final }];
  }
  return blocks.map((b, i) => (i === lastTextIdx ? { type: "text", text: final } : b));
}

/**
 * Filtre les blocs "verbeux" (thinking / tool_use / tool_result) quand
 * l'utilisateur a désactivé le mode verbose IA dans Settings. Conserve
 * toujours les TextBlock et l'ordre d'origine.
 */
function filterVerboseBlocks(blocks: ChatBlock[], verbose: boolean): ChatBlock[] {
  if (verbose) return blocks;
  return blocks.filter((b) => b.type === "text");
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
  const { verbose } = useVerboseAiMode();
  const [messages, setMessages] = useState<ChatMessageRich[]>([]);
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
      const trimmed = text.trim();
      const userMsg: ChatMessageRich = {
        id: `u-${Date.now()}`,
        role: "user",
        blocks: [{ type: "text", text: trimmed }],
        streaming: false,
        at: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setStreaming(true);
      const assistantMsgId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", blocks: [], streaming: true, at: Date.now() },
      ]);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: blocksToString(m.blocks) })),
        { role: "user", content: trimmed },
      ];
      try {
        const ai = getAi();
        let accumulated = "";
        const chatOpts = activeContext
          ? { context: activeContext, signal: controller.signal }
          : { signal: controller.signal };
        // Helper qui remplace la liste de blocs du message assistant courant.
        // On merge la fonction d'update via setMessages et on laisse le
        // helper pur `applyStreamEventToBlocks` gérer le routage text /
        // thinking / tool_use / tool_result.
        const updateBlocks = (mutator: (prev: ChatBlock[]) => ChatBlock[]): void => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, blocks: mutator(m.blocks) } : m))
          );
        };
        const finalizeBlocks = (mutator: (prev: ChatBlock[]) => ChatBlock[]): void => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, blocks: mutator(m.blocks), streaming: false } : m
            )
          );
        };
        for await (const event of ai.chat(history, chatOpts)) {
          if (event.type === "done") {
            const final = extractFinalText(event.data, accumulated);
            finalizeBlocks((blocks) => finalizeBlocksWithText(blocks, final));
            break;
          }
          if (event.type === "error") {
            const msg = event.message;
            finalizeBlocks(() => [{ type: "text", text: `Erreur : ${msg}` }]);
            break;
          }
          updateBlocks((blocks) => {
            const applied = applyStreamEventToBlocks(blocks, event);
            if (applied === null) return blocks;
            if (applied.textAccumulator !== undefined) {
              accumulated = applied.textAccumulator;
            }
            return applied.blocks;
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  blocks: [{ type: "text", text: `Erreur : ${msg}` }],
                  streaming: false,
                }
              : m
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
        // Shadow vers la gauche — side panel qui "flotte" au-dessus du main.
        // Double couche : 1ère dure proche du border, 2e diffuse au loin.
        boxShadow: "-4px 0 0 rgba(0, 0, 0, 0.04), -16px 0 40px rgba(0, 0, 0, 0.12)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
      }}
    >
      {/* Header — aligné verticalement avec le top bar app shell (56px). */}
      <div
        style={{
          height: 56,
          boxSizing: "border-box",
          padding: `0 ${s4}`,
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
            data-testid="composer-context-toggle"
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
        {messages.map((msg) => {
          // Lorsque le mode verbose est OFF, on n'altère pas les données
          // stockées (on pourra rallumer et retrouver les blocs) — on masque
          // juste au rendu en reshape-ant les blocks du message à la volée.
          const displayMsg: ChatMessageRich =
            msg.role === "assistant" && !verbose
              ? { ...msg, blocks: filterVerboseBlocks(msg.blocks, verbose) }
              : msg;
          return (
            <ChatMessageView
              key={msg.id}
              message={displayMsg}
              timestamp={formatTimestamp(msg.at)}
            />
          );
        })}
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
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => void sendMessage(s)}
              data-testid={`composer-suggestion-${i}`}
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
