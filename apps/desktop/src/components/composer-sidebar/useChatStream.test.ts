/**
 * Tests unit pour le hook useChatStream.
 *
 * Focus principal : les helpers d'extraction extractDeltaText et
 * extractFinalText - ils sont le coeur du fix du bug streaming
 * "[object Object]" et doivent etre blindes avec tous les formats vus
 * en production (mock, CLI Rust, Anthropic SDK).
 *
 * Ajouté dans cette session : `applyStreamEventToBlocks` route les events
 * structurés (thinking_delta, tool_use_*, tool_result) vers la bonne
 * structure de block — on teste chaque transition pour garantir que le
 * Composer IA affiche correctement les étapes live de l'IA.
 */

import type { AiStreamEvent } from "@fakt/ai";
import { describe, expect, it } from "vitest";
import {
  type ChatBlock,
  applyStreamEventToBlocks,
  extractDeltaText,
  extractFinalText,
} from "./useChatStream.js";

/**
 * Helper test — wrap applyStreamEventToBlocks pour éviter les non-null
 * assertions (biome lint/style/noNonNullAssertion). Throw si le hook
 * retourne null, ce qui fait échouer le test avec un message clair plutôt
 * qu'une TypeError déréférencée.
 */
function apply(
  blocks: ChatBlock[],
  event: AiStreamEvent<string>
): { blocks: ChatBlock[]; textAccumulator?: string } {
  const out = applyStreamEventToBlocks(blocks, event);
  if (!out) throw new Error(`applyStreamEventToBlocks returned null for ${event.type}`);
  return out;
}

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

