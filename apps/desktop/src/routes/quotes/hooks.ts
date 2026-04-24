/**
 * Hooks React H1 — récupèrent les données via les bridges API.
 * Pattern minimaliste — pas de React Query pour rester tauri-agnostic.
 */

import type { Client, Quote, Service, UUID, Workspace } from "@fakt/shared";
import { useCallback, useEffect, useState } from "react";
import { clientsApi } from "../../features/doc-editor/clients-api.js";
import { prestationsApi } from "../../features/doc-editor/prestations-api.js";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { workspaceApi } from "../../features/doc-editor/workspace-api.js";

interface UseQuotesState {
  quotes: Quote[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useQuotes(): UseQuotesState {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    quotesApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setQuotes(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setQuotes([]);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [tick]);

  return { quotes, loading, error, refresh };
}

interface UseQuoteState {
  quote: Quote | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useQuote(id: UUID | undefined): UseQuoteState {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) {
      setQuote(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    quotesApi
      .get(id)
      .then((data) => {
        if (!cancelled) {
          setQuote(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setQuote(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [id, tick]);

  return { quote, loading, error, refresh };
}

interface UseClientsListResult {
  clients: Client[];
  loading: boolean;
  addClient: (client: Client) => void;
  refresh: () => void;
}

export function useClientsList(): UseClientsListResult {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  const addClient = useCallback((client: Client): void => {
    setClients((prev) => {
      if (prev.some((c) => c.id === client.id)) return prev;
      return [...prev, client];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    clientsApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setClients(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClients([]);
          setLoading(false);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [tick]);

  return { clients, loading, addClient, refresh };
}

export function usePrestationsList(): { prestations: Service[] } {
  const [prestations, setPrestations] = useState<Service[]>([]);
  useEffect(() => {
    let cancelled = false;
    prestationsApi
      .list()
      .then((data) => {
        if (!cancelled) setPrestations(data);
      })
      .catch(() => {
        if (!cancelled) setPrestations([]);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);
  return { prestations };
}

export function useWorkspace(): { workspace: Workspace | null } {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  useEffect(() => {
    let cancelled = false;
    workspaceApi
      .get()
      .then((ws) => {
        if (!cancelled) setWorkspace(ws);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);
  return { workspace };
}
