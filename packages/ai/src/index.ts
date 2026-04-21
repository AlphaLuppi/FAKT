/**
 * Public API of @fakt/ai.
 *
 * SWAPABILITY CONTRACT:
 * Consumers MUST call getAi() / setAi() and type-hint against AiProvider.
 * They MUST NOT import ClaudeCliProvider or MockAiProvider directly.
 * This ensures v0.2 SDK swap is transparent to all consumers.
 */

export type {
  AiProvider,
  AiStreamEvent,
  ChatMessage,
  ChatOpts,
  CliInfo,
  DocContext,
  DraftOpts,
  EmailContext,
  ExtractOpts,
  ExtractedClient,
  ExtractedQuote,
  ExtractedQuoteItem,
} from "./provider.ts";

export { healthCheck } from "./health.ts";

// ─── Provider registry (singleton) ───────────────────────────────────────────

import type { AiProvider } from "./provider.ts";
import { ClaudeCliProvider } from "./providers/claude-cli.ts";
import { MockAiProvider } from "./providers/mock.ts";

let _provider: AiProvider | null = null;

/**
 * Returns the active AiProvider.
 * Lazily initialises to ClaudeCliProvider in production,
 * or MockAiProvider when FAKT_AI_PROVIDER=mock.
 *
 * CI usage: set FAKT_AI_PROVIDER=mock before running tests.
 */
export function getAi(): AiProvider {
  if (_provider !== null) return _provider;

  const envMode =
    typeof process !== "undefined"
      ? process.env["FAKT_AI_PROVIDER"]
      : undefined;

  _provider = envMode === "mock" ? new MockAiProvider() : new ClaudeCliProvider();
  return _provider;
}

/**
 * Replaces the active provider (test injection / settings toggle).
 * Pass null to reset to the environment-default provider on next getAi() call.
 */
export function setAi(provider: AiProvider | null): void {
  _provider = provider;
}
