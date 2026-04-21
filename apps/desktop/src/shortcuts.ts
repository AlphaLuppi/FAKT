/**
 * Raccourcis clavier globaux FAKT — enregistrés au mount de Shell.
 *
 * ⌘K / Ctrl+K  → CommandPalette (géré dans CommandPaletteProvider)
 * ⌘N           → Nouveau devis
 * ⌘⇧N          → Nouvelle facture
 * ⌘/           → Toggle Composer IA
 * ?            → Overlay aide raccourcis
 */

export interface ShortcutHandler {
  key: string;
  meta?: boolean;
  shift?: boolean;
  ctrl?: boolean;
  description: string;
  action: () => void;
}

export function matchesShortcut(e: KeyboardEvent, shortcut: ShortcutHandler): boolean {
  const metaOrCtrl = shortcut.meta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
  const shift = shortcut.shift ? e.shiftKey : !e.shiftKey;
  return metaOrCtrl && shift && e.key === shortcut.key;
}

export function buildShortcuts(handlers: {
  onNewQuote: () => void;
  onNewInvoice: () => void;
  onToggleComposer: () => void;
  onShowHelp: () => void;
}): ShortcutHandler[] {
  return [
    {
      key: "n",
      meta: true,
      shift: false,
      description: "Nouveau devis",
      action: handlers.onNewQuote,
    },
    {
      key: "N",
      meta: true,
      shift: true,
      description: "Nouvelle facture",
      action: handlers.onNewInvoice,
    },
    {
      key: "/",
      meta: true,
      shift: false,
      description: "Composer IA",
      action: handlers.onToggleComposer,
    },
    {
      key: "?",
      meta: false,
      shift: false,
      description: "Aide raccourcis",
      action: handlers.onShowHelp,
    },
  ];
}
