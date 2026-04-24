/**
 * Tests unit pour le hook useChatStream.
 *
 * Focus principal : les helpers d'extraction extractDeltaText et
 * extractFinalText - ils sont le coeur du fix du bug streaming
 * "[object Object]" et doivent etre blindes avec tous les formats vus
 * en production (mock, CLI Rust, Anthropic SDK).
 */

import { describe, expect, it } from "vitest";
import { extractDeltaText, extractFinalText } from "./useChatStream.js";

describe("extractDeltaText", () => {
  it("retourne la string directe (format mock)", () => {
    expect(extractDeltaText("bonjour")).toBe("bonjour");
  });

  it("extrait .text depuis un object (format CLI Token)", () => {
    expect(extractDeltaText({ text: "bonjour" })).toBe("bonjour");
  });

  it("extrait delta.text (format Anthropic SDK content_block_delta)", () => {
    expect(extractDeltaText({ delta: { text: "hello" } })).toBe("hello");
  });

  it("extrait delta.thinking (extended thinking)", () => {
    expect(extractDeltaText({ delta: { thinking: "je reflechis" } })).toBe("je reflechis");
  });

  it("extrait delta.partial_json (tool_use stream)", () => {
    expect(extractDeltaText({ delta: { partial_json: '{"x":1}' } })).toBe('{"x":1}');
  });

  it("ne renvoie JAMAIS [object Object] pour un object inconnu", () => {
    expect(extractDeltaText({ foo: "bar" })).toBe("");
    expect(extractDeltaText({})).toBe("");
  });

  it("gere null / undefined", () => {
    expect(extractDeltaText(null)).toBe("");
    expect(extractDeltaText(undefined)).toBe("");
  });

  it("convertit nombres et booleans", () => {
    expect(extractDeltaText(42)).toBe("42");
    expect(extractDeltaText(true)).toBe("true");
  });

  it("accumule correctement plusieurs chunks mixtes", () => {
    const chunks: unknown[] = [
      "Hel",
      { text: "lo " },
      { delta: { text: "wo" } },
      { delta: { text: "rld" } },
    ];
    const acc = chunks.map(extractDeltaText).join("");
    expect(acc).toBe("Hello world");
  });
});

describe("extractFinalText", () => {
  it("retourne la string si data est string", () => {
    expect(extractFinalText("ok", "fallback")).toBe("ok");
  });

  it("extrait .text d'un object", () => {
    expect(extractFinalText({ text: "ok" }, "fallback")).toBe("ok");
  });

  it("extrait .result (format done CLI)", () => {
    expect(extractFinalText({ result: "ok" }, "fallback")).toBe("ok");
  });

  it("fallback si data null ou forme inconnue", () => {
    expect(extractFinalText(null, "accumule")).toBe("accumule");
    expect(extractFinalText({ foo: "bar" }, "accumule")).toBe("accumule");
  });
});
