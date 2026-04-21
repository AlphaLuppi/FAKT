import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type { Service, DocumentUnit } from "@fakt/shared";

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

export function usePrestations(options: UsePrestationsOptions = {}): UsePrestationsResult {
  const [prestations, setPrestations] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback((): void => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    invoke<Service[]>(IPC_COMMANDS.LIST_SERVICES, {
      search: options.search ?? null,
      includeSoftDeleted: options.includeSoftDeleted ?? false,
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
      await invoke<Service>(IPC_COMMANDS.CREATE_SERVICE, { input });
      refresh();
    },
    [refresh],
  );

  const updatePrestation = useCallback(
    async (id: string, input: UpdatePrestationInput): Promise<void> => {
      await invoke<Service>(IPC_COMMANDS.UPDATE_SERVICE, { id, input });
      refresh();
    },
    [refresh],
  );

  const deletePrestation = useCallback(
    async (id: string): Promise<void> => {
      await invoke<void>(IPC_COMMANDS.ARCHIVE_SERVICE, { id });
      refresh();
    },
    [refresh],
  );

  const restorePrestation = useCallback(
    async (id: string): Promise<void> => {
      await invoke<Service>(IPC_COMMANDS.UPDATE_SERVICE, { id, input: { restore: true } });
      refresh();
    },
    [refresh],
  );

  return { prestations, loading, createPrestation, updatePrestation, deletePrestation, restorePrestation, refresh };
}
