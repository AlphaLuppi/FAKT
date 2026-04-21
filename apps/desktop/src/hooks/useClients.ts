import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type { Client, Quote, Invoice } from "@fakt/shared";

interface UseClientsOptions {
  search?: string;
  includeSoftDeleted?: boolean;
}

interface UpdateClientInput {
  name?: string;
  legalForm?: string | null;
  siret?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  sector?: string | null;
  note?: string | null;
}

interface CreateClientInput {
  name: string;
  legalForm?: string | null;
  siret?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  sector?: string | null;
  note?: string | null;
}

interface UseClientsResult {
  clients: Client[];
  loading: boolean;
  createClient: (input: CreateClientInput) => Promise<void>;
  updateClient: (id: string, input: UpdateClientInput) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  restoreClient: (id: string) => Promise<void>;
  refresh: () => void;
}

export function useClients(options: UseClientsOptions = {}): UseClientsResult {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    invoke<Client[]>(IPC_COMMANDS.LIST_CLIENTS, {
      search: options.search ?? null,
      includeSoftDeleted: options.includeSoftDeleted ?? false,
    })
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

    return () => {
      cancelled = true;
    };
  }, [options.search, options.includeSoftDeleted, tick]);

  const createClient = useCallback(
    async (input: CreateClientInput): Promise<void> => {
      await invoke<Client>(IPC_COMMANDS.CREATE_CLIENT, { input });
      refresh();
    },
    [refresh],
  );

  const updateClient = useCallback(
    async (id: string, input: UpdateClientInput): Promise<void> => {
      await invoke<Client>(IPC_COMMANDS.UPDATE_CLIENT, { id, input });
      refresh();
    },
    [refresh],
  );

  const deleteClient = useCallback(
    async (id: string): Promise<void> => {
      await invoke<void>(IPC_COMMANDS.ARCHIVE_CLIENT, { id });
      refresh();
    },
    [refresh],
  );

  const restoreClient = useCallback(
    async (id: string): Promise<void> => {
      // restore = update avec archivedAt = null via UPDATE_CLIENT
      await invoke<Client>(IPC_COMMANDS.UPDATE_CLIENT, { id, input: { restore: true } });
      refresh();
    },
    [refresh],
  );

  return { clients, loading, createClient, updateClient, deleteClient, restoreClient, refresh };
}

export function useClientQuotes(clientId: string | null): { quotes: Quote[] } {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    if (!clientId) {
      setQuotes([]);
      return;
    }

    invoke<Quote[]>(IPC_COMMANDS.LIST_QUOTES, { clientId })
      .then(setQuotes)
      .catch(() => setQuotes([]));
  }, [clientId]);

  return { quotes };
}

export function useClientInvoices(clientId: string | null): { invoices: Invoice[] } {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!clientId) {
      setInvoices([]);
      return;
    }

    invoke<Invoice[]>(IPC_COMMANDS.LIST_INVOICES, { clientId })
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }, [clientId]);

  return { invoices };
}
