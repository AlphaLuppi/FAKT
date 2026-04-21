import type { ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { GlobalCommandPalette } from "./GlobalCommandPalette.js";

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => undefined,
  close: () => undefined,
  isOpen: false,
});

export function useCommandPalette(): CommandPaletteContextValue {
  return useContext(CommandPaletteContext);
}

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((): void => setIsOpen(true), []);
  const close = useCallback((): void => setIsOpen(false), []);

  // Hotkey ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, close, isOpen }}>
      {children}
      <GlobalCommandPalette open={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  );
}
