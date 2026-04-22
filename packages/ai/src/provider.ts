/**
 * Core AI provider interface for FAKT.
 *
 * Constraint (architecture §8): subprocess-only in v0.1. This interface is
 * intentionally swapable — a future ClaudeAgentSdkProvider v0.2 must be
 * drop-in without touching any consumer.
 *
 * No consumer outside packages/ai imports a concrete provider class.
 */

// ─── Domain types ────────────────────────────────────────────────────────────

export interface ExtractedQuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  unit: "hour" | "day" | "forfait" | "unit";
}

export interface ExtractedClient {
  name: string;
  email?: string;
  address?: string;
  phone?: string;
  siret?: string;
}

export interface ExtractedQuote {
  client: ExtractedClient;
  items: ExtractedQuoteItem[];
  /** ISO date string (YYYY-MM-DD) */
  validUntil?: string;
  notes?: string;
  depositPercent?: number;
}

export interface EmailContext {
  clientName: string;
  /** Amount in cents */
  amountCents: number;
  /** ISO date string */
  dueDate: string;
  docNumber: string;
  docType: "quote" | "invoice";
  tone: "formal" | "friendly";
}

// ─── Streaming events ─────────────────────────────────────────────────────────

/**
 * Generic streaming event emitted by every provider method.
 *
 * - `delta`: partial data arriving token by token (UI renders incrementally).
 * - `done`: final validated result.
 * - `error`: unrecoverable failure; stream terminates.
 */
export type AiStreamEvent<T> =
  | { type: "delta"; data: Partial<T> }
  | { type: "done"; data: T }
  | { type: "error"; message: string };

// ─── Health check ─────────────────────────────────────────────────────────────

export interface CliInfo {
  installed: boolean;
  version?: string;
  /** Absolute path to the `claude` binary, if found. */
  path?: string;
  /**
   * OS-specific installation instructions shown in the UI when CLI is absent.
   * Never throws — returns installHint instead of crashing.
   */
  installHint?: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface ExtractOpts {
  /** Workspace context injected into the prompt (workspace name, SIRET…) */
  workspaceContext?: string;
  /** Abort signal to cancel an in-flight stream. */
  signal?: AbortSignal;
}

export interface DraftOpts {
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DocContext {
  docType: "quote" | "invoice";
  number: string;
  clientName: string;
  amountCents: number;
  status: string;
}

export interface ChatOpts {
  context?: DocContext;
  signal?: AbortSignal;
}

// ─── Provider interface ───────────────────────────────────────────────────────

/**
 * Stable contract every AI backend must implement.
 *
 * Swapability rule: all consumers call getAi() and type-hint against
 * AiProvider — never against ClaudeCliProvider or any other concrete class.
 */
export interface AiProvider {
  /**
   * Extracts a structured quote from a plain-text client brief.
   * Streams partial ExtractedQuote as tokens arrive.
   */
  extractQuoteFromBrief(
    brief: string,
    opts?: ExtractOpts
  ): AsyncIterable<AiStreamEvent<ExtractedQuote>>;

  /**
   * Drafts an email body for the given document context.
   * Streams string chunks.
   */
  draftEmail(context: EmailContext, opts?: DraftOpts): AsyncIterable<AiStreamEvent<string>>;

  /**
   * General-purpose chat for the Composer sidebar.
   * Streams string deltas token by token.
   */
  chat(messages: ChatMessage[], opts?: ChatOpts): AsyncIterable<AiStreamEvent<string>>;

  /**
   * Returns CLI availability info without throwing.
   * FR-003: used in onboarding wizard + settings.
   */
  healthCheck(): Promise<CliInfo>;
}
