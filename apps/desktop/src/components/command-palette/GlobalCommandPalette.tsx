import { fr } from "@fakt/shared";
import { CommandPalette } from "@fakt/ui";
import type { CommandItem } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useCommandPaletteIndex } from "./useCommandPaletteIndex.js";
import type { SearchResult } from "./useCommandPaletteIndex.js";

export interface GlobalCommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalCommandPalette({ open, onClose }: GlobalCommandPaletteProps): ReactElement {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { items, setQuery: setIndexQuery } = useCommandPaletteIndex();
  const openTimeRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      openTimeRef.current = performance.now();
      setQuery("");
      setIndexQuery("");
    }
  }, [open, setIndexQuery]);

  useEffect(() => {
    setIndexQuery(query);
  }, [query, setIndexQuery]);

  const handleSelect = useCallback(
    (item: CommandItem): void => {
      const elapsed = performance.now() - openTimeRef.current;
      if (elapsed > 100) {
        console.warn(`[CommandPalette] time-to-select: ${elapsed.toFixed(0)}ms`);
      }

      const result = item as SearchResult;
      void navigate(result.path);
      onClose();
    },
    [navigate, onClose]
  );

  // Les items CommandPalette n'ont pas de setQuery intégré dans le composant de base,
  // on doit filtrer côté useCommandPaletteIndex et passer les items déjà filtrés.
  return (
    <GlobalPaletteWrapper
      open={open}
      onClose={onClose}
      query={query}
      onQueryChange={setQuery}
      items={items}
      onSelect={handleSelect}
    />
  );
}

/** Wrapper interne qui gère l'input de recherche séparé du composant CommandPalette de base. */
function GlobalPaletteWrapper({
  open,
  onClose,
  query,
  onQueryChange,
  items,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  items: SearchResult[];
  onSelect: (item: CommandItem) => void;
}): ReactElement {
  // On passe les items déjà filtrés au CommandPalette, et on contrôle le query par props.
  // Le CommandPalette interne va refiltrer, donc on passe query="" pour ne pas double-filtrer.
  // Alternative : utiliser directement le CommandPalette et laisser son filtre interne.
  // On choisit de passer les items préfiltrés et query="" pour le composant UI de base.

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      items={items}
      onSelect={onSelect}
      placeholder={`${fr.nav.dashboard}, clients, devis… (⌘K)`}
    />
  );
}
