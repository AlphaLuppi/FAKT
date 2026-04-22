import { tokens } from "@fakt/design-tokens";
import type { ChangeEvent, KeyboardEvent, ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Overlay } from "./Overlay.js";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  icon?: ReactNode;
  keywords?: ReadonlyArray<string>;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: ReadonlyArray<CommandItem>;
  onSelect: (item: CommandItem) => void;
  placeholder?: string;
}

/** Palette de commandes type ⌘K. Filtre fuzzy simple, navigation clavier. */
export function CommandPalette({
  open,
  onClose,
  items,
  onSelect,
  placeholder = "Que voulez-vous faire ?",
}: CommandPaletteProps): ReactElement | null {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return items;
    return items.filter((it) => {
      const hay = [it.label, it.hint, it.group, ...(it.keywords ?? [])]
        .filter((x): x is string => typeof x === "string")
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const choose = useCallback(
    (item: CommandItem): void => {
      onSelect(item);
      onClose();
    },
    [onSelect, onClose]
  );

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[activeIndex];
      if (it !== undefined) choose(it);
    }
  };

  if (!open) return null;

  return (
    <Overlay open={open} onClose={onClose}>
      <div className="fakt-cmdpalette" onClick={(e) => e.stopPropagation()}>
        <input
          className="fakt-cmdpalette__search"
          placeholder={placeholder}
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.currentTarget.value)}
          onKeyDown={onKey}
          aria-label="Commande"
        />
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {filtered.length === 0 && (
            <li
              style={{
                padding: tokens.spacing[4],
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.sm,
                color: tokens.color.muted,
                textAlign: "center",
              }}
            >
              Aucun résultat
            </li>
          )}
          {filtered.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                className="fakt-cmdpalette__item"
                data-active={i === activeIndex ? "true" : "false"}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(it)}
              >
                {it.icon}
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.hint !== undefined && (
                  <span
                    style={{
                      fontFamily: tokens.font.mono,
                      fontSize: tokens.fontSize.xs,
                      color: tokens.color.muted,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    {it.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Overlay>
  );
}
