import type { DocContext } from "@fakt/ai";
import type { ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";

interface ComposerSidebarContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openWithContext: (ctx: DocContext, initialMessage?: string) => void;
  pendingContext: DocContext | null;
  pendingMessage: string | null;
  clearPending: () => void;
}

const ComposerSidebarContext = createContext<ComposerSidebarContextValue>({
  isOpen: false,
  open: () => undefined,
  close: () => undefined,
  toggle: () => undefined,
  openWithContext: () => undefined,
  pendingContext: null,
  pendingMessage: null,
  clearPending: () => undefined,
});

export function useComposerSidebar(): ComposerSidebarContextValue {
  return useContext(ComposerSidebarContext);
}

interface ComposerSidebarProviderProps {
  children: ReactNode;
}

export function ComposerSidebarProvider({ children }: ComposerSidebarProviderProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingContext, setPendingContext] = useState<DocContext | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const open = useCallback((): void => setIsOpen(true), []);
  const close = useCallback((): void => setIsOpen(false), []);
  const toggle = useCallback((): void => setIsOpen((v) => !v), []);

  const openWithContext = useCallback((ctx: DocContext, initialMessage?: string): void => {
    setPendingContext(ctx);
    if (initialMessage) setPendingMessage(initialMessage);
    setIsOpen(true);
  }, []);

  const clearPending = useCallback((): void => {
    setPendingContext(null);
    setPendingMessage(null);
  }, []);

  return (
    <ComposerSidebarContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        openWithContext,
        pendingContext,
        pendingMessage,
        clearPending,
      }}
    >
      {children}
    </ComposerSidebarContext.Provider>
  );
}
