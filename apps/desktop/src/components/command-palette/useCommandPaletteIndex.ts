import { IPC_COMMANDS } from "@fakt/shared";
import type { Client, Invoice, Quote, Service } from "@fakt/shared";
import type { CommandItem } from "@fakt/ui";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

export type EntityCategory = "clients" | "prestations" | "devis" | "factures";

export interface SearchResult extends CommandItem {
  category: EntityCategory;
  entityId: string;
  path: string;
}

interface IndexStore {
  clients: Client[];
  prestations: Service[];
  quotes: Quote[];
  invoices: Invoice[];
  loadedAt: number | null;
}

// Index partagé pour toutes les instances — préchargé une fois au boot
const sharedIndex: IndexStore = {
  clients: [],
  prestations: [],
  quotes: [],
  invoices: [],
  loadedAt: null,
};

/** Pré-charge l'index au démarrage de l'app (appelé depuis le Shell). */
export async function preloadSearchIndex(): Promise<void> {
  const start = performance.now();

  const [clients, prestations, quotes, invoices] = await Promise.all([
    invoke<Client[]>(IPC_COMMANDS.LIST_CLIENTS, { includeSoftDeleted: false }).catch(
      () => [] as Client[]
    ),
    invoke<Service[]>(IPC_COMMANDS.LIST_SERVICES, { includeSoftDeleted: false }).catch(
      () => [] as Service[]
    ),
    invoke<Quote[]>(IPC_COMMANDS.LIST_QUOTES, {}).catch(() => [] as Quote[]),
    invoke<Invoice[]>(IPC_COMMANDS.LIST_INVOICES, {}).catch(() => [] as Invoice[]),
  ]);

  sharedIndex.clients = clients;
  sharedIndex.prestations = prestations;
  sharedIndex.quotes = quotes;
  sharedIndex.invoices = invoices;
  sharedIndex.loadedAt = Date.now();

  const elapsed = performance.now() - start;
  // NFR-001 : < 100ms target
  if (elapsed > 100) {
    console.warn(
      `[CommandPalette] preloadSearchIndex took ${elapsed.toFixed(0)}ms (> 100ms target)`
    );
  }
}

/** Invalide l'index (appeler après write sur clients/prestations/devis/factures). */
export function invalidateSearchIndex(): void {
  sharedIndex.loadedAt = null;
}

/** Convertit l'index en items CommandPalette filtrés par fuzzy query. */
function buildItems(index: IndexStore, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  const match = (text: string): boolean => q.length === 0 || text.toLowerCase().includes(q);

  for (const c of index.clients) {
    const hay = [c.name, c.email, c.contactName, c.sector].filter(Boolean).join(" ");
    if (match(hay)) {
      const item: SearchResult = {
        id: `client-${c.id}`,
        entityId: c.id,
        category: "clients",
        path: "/clients",
        label: c.name,
        group: "Clients",
        keywords: [c.email ?? "", c.contactName ?? "", c.sector ?? ""],
      };
      if (c.email) item.hint = c.email;
      results.push(item);
    }
  }

  for (const s of index.prestations) {
    const hay = [s.name, s.description, ...(s.tags ?? [])].filter(Boolean).join(" ");
    if (match(hay)) {
      results.push({
        id: `service-${s.id}`,
        entityId: s.id,
        category: "prestations",
        path: "/services",
        label: s.name,
        hint: `${(s.unitPriceCents / 100).toFixed(2)} € / ${s.unit}`,
        group: "Prestations",
        keywords: s.tags ?? [],
      });
    }
  }

  for (const q2 of index.quotes) {
    const hay = [q2.title, q2.number].filter(Boolean).join(" ");
    if (match(hay)) {
      results.push({
        id: `quote-${q2.id}`,
        entityId: q2.id,
        category: "devis",
        path: `/quotes/${q2.id}`,
        label: q2.number ? `${q2.number} — ${q2.title}` : q2.title,
        hint: q2.status,
        group: "Devis",
        keywords: [q2.number ?? "", q2.status],
      });
    }
  }

  for (const inv of index.invoices) {
    const hay = [inv.title, inv.number].filter(Boolean).join(" ");
    if (match(hay)) {
      results.push({
        id: `invoice-${inv.id}`,
        entityId: inv.id,
        category: "factures",
        path: `/invoices/${inv.id}`,
        label: inv.number ? `${inv.number} — ${inv.title}` : inv.title,
        hint: inv.status,
        group: "Factures",
        keywords: [inv.number ?? "", inv.status],
      });
    }
  }

  return results.slice(0, 40);
}

interface UseCommandPaletteIndexResult {
  items: SearchResult[];
  setQuery: (q: string) => void;
  refresh: () => Promise<void>;
}

export function useCommandPaletteIndex(): UseCommandPaletteIndexResult {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchResult[]>([]);
  const isLoadingRef = useRef(false);

  const refresh = async (): Promise<void> => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      await preloadSearchIndex();
    } finally {
      isLoadingRef.current = false;
    }
    setItems(buildItems(sharedIndex, query));
  };

  useEffect(() => {
    // Si l'index n'est pas chargé, le charger
    if (!sharedIndex.loadedAt) {
      void refresh();
    } else {
      setItems(buildItems(sharedIndex, query));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return { items, setQuery, refresh };
}
