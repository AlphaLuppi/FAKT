import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { ReactElement } from "react";
import { useEffect } from "react";

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: fr.shortcuts.palette },
  { keys: ["⌘", "N"], label: fr.shortcuts.newQuote },
  { keys: ["⌘", "⇧", "N"], label: fr.shortcuts.newInvoice },
  { keys: ["⌘", "/"], label: fr.shortcuts.toggleComposer },
  { keys: ["?"], label: fr.shortcuts.showHelp },
] as const;

interface ShortcutsOverlayProps {
  onClose: () => void;
}

export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps): ReactElement {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      data-testid="shortcuts-overlay"
      role="dialog"
      aria-modal
      aria-label={fr.shortcuts.overlayTitle}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: tokens.color.surface,
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          boxShadow: tokens.shadow.lg,
          padding: tokens.spacing[6],
          minWidth: 380,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.md,
              fontWeight: Number(tokens.fontWeight.black),
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              margin: 0,
              color: tokens.color.ink,
            }}
          >
            {fr.shortcuts.overlayTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={fr.shortcuts.close}
            data-testid="shortcuts-overlay-close"
            style={{
              width: 28,
              height: 28,
              border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.md,
              color: tokens.color.ink,
            }}
          >
            x
          </button>
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[2],
          }}
        >
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: `${tokens.spacing[2]} 0`,
                borderBottom: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
              }}
            >
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                  color: tokens.color.ink,
                  fontWeight: Number(tokens.fontWeight.bold),
                }}
              >
                {s.label}
              </span>
              <div style={{ display: "flex", gap: tokens.spacing[1] }}>
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    style={{
                      fontFamily: tokens.font.mono,
                      fontSize: tokens.fontSize.xs,
                      padding: "2px 6px",
                      border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
                      background: tokens.color.paper,
                      color: tokens.color.ink,
                      fontWeight: Number(tokens.fontWeight.bold),
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
