import type { DocumentUnit, Service } from "@fakt/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.js";

interface UsePrestationsOptions {
  search?: string;
  includeSoftDeleted?: boolean;
}

interface CreatePrestationInput {
  name: string;
  description?: string | null;
  unit: DocumentUnit;
  unitPriceCents: number;
  tags?: string[] | null;
}

interface UpdatePrestationInput {
  name?: string;
  description?: string | null;
  unit?: DocumentUnit;
  unitPriceCents?: number;
  tags?: string[] | null;
}

interface UsePrestationsResult {
  prestations: Service[];
  loading: boolean;
  createPrestation: (input: CreatePrestationInput) => Promise<void>;
  updatePrestation: (id: string, input: UpdatePrestationInput) => Promise<void>;
  deletePrestation: (id: string) => Promise<void>;
  restorePrestation: (id: string) => Promise<void>;
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

export function usePrestations(options: UsePrestationsOptions = {}): UsePrestationsResult {
  const [prestations, setPrestations] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.services
      .list({
        ...(options.search !== undefined ? { search: options.search } : {}),
        ...(options.includeSoftDeleted !== undefined
          ? { includeSoftDeleted: options.includeSoftDeleted }
          : {}),
      })
      .then((data) => {
        if (!cancelled) {
          setPrestations(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrestations([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [options.search, options.includeSoftDeleted, tick]);

  const createPrestation = useCallback(
    async (input: CreatePrestationInput): Promise<void> => {
      await api.services.create({ id: genUuid(), ...input });
      refresh();
    },
    [refresh]
  );

  const updatePrestation = useCallback(
    async (id: string, input: UpdatePrestationInput): Promise<void> => {
      await api.services.update(id, input);
      refresh();
    },
    [refresh]
  );

  const deletePrestation = useCallback(
    async (id: string): Promise<void> => {
      await api.services.archive(id);
      refresh();
    },
    [refresh]
  );

  const restorePrestation = useCallback(
    async (id: string): Promise<void> => {
      await api.services.restore(id);
      refresh();
    },
    [refresh]
  );

  return {
    prestations,
    loading,
    createPrestation,
    updatePrestation,
    deletePrestation,
    restorePrestation,
    refresh,
  };
}
