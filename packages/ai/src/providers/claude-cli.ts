/**
 * ClaudeCliProvider — AiProvider backed by the Claude Code CLI subprocess.
 *
 * Architecture rule (§8): subprocess only in v0.1. The Rust side
 * (src-tauri/src/ai/cli.rs) spawns `claude -p --output-format stream-json`
 * via tokio::process::Command and pipes stdout through a Tauri Channel<T>.
 *
 * SECURITY: the Anthropic token is NEVER accessed here.
 * It is managed entirely by the `claude` binary via its own keychain / env.
 * FAKT never logs CLI args in plain text.
 *
 * No code outside packages/ai imports this class directly.
 * Consumers call getAi() from index.ts.
 */

import { healthCheck } from "../health.ts";
import type {
  AiProvider,
  AiStreamEvent,
  ChatMessage,
  ChatOpts,
  CliInfo,
  DraftOpts,
  EmailContext,
  ExtractOpts,
  ExtractedQuote,
} from "../provider.ts";

// ─── Tauri IPC types (mirrored from Rust AiStreamEvent) ──────────────────────

/** Raw events as serialised by the Rust Channel<AiStreamEvent>. */
type RustAiEvent =
  | { type: "token"; text: string }
  | { type: "done"; result: unknown }
  | { type: "error"; message: string };

// ─── Prompt loader ────────────────────────────────────────────────────────────

/**
 * Loads a prompt template from the prompts/ directory.
 * Vite / bundler inlines these at build time via ?raw import.
 * In tests the mock provider is used instead.
 */
async function loadPromptTemplate(name: string): Promise<string> {
  // Dynamic import with ?raw is handled by Vite bundler at build time.
  // The cast to `unknown` first avoids TS2352 — the module shape is known.
  const mod = (await import(`../prompts/${name}.md?raw`)) as unknown as {
    default: string;
  };
  return mod.default;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key as string] ?? "");
}

// ─── Streaming helper ─────────────────────────────────────────────────────────

/**
 * Invokes the Tauri command `spawn_claude` and converts the Channel stream
 * into an AsyncIterable<AiStreamEvent<T>>.
 *
 * The Rust side sends line-by-line JSON events via Channel<AiStreamEvent>.
 * We translate them into the domain-level AiStreamEvent<T> contract.
 */
async function* invokeStream<T>(
  prompt: string,
  signal?: AbortSignal
): AsyncIterable<AiStreamEvent<T>> {
  const { Channel, invoke } = await import("@tauri-apps/api/core");

  const events: Array<AiStreamEvent<T>> = [];
  let resolveNext: (() => void) | null = null;
  let done = false;

  const channel = new Channel<RustAiEvent>();
  channel.onmessage = (event: RustAiEvent) => {
    if (event.type === "token") {
      // Partial<T> is a structural superset — cast via unknown is intentional.
      // Token events carry a text field; consumers treat it as a partial result.
      events.push({ type: "delta", data: { text: event.text } as unknown as Partial<T> });
    } else if (event.type === "done") {
      events.push({ type: "done", data: event.result as T });
      done = true;
    } else if (event.type === "error") {
      events.push({ type: "error", message: event.message });
      done = true;
    }
    resolveNext?.();
    resolveNext = null;
  };

  // Fire-and-forget: invoke returns only after the stream is complete.
  const invocation = invoke("spawn_claude", {
    promptText: prompt,
    channel,
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    events.push({ type: "error", message });
    done = true;
    resolveNext?.();
    resolveNext = null;
  });

  // Drain events as they arrive.
  while (!done || events.length > 0) {
    if (signal?.aborted) {
      yield { type: "error", message: "Opération annulée" };
      return;
    }

    if (events.length === 0) {
      // Park until the channel pushes a new event.
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
      continue;
    }

    const event = events.shift()!;
    yield event;

    if (event.type === "done" || event.type === "error") {
      break;
    }
  }

  // Ensure the invoke promise settles (avoids unhandled rejection).
  await invocation;
}

// ─── Provider class ───────────────────────────────────────────────────────────

export class ClaudeCliProvider implements AiProvider {
  async healthCheck(): Promise<CliInfo> {
    return healthCheck();
  }

  async *extractQuoteFromBrief(
    brief: string,
    opts?: ExtractOpts
  ): AsyncIterable<AiStreamEvent<ExtractedQuote>> {
    const template = await loadPromptTemplate("extract_quote");
    const prompt = renderTemplate(template, {
      brief,
      workspace_context: opts?.workspaceContext ?? "",
    });

    yield* invokeStream<ExtractedQuote>(prompt, opts?.signal);
  }

  async *chat(messages: ChatMessage[], opts?: ChatOpts): AsyncIterable<AiStreamEvent<string>> {
    const template = await loadPromptTemplate("chat");
    const docContext = opts?.context
      ? `${opts.context.docType === "quote" ? "Devis" : "Facture"} ${opts.context.number} pour ${opts.context.clientName}, montant ${(opts.context.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}, statut ${opts.context.status}.`
      : "";
    const history = messages
      .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    const prompt = `${renderTemplate(template, {
      workspace_context: opts?.context?.clientName ? `Client: ${opts.context.clientName}` : "",
      doc_context: docContext,
    })}\n\nHistorique de conversation:\n${history}\n\nAssistant:`;

    yield* invokeStream<string>(prompt, opts?.signal);
  }

  async *draftEmail(context: EmailContext, opts?: DraftOpts): AsyncIterable<AiStreamEvent<string>> {
    const template = await loadPromptTemplate("draft_email");
    const amountEur = (context.amountCents / 100).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
    });
    const prompt = renderTemplate(template, {
      client_name: context.clientName,
      amount: amountEur,
      due_date: context.dueDate,
      doc_number: context.docNumber,
      doc_type: context.docType === "quote" ? "devis" : "facture",
      tone: context.tone,
    });

    yield* invokeStream<string>(prompt, opts?.signal);
  }
}
