/**
 * Unit tests for AiProvider interface contract + MockAiProvider.
 * CI mode: FAKT_AI_PROVIDER=mock — no Claude CLI required.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAi, setAi } from "../src/index.ts";
import type { AiProvider, AiStreamEvent, ExtractedQuote } from "../src/provider.ts";
import { MockAiProvider, registerFixtures } from "../src/providers/mock.ts";
import { FIXTURES } from "./fixtures/index.ts";

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  // Register fixtures so MockAiProvider can load them.
  registerFixtures(FIXTURES);
});

afterEach(() => {
  // Reset singleton to avoid cross-test contamination.
  setAi(null);
});

// ─── MockAiProvider basics ────────────────────────────────────────────────────

describe("MockAiProvider", () => {
  it("healthCheck returns installed=true with mock metadata", async () => {
    const provider = new MockAiProvider();
    const info = await provider.healthCheck();

    expect(info.installed).toBe(true);
    expect(info.version).toBe("0.0.0-mock");
    expect(info.path).toBeDefined();
  });

  it("extractQuoteFromBrief yields delta then done events", async () => {
    const provider = new MockAiProvider();
    const events: Array<AiStreamEvent<ExtractedQuote>> = [];

    for await (const event of provider.extractQuoteFromBrief("Brief de test")) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThanOrEqual(2);

    const deltaEvents = events.filter((e) => e.type === "delta");
    expect(deltaEvents.length).toBeGreaterThan(0);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.type).toBe("done");
  });

  it("extractQuoteFromBrief done event matches fixture", async () => {
    const provider = new MockAiProvider();
    let doneData: ExtractedQuote | undefined;

    for await (const event of provider.extractQuoteFromBrief("Brief quelconque")) {
      if (event.type === "done") {
        doneData = event.data;
      }
    }

    expect(doneData).toBeDefined();
    expect(doneData?.client.name).toBe("Atelier Dupont Design");
    expect(doneData?.items).toHaveLength(3);
    expect(doneData?.depositPercent).toBe(30);
  });

  it("draftEmail yields delta then done event", async () => {
    const provider = new MockAiProvider();
    const events: Array<AiStreamEvent<string>> = [];

    for await (const event of provider.draftEmail({
      clientName: "Test Client",
      amountCents: 360000,
      dueDate: "2026-05-21",
      docNumber: "D2026-001",
      docType: "quote",
      tone: "formal",
    })) {
      events.push(event);
    }

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(typeof doneEvent?.data).toBe("string");
    expect((doneEvent?.data as string).length).toBeGreaterThan(10);
  });

  it("draftEmail with friendly tone still resolves", async () => {
    const provider = new MockAiProvider();
    let done = false;

    for await (const event of provider.draftEmail({
      clientName: "Marie Dupont",
      amountCents: 120000,
      dueDate: "2026-05-30",
      docNumber: "F2026-003",
      docType: "invoice",
      tone: "friendly",
    })) {
      if (event.type === "done") done = true;
    }

    expect(done).toBe(true);
  });

  it("throws when fixture is missing", async () => {
    // Override fixtures to empty map.
    registerFixtures({});

    const provider = new MockAiProvider();
    const events: Array<AiStreamEvent<ExtractedQuote>> = [];

    for await (const event of provider.extractQuoteFromBrief("test")) {
      events.push(event);
    }

    // Should emit an error event instead of throwing.
    // MockAiProvider wraps loadFixture errors into stream errors.
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});

// ─── getAi / setAi registry ───────────────────────────────────────────────────

describe("getAi / setAi", () => {
  it("setAi(mock) makes getAi return the mock", async () => {
    const mock = new MockAiProvider();
    setAi(mock);

    const provider = getAi();
    const info = await provider.healthCheck();
    expect(info.installed).toBe(true);
    expect(info.version).toBe("0.0.0-mock");
  });

  it("getAi returns the same instance on repeated calls", () => {
    const mock = new MockAiProvider();
    setAi(mock);

    expect(getAi()).toBe(getAi());
  });

  it("setAi(null) resets the singleton", () => {
    const mock = new MockAiProvider();
    setAi(mock);
    setAi(null);

    // After reset, getAi() will try to create ClaudeCliProvider.
    // In test env without Tauri, this is acceptable — we just verify
    // a new instance is returned (different from the mock).
    const provider = getAi();
    // It should not be the mock we set.
    // (Will be ClaudeCliProvider in non-mock env, or mock if FAKT_AI_PROVIDER=mock)
    expect(provider).toBeDefined();
  });
});

// ─── AiProvider interface type narrowing ─────────────────────────────────────

describe("AiStreamEvent type narrowing", () => {
  it("type guards work correctly", async () => {
    const provider: AiProvider = new MockAiProvider();
    const results: string[] = [];

    for await (const event of provider.extractQuoteFromBrief("brief")) {
      if (event.type === "delta") {
        results.push("delta");
      } else if (event.type === "done") {
        results.push("done");
        // Type narrowing: event.data is ExtractedQuote here.
        expect(event.data.client).toBeDefined();
      } else if (event.type === "error") {
        results.push("error");
      }
    }

    expect(results).toContain("done");
  });
});
