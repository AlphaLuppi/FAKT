/**
 * useChatStream - hook streaming pour le Composer IA.
 *
 * Responsabilites :
 * 1. Router chaque AiStreamEvent vers la bonne structure de bloc
 *    (text | thinking | tool_use | tool_result). Le provider CLI emet des
 *    deltas sous la forme `{ type:"delta", data: { text: string } }`
 *    (cf. packages/ai/src/providers/claude-cli.ts). Le provider Mock et
 *    certains tests emettent `data: string` directement. Ce hook gere les
 *    deux formats de facon totalement transparente.
 *
 * 2. Extraire proprement la string du delta : historique - le composer faisait
 *    `String(event.data)` qui produit `"[object Object]"` pour un payload
 *    object, d'ou l'affichage `[object Object][object Object]...` qui flippait
 *    en markdown propre au moment du `done`.
 *
 * 3. Preparer la structure par blocs pour les evolutions (thinking / tool_use)
 *    meme si pour l'instant on ne recoit que du texte - l'API reste stable
 *    quand on branchera les blocs Claude Desktop.
 *
 * Swapability : respecte le contrat AiProvider (voir architecture section 8).
 */

import type { ChatMessage, ChatOpts } from "@fakt/ai";
import { getAi } from "@fakt/ai";
import { useCallback, useRef, useState } from "react";

// --- Types ------------------------------------------------------------------

/** Bloc texte markdown / HTML. */
export interface TextBlock {
  type: "text";
  text: string;
}

/** Bloc "thinking" (raisonnement extended thinking Claude). */
export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

/** Bloc d'appel outil (MCP). */
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  /** JSON input partiellement recu pendant le stream, complet a la fin. */
  input: unknown;
}

/** Bloc resultat d'outil (MCP retour). */
export interface ToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError: boolean;
}

export type ChatBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessageRich {
  id: string;
  role: "user" | "assistant";
  blocks: ChatBlock[];
  streaming: boolean;
  at: number;
}

// --- Helpers ----------------------------------------------------------------

/**
 * Extrait la string d'un delta SSE quel que soit son format.
 *
 * Formats supportes :
 *   - "bonjour" (string brut - mock provider, tests)
 *   - { text: "bonjour" } (object avec champ text - CLI provider Rust/Token)
 *   - { delta: { text: "bonjour" } } (forme imbriquee Anthropic SDK)
 *   - { delta: { thinking: "..." } } / { delta: { partial_json: "..." } }
 *     renvoie les bons champs pour routage ulterieur.
 *
 * Retourne "" si aucun champ texte exploitable n'est trouve (jamais
 * "[object Object]" - c'etait le bug historique).
 */
export function extractDeltaText(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean") return String(data);
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (obj.delta && typeof obj.delta === "object") {
      const delta = obj.delta as Record<string, unknown>;
      if (typeof delta.text === "string") return delta.text;
      if (typeof delta.thinking === "string") return delta.thinking;
      if (typeof delta.partial_json === "string") return delta.partial_json;
    }
    return "";
  }
  return "";
}

/**
 * Extrait la string "final" d'un event `done`. Le champ peut etre soit le
 * texte brut (mock), soit un object avec text / result (CLI).
 */
export function extractFinalText(data: unknown, fallback: string): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.result === "string") return obj.result;
  }
  return fallback;
}

// --- Hook -------------------------------------------------------------------

export interface UseChatStreamOptions {
  onUserMessage?: (msg: ChatMessageRich) => void;
  onAssistantUpdate?: (msg: ChatMessageRich) => void;
  onAssistantDone?: (msg: ChatMessageRich) => void;
  onError?: (err: Error) => void;
}

export interface UseChatStreamReturn {
  isStreaming: boolean;
  send: (text: string, history: ChatMessage[], opts?: ChatOpts) => Promise<void>;
  cancel: () => void;
}

export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { onUserMessage, onAssistantUpdate, onAssistantDone, onError } = options;

  const send = useCallback(
    async (text: string, history: ChatMessage[], opts?: ChatOpts): Promise<void> => {
      if (!text.trim() || isStreaming) return;

      const trimmed = text.trim();
      const now = Date.now();

      const userMsg: ChatMessageRich = {
        id: `u-${now}`,
        role: "user",
        blocks: [{ type: "text", text: trimmed }],
        streaming: false,
        at: now,
      };
      onUserMessage?.(userMsg);

      const assistantId = `a-${now}`;
      const assistantMsg: ChatMessageRich = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        streaming: true,
        at: now,
      };
      onAssistantUpdate?.(assistantMsg);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      const chatOpts: ChatOpts = { ...opts, signal: controller.signal };
      const fullHistory: ChatMessage[] = [...history, { role: "user", content: trimmed }];

      try {
        const ai = getAi();
        let textAcc = "";
        let textBlockIdx = -1;

        for await (const event of ai.chat(fullHistory, chatOpts)) {
          if (controller.signal.aborted) break;

          if (event.type === "delta") {
            const chunk = extractDeltaText(event.data);
            if (!chunk) continue;
            textAcc += chunk;
            if (textBlockIdx === -1) {
              assistantMsg.blocks = [...assistantMsg.blocks, { type: "text", text: textAcc }];
              textBlockIdx = assistantMsg.blocks.length - 1;
            } else {
              const nextBlocks = [...assistantMsg.blocks];
              nextBlocks[textBlockIdx] = { type: "text", text: textAcc };
              assistantMsg.blocks = nextBlocks;
            }
            onAssistantUpdate?.({ ...assistantMsg });
          } else if (event.type === "done") {
            const final = extractFinalText(event.data, textAcc);
            const finalBlocks: ChatBlock[] =
              textBlockIdx === -1
                ? [{ type: "text", text: final }]
                : assistantMsg.blocks.map((b, i) =>
                    i === textBlockIdx ? { type: "text", text: final } : b
                  );
            const finalMsg: ChatMessageRich = {
              ...assistantMsg,
              blocks: finalBlocks,
              streaming: false,
            };
            onAssistantDone?.(finalMsg);
            break;
          } else if (event.type === "error") {
            const finalMsg: ChatMessageRich = {
              ...assistantMsg,
              blocks: [{ type: "text", text: `Erreur : ${event.message}` }],
              streaming: false,
            };
            onAssistantDone?.(finalMsg);
            break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const errMsg: ChatMessageRich = {
          ...assistantMsg,
          blocks: [{ type: "text", text: `Erreur : ${msg}` }],
          streaming: false,
        };
        onAssistantDone?.(errMsg);
        onError?.(err instanceof Error ? err : new Error(msg));
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, onUserMessage, onAssistantUpdate, onAssistantDone, onError]
  );

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, send, cancel };
}
