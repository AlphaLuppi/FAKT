/**
 * MockAiProvider — deterministic test double for CI environments.
 *
 * Reads fixture files from tests/fixtures/*.json instead of spawning the CLI.
 * Activated when FAKT_AI_PROVIDER=mock is set (or in Vitest test context).
 *
 * Every method yields predictable events matching the real provider contract,
 * enabling Vitest coverage without a live Claude CLI token.
 */

import type {
  AiProvider,
  AiStreamEvent,
  CliInfo,
  DraftOpts,
  EmailContext,
  ExtractOpts,
  ExtractedQuote,
} from "../provider.ts";

// ─── Fixture loader ───────────────────────────────────────────────────────────

async function loadFixture<T>(name: string): Promise<T> {
  // In Vitest, we use a dynamic import or a manual map for fixtures.
  // This avoids fs dependency in browser/webview environments.
  const fixtures = await getFixtureMap();
  const data = fixtures[name];
  if (data === undefined) {
    throw new Error(`MockAiProvider: fixture not found: ${name}`);
  }
  return data as T;
}

type FixtureMap = Record<string, unknown>;

let _fixtureCache: FixtureMap | null = null;

/**
 * Returns the fixture map.
 * In test environments the map is populated by calling registerFixtures().
 * Loaded lazily to avoid import side-effects.
 */
async function getFixtureMap(): Promise<FixtureMap> {
  if (_fixtureCache !== null) return _fixtureCache;

  // Attempt dynamic import of bundled fixture index (Vite test environment).
  try {
    const mod = await import("../../tests/fixtures/index.ts");
    _fixtureCache = mod.FIXTURES as FixtureMap;
    return _fixtureCache;
  } catch {
    _fixtureCache = {};
    return _fixtureCache;
  }
}

/**
 * Registers custom fixtures at runtime (useful in individual test files).
 * Calling with an empty object resets the cache — useful for negative tests.
 */
export function registerFixtures(map: FixtureMap): void {
  // Spread onto current cache if non-empty; replace entirely if empty (reset).
  if (Object.keys(map).length === 0) {
    _fixtureCache = {};
  } else {
    _fixtureCache = { ..._fixtureCache, ...map };
  }
}

// ─── Streaming simulation ─────────────────────────────────────────────────────

/**
 * Emits a deterministic stream from a fixture value.
 * Sends 3 delta events with a partial snapshot, then a final done event.
 * Simulates real streaming without any timing (synchronous in tests).
 */
async function* simulateStream<T extends object>(
  value: T
): AsyncIterable<AiStreamEvent<T>> {
  // Emit partial data in two deltas, then the full result.
  const keys = Object.keys(value) as Array<keyof T>;
  const half = Math.ceil(keys.length / 2);

  const partial1 = Object.fromEntries(
    keys.slice(0, half).map((k) => [k, value[k]])
  ) as Partial<T>;
  yield { type: "delta", data: partial1 };

  yield { type: "delta", data: value };
  yield { type: "done", data: value };
}

// ─── Provider class ───────────────────────────────────────────────────────────

export class MockAiProvider implements AiProvider {
  async healthCheck(): Promise<CliInfo> {
    return {
      installed: true,
      version: "0.0.0-mock",
      path: "/mock/claude",
    };
  }

  async *extractQuoteFromBrief(
    _brief: string,
    _opts?: ExtractOpts
  ): AsyncIterable<AiStreamEvent<ExtractedQuote>> {
    try {
      const fixture = await loadFixture<ExtractedQuote>("extract_quote");
      yield* simulateStream(fixture);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", message };
    }
  }

  async *draftEmail(
    _context: EmailContext,
    _opts?: DraftOpts
  ): AsyncIterable<AiStreamEvent<string>> {
    try {
      const body = await loadFixture<string>("draft_email");
      // String is not an object — emit delta + done directly.
      yield { type: "delta", data: body.slice(0, Math.ceil(body.length / 2)) };
      yield { type: "done", data: body };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", message };
    }
  }
}
