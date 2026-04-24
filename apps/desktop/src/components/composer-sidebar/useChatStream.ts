/**
 * useChatStream - hook streaming pour le Composer IA.
 *
 * Responsabilites :
 * 1. Router chaque AiStreamEvent vers la bonne structure de bloc
 *    (text | thinking | tool_use | tool_result). Les deltas et les events
 *    structurés (thinking_delta, tool_use_*, tool_result) sont acheminés par
 *    le provider CLI (`packages/ai/src/providers/claude-cli.ts`) depuis le
 *    stream-json de Claude CLI. Le provider Mock emet `data: string`
 *    directement pour les tests.
 *
 * 2. Extraire proprement la string du delta : historique - le composer faisait
 *    `String(event.data)` qui produit `"[object Object]"` pour un payload
 *    object, d'ou l'affichage `[object Object][object Object]...` qui flippait
 *    en markdown propre au moment du `done`.
 *
 * 3. Accumuler les chunks par bloc :
 *      - thinking_delta → concat dans le dernier ThinkingBlock (en crée un
 *        si le bloc précédent n'est pas de type thinking).
 *      - tool_use_start → nouveau ToolUseBlock avec input = "" (string, on
 *        accumule le JSON partiel avant parse).
 *      - tool_use_delta → append partialJson au ToolUseBlock matching id.
 *      - tool_use_stop → tente JSON.parse(input) et remplace par l'objet
 *        (fallback : garde la string pour debug).
 *      - tool_result → nouveau ToolResultBlock.
 *      - delta text → concat dans le dernier TextBlock.
 *
 * Swapability : respecte le contrat AiProvider (voir architecture section 8).
 */

import type { AiStreamEvent, ChatMessage, ChatOpts } from "@fakt/ai";
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

/**
 * Applique un `AiStreamEvent<string>` sur un tableau de blocks et retourne
 * le nouveau tableau. Pure : ne modifie pas l'entrée.
 *
 * Contrat :
 *   - delta (text)           → append au dernier TextBlock (ou en crée un)
 *   - thinking_delta         → append au dernier ThinkingBlock (ou nouveau)
 *   - tool_use_start         → nouveau ToolUseBlock { input: "" }
 *   - tool_use_delta         → append partialJson à l'input (string) du
 *                              ToolUseBlock matching id
 *   - tool_use_stop          → parse JSON final ou garde la string si invalide
 *   - tool_result            → nouveau ToolResultBlock
 *   - done / error           → aucune mutation ici (géré dans le hook)
 *
 * Retourne `null` si l'event n'implique pas de mutation de blocks (done /
 * error / event inconnu) — l'appelant gère alors la finalisation.
 */
export function applyStreamEventToBlocks(
  blocks: ChatBlock[],
  event: AiStreamEvent<string>
): { blocks: ChatBlock[]; textAccumulator?: string } | null {
  if (event.type === "delta") {
    const chunk = extractDeltaText(event.data);
    if (!chunk) return null;
    const next = [...blocks];
    const last = next[next.length - 1];
    if (last && last.type === "text") {
      next[next.length - 1] = { type: "text", text: last.text + chunk };
    } else {
      next.push({ type: "text", text: chunk });
    }
    const textAccumulator = next
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { blocks: next, textAccumulator };
  }

  if (event.type === "thinking_delta") {
    const next = [...blocks];
    const last = next[next.length - 1];
    if (last && last.type === "thinking") {
      next[next.length - 1] = { type: "thinking", thinking: last.thinking + event.text };
    } else {
      next.push({ type: "thinking", thinking: event.text });
    }
    return { blocks: next };
  }

  if (event.type === "tool_use_start") {
    // `input` commence comme string (accumulateur JSON). Le parse final est
    // fait dans tool_use_stop. Cela permet de streamer même un JSON invalide
    // sans crasher la vue.
    return {
      blocks: [...blocks, { type: "tool_use", id: event.id, name: event.name, input: "" }],
    };
  }

  if (event.type === "tool_use_delta") {
    const next = blocks.map((b) => {
      if (b.type !== "tool_use") return b;
      if (b.id !== event.id && event.id !== "") return b;
      // id vide = fallback sur le DERNIER tool_use (le parser Rust peut
      // envoyer un delta sans id si le content_block_start a été raté).
      if (event.id === "" && !isLastToolUse(blocks, b)) return b;
      const current = typeof b.input === "string" ? b.input : JSON.stringify(b.input ?? "");
      return { ...b, input: current + event.partialJson };
    });
    return { blocks: next };
  }

  if (event.type === "tool_use_stop") {
    const next = blocks.map((b) => {
      if (b.type !== "tool_use" || b.id !== event.id) return b;
      if (typeof b.input !== "string") return b;
      // Tente le parse JSON. Si le modèle n'a pas fini d'émettre (stream
      // coupé) on garde la string pour que la pretty-print JSON fallback
      // sur l'input brut.
      try {
        return { ...b, input: JSON.parse(b.input) as unknown };
      } catch {
        return b;
      }
    });
    return { blocks: next };
  }

  if (event.type === "tool_result") {
    return {
      blocks: [
        ...blocks,
        {
          type: "tool_result",
          toolUseId: event.toolUseId,
          content: event.content,
          isError: event.isError,
        },
      ],
    };
  }

  return null;
}

function isLastToolUse(blocks: ChatBlock[], candidate: ToolUseBlock): boolean {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b && b.type === "tool_use") {
      return b === candidate;
    }
  }
  return false;
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

        for await (const event of ai.chat(fullHistory, chatOpts)) {
          if (controller.signal.aborted) break;

          if (event.type === "done") {
            // Le `done` peut arriver vide (ex : toute la réponse était du
            // thinking + tool_use + re-thinking sans text final côté CLI).
            // Dans ce cas on garde les blocks déjà streamés ; sinon on
            // remplace le dernier bloc text par la version finale propre.
            const final = extractFinalText(event.data, textAcc);
            let finalBlocks = assistantMsg.blocks;
            if (final.length > 0) {
              // Cherche le dernier TextBlock à écraser ; sinon on append.
              let lastTextIdx = -1;
              for (let i = finalBlocks.length - 1; i >= 0; i--) {
                const b = finalBlocks[i];
                if (b && b.type === "text") {
                  lastTextIdx = i;
                  break;
                }
              }
              if (lastTextIdx === -1) {
                finalBlocks = [...finalBlocks, { type: "text", text: final }];
              } else {
                finalBlocks = finalBlocks.map((b, i) =>
                  i === lastTextIdx ? { type: "text", text: final } : b
                );
              }
            }
            const finalMsg: ChatMessageRich = {
              ...assistantMsg,
              blocks: finalBlocks,
              streaming: false,
            };
            onAssistantDone?.(finalMsg);
            break;
          }

          if (event.type === "error") {
            const finalMsg: ChatMessageRich = {
              ...assistantMsg,
              blocks: [{ type: "text", text: `Erreur : ${event.message}` }],
              streaming: false,
            };
            onAssistantDone?.(finalMsg);
            break;
          }

          const applied = applyStreamEventToBlocks(assistantMsg.blocks, event);
          if (applied === null) continue;
          assistantMsg.blocks = applied.blocks;
          if (applied.textAccumulator !== undefined) {
            textAcc = applied.textAccumulator;
          }
          onAssistantUpdate?.({ ...assistantMsg });
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