describe("applyStreamEventToBlocks", () => {
  // Helper : type narrower sur les events text (TEvent = string dans le composer).
  type E = AiStreamEvent<string>;

  it("delta text crée un premier TextBlock puis concatène", () => {
    const first = apply([], { type: "delta", data: "Hel" } as E);
    expect(first).not.toBeNull();
    expect(first?.blocks).toEqual([{ type: "text", text: "Hel" }]);
    expect(first?.textAccumulator).toBe("Hel");

    const second = applyStreamEventToBlocks(first?.blocks, { type: "delta", data: "lo" } as E);
    expect(second?.blocks).toEqual([{ type: "text", text: "Hello" }]);
    expect(second?.textAccumulator).toBe("Hello");
  });

  it("delta text avec payload object { text }", () => {
    const out = apply([], {
      type: "delta",
      data: { text: "bonjour" },
    } as unknown as E);
    expect(out?.blocks).toEqual([{ type: "text", text: "bonjour" }]);
  });

  it("delta text vide = no-op (retourne null)", () => {
    // Appels directs (pas apply()) : on teste spécifiquement le retour null.
    expect(applyStreamEventToBlocks([], { type: "delta", data: "" } as E)).toBeNull();
    expect(applyStreamEventToBlocks([], { type: "delta", data: null } as unknown as E)).toBeNull();
  });

  it("thinking_delta crée un ThinkingBlock puis concatène", () => {
    const first = apply([], {
      type: "thinking_delta",
      text: "Je ",
    });
    expect(first?.blocks).toEqual([{ type: "thinking", thinking: "Je " }]);
    const second = applyStreamEventToBlocks(first?.blocks, {
      type: "thinking_delta",
      text: "réfléchis",
    });
    expect(second?.blocks).toEqual([{ type: "thinking", thinking: "Je réfléchis" }]);
  });

  it("thinking_delta après un delta text crée un nouveau ThinkingBlock distinct", () => {
    const afterText = apply([], { type: "delta", data: "a" } as E);
    const afterThink = apply(afterText.blocks, {
      type: "thinking_delta",
      text: "réflexion",
    });
    expect(afterThink?.blocks).toEqual([
      { type: "text", text: "a" },
      { type: "thinking", thinking: "réflexion" },
    ]);
  });

  it("tool_use_start ajoute un ToolUseBlock avec input vide (string)", () => {
    const out = apply([], {
      type: "tool_use_start",
      id: "toolu_A",
      name: "list_clients",
    });
    expect(out?.blocks).toEqual([
      { type: "tool_use", id: "toolu_A", name: "list_clients", input: "" },
    ]);
  });

  it("tool_use_delta concatène partialJson sur le tool_use matching id", () => {
    const start = apply([], {
      type: "tool_use_start",
      id: "toolu_A",
      name: "list_clients",
    });
    const d1 = apply(start.blocks, {
      type: "tool_use_delta",
      id: "toolu_A",
      partialJson: '{"search":"',
    });
    const d2 = apply(d1.blocks, {
      type: "tool_use_delta",
      id: "toolu_A",
      partialJson: 'Tom"}',
    });
    expect(d2.blocks).toEqual([
      { type: "tool_use", id: "toolu_A", name: "list_clients", input: '{"search":"Tom"}' },
    ]);
  });

  it("tool_use_delta avec id vide cible le dernier tool_use (fallback parser)", () => {
    const start = apply([], {
      type: "tool_use_start",
      id: "toolu_X",
      name: "foo",
    });
    const out = apply(start.blocks, {
      type: "tool_use_delta",
      id: "",
      partialJson: '{"a":1}',
    });
    expect(out.blocks[0]).toMatchObject({
      type: "tool_use",
      id: "toolu_X",
      input: '{"a":1}',
    });
  });

  it("tool_use_stop parse le JSON accumulé et remplace input par l'objet", () => {
    const start = apply([], {
      type: "tool_use_start",
      id: "toolu_A",
      name: "list_clients",
    });
    const d = apply(start.blocks, {
      type: "tool_use_delta",
      id: "toolu_A",
      partialJson: '{"search":"Tom","limit":5}',
    });
    const stop = apply(d.blocks, {
      type: "tool_use_stop",
      id: "toolu_A",
    });
    const block = stop.blocks[0];
    expect(block?.type).toBe("tool_use");
    if (block?.type === "tool_use") {
      expect(block.input).toEqual({ search: "Tom", limit: 5 });
    }
  });

  it("tool_use_stop avec JSON invalide garde la string pour debug", () => {
    const start = apply([], {
      type: "tool_use_start",
      id: "t1",
      name: "bogus",
    });
    const d = apply(start.blocks, {
      type: "tool_use_delta",
      id: "t1",
      partialJson: '{"incomplete":',
    });
    const stop = apply(d.blocks, { type: "tool_use_stop", id: "t1" });
    const block = stop.blocks[0];
    if (block?.type === "tool_use") {
      expect(block.input).toBe('{"incomplete":');
    } else {
      throw new Error("expected tool_use block");
    }
  });

  it("tool_result ajoute un ToolResultBlock OK ou erreur", () => {
    const ok = apply([], {
      type: "tool_result",
      toolUseId: "t1",
      content: "3 clients trouvés",
      isError: false,
    });
    expect(ok.blocks).toEqual([
      { type: "tool_result", toolUseId: "t1", content: "3 clients trouvés", isError: false },
    ]);
    const ko = apply(ok.blocks, {
      type: "tool_result",
      toolUseId: "t2",
      content: "timeout",
      isError: true,
    });
    expect(ko.blocks[1]).toEqual({
      type: "tool_result",
      toolUseId: "t2",
      content: "timeout",
      isError: true,
    });
  });

  it("scénario complet — thinking → tool_use → tool_result → delta text", () => {
    let blocks: ChatBlock[] = [];
    const events: Array<AiStreamEvent<string>> = [
      { type: "thinking_delta", text: "Je cherche les clients…" },
      { type: "tool_use_start", id: "t1", name: "list_clients" },
      { type: "tool_use_delta", id: "t1", partialJson: '{"limit"' },
      { type: "tool_use_delta", id: "t1", partialJson: ":10}" },
      { type: "tool_use_stop", id: "t1" },
      { type: "tool_result", toolUseId: "t1", content: "OK 3 clients", isError: false },
      { type: "delta", data: "Voici tes " },
      { type: "delta", data: "3 clients." },
    ];
    for (const e of events) {
      const applied = applyStreamEventToBlocks(blocks, e);
      if (applied !== null) blocks = applied.blocks;
    }
    expect(blocks).toHaveLength(4);
    expect(blocks[0]?.type).toBe("thinking");
    expect(blocks[1]?.type).toBe("tool_use");
    expect(blocks[2]?.type).toBe("tool_result");
    expect(blocks[3]).toEqual({ type: "text", text: "Voici tes 3 clients." });
    if (blocks[1]?.type === "tool_use") {
      expect(blocks[1].input).toEqual({ limit: 10 });
    }
  });

  it("retourne null pour les events non routables (done, error)", () => {
    // Appels directs : on teste spécifiquement que le hook ignore done/error.
    expect(applyStreamEventToBlocks([], { type: "done", data: "final" } as E)).toBeNull();
    expect(applyStreamEventToBlocks([], { type: "error", message: "oops" } as E)).toBeNull();
  });
});
