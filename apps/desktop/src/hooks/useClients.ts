import type { Client, Invoice, Quote } from "@fakt/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.js";

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

function genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useClients(options: UseClientsOptions = {}): UseClientsResult {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.clients
      .list({
        ...(options.search !== undefined ? { search: options.search } : {}),
        ...(options.includeSoftDeleted !== undefined
          ? { includeSoftDeleted: options.includeSoftDeleted }
          : {}),
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
      await api.clients.create({ id: genUuid(), ...input });
      refresh();
    },
    [refresh]
  );

  const updateClient = useCallback(
    async (id: string, input: UpdateClientInput): Promise<void> => {
      await api.clients.update(id, input);
      refresh();
    },
    [refresh]
  );

  const deleteClient = useCallback(
    async (id: string): Promise<void> => {
      await api.clients.archive(id);
      refresh();
    },
    [refresh]
  );

  const restoreClient = useCallback(
    async (id: string): Promise<void> => {
      await api.clients.restore(id);
      refresh();
    },
    [refresh]
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

    api.quotes
      .list({ clientId })
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

    api.invoices
      .list({ clientId })
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }, [clientId]);

  return { invoices };
}
