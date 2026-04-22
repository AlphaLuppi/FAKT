/**
 * Hooks React pour /invoices — miroir de routes/quotes/hooks.ts (H1).
 */

import type { Invoice, UUID } from "@fakt/shared";
import { useCallback, useEffect, useState } from "react";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";

interface UseInvoicesState {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useInvoices(): UseInvoicesState {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    invoiceApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setInvoices(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setInvoices([]);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [tick]);

  return { invoices, loading, error, refresh };
}

interface UseInvoiceState {
  invoice: Invoice | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useInvoice(id: UUID | undefined): UseInvoiceState {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) {
      setInvoice(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    invoiceApi
      .get(id)
      .then((data) => {
        if (!cancelled) {
          setInvoice(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setInvoice(null);
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [id, tick]);

  return { invoice, loading, error, refresh };
}
