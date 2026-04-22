import { describe, expect, it, vi } from "vitest";
import { buildShortcuts, matchesShortcut } from "./shortcuts.js";

function makeKeyEvent(
  key: string,
  opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}
): KeyboardEvent {
  return {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
  } as KeyboardEvent;
}

describe("buildShortcuts", () => {
  it("retourne les 4 raccourcis attendus", () => {
    const shortcuts = buildShortcuts({
      onNewQuote: vi.fn(),
      onNewInvoice: vi.fn(),
      onToggleComposer: vi.fn(),
      onShowHelp: vi.fn(),
    });
    expect(shortcuts).toHaveLength(4);
  });
});

describe("matchesShortcut", () => {
  it("correspond à ⌘N (nouveau devis)", () => {
    const shortcuts = buildShortcuts({
      onNewQuote: vi.fn(),
      onNewInvoice: vi.fn(),
      onToggleComposer: vi.fn(),
      onShowHelp: vi.fn(),
    });
    const newQuote = shortcuts.find((s) => s.description === "Nouveau devis")!;
    expect(matchesShortcut(makeKeyEvent("n", { metaKey: true }), newQuote)).toBe(true);
    expect(matchesShortcut(makeKeyEvent("n"), newQuote)).toBe(false);
  });

  it("correspond à ⌘⇧N (nouvelle facture)", () => {
    const shortcuts = buildShortcuts({
      onNewQuote: vi.fn(),
      onNewInvoice: vi.fn(),
      onToggleComposer: vi.fn(),
      onShowHelp: vi.fn(),
    });
    const newInvoice = shortcuts.find((s) => s.description === "Nouvelle facture")!;
    expect(matchesShortcut(makeKeyEvent("N", { metaKey: true, shiftKey: true }), newInvoice)).toBe(
      true
    );
    expect(matchesShortcut(makeKeyEvent("N", { metaKey: true }), newInvoice)).toBe(false);
  });

  it("correspond à ⌘/ (composer)", () => {
    const shortcuts = buildShortcuts({
      onNewQuote: vi.fn(),
      onNewInvoice: vi.fn(),
      onToggleComposer: vi.fn(),
      onShowHelp: vi.fn(),
    });
    const composer = shortcuts.find((s) => s.description === "Composer IA")!;
    expect(matchesShortcut(makeKeyEvent("/", { metaKey: true }), composer)).toBe(true);
    expect(matchesShortcut(makeKeyEvent("/"), composer)).toBe(false);
  });

  it("correspond à ? (aide)", () => {
    const shortcuts = buildShortcuts({
      onNewQuote: vi.fn(),
      onNewInvoice: vi.fn(),
      onToggleComposer: vi.fn(),
      onShowHelp: vi.fn(),
    });
    const help = shortcuts.find((s) => s.description === "Aide raccourcis")!;
    expect(matchesShortcut(makeKeyEvent("?"), help)).toBe(true);
    expect(matchesShortcut(makeKeyEvent("?", { metaKey: true }), help)).toBe(false);
  });
});
