import { formatQuoteNumber } from "@fakt/core";
import type { Client, Quote, QuoteStatus, Service, Workspace } from "@fakt/shared";
import {
  type ClientsApi,
  type NumberingApi,
  type PdfApi,
  type PrestationsApi,
  type QuotesApi,
  type WorkspaceApi,
  setClientsApi,
  setNumberingApi,
  setPdfApi,
  setPrestationsApi,
  setQuotesApi,
  setWorkspaceApi,
} from "../../../features/doc-editor/index.js";

export const FIXTURE_WORKSPACE: Workspace = {
  id: "ws-1",
  name: "Mon Entreprise",
  legalForm: "Micro-entreprise",
  siret: "12345678901234",
  address: "10 rue du Test, 84000 Avignon",
  email: "tom@example.com",
  iban: null,
  tvaMention: "TVA non applicable, art. 293 B du CGI",
  createdAt: Date.now(),
};

export const FIXTURE_CLIENT: Client = {
  id: "client-1",
  workspaceId: "ws-1",
  name: "Maison Berthe",
  legalForm: null,
  siret: null,
  address: null,
  contactName: null,
  email: "hello@berthe.fr",
  sector: null,
  firstCollaboration: null,
  note: null,
  archivedAt: null,
  createdAt: Date.now(),
};

export const FIXTURE_SERVICE: Service = {
  id: "svc-1",
  workspaceId: "ws-1",
  name: "Développement frontend",
  description: "Développement d'une page sur-mesure",
  unit: "jour",
  unitPriceCents: 50000,
  tags: null,
  archivedAt: null,
  createdAt: Date.now(),
};

interface Store {
  quotes: Map<string, Quote>;
  sequence: number;
}

export function installMockApis(options?: {
  quotes?: Quote[];
  clients?: Client[];
  services?: Service[];
  workspace?: Workspace | null;
}): { store: Store; reset: () => void } {
  const store: Store = {
    quotes: new Map((options?.quotes ?? []).map((q) => [q.id, q])),
    sequence: 0,
  };

  const clients = options?.clients ?? [FIXTURE_CLIENT];
  const services = options?.services ?? [FIXTURE_SERVICE];
  const workspace = options?.workspace ?? FIXTURE_WORKSPACE;

  const quotesMock: QuotesApi = {
    async list(): Promise<Quote[]> {
      return Array.from(store.quotes.values());
    },
    async get(id): Promise<Quote | null> {
      return store.quotes.get(id) ?? null;
    },
    async create(input): Promise<Quote> {
      const id = `q-${store.quotes.size + 1}`;
      let number: string | null = null;
      let year: number | null = null;
      let sequence: number | null = null;
      if (input.issueNumber) {
        store.sequence += 1;
        sequence = store.sequence;
        year = new Date().getFullYear();
        number = formatQuoteNumber(year, sequence);
      }
      const now = Date.now();
      const quote: Quote = {
        id,
        workspaceId: "ws-1",
        clientId: input.clientId,
        number,
        year,
        sequence,
        externalNumber: null,
        importedAt: null,
        title: input.title,
        status: "draft",
        totalHtCents: input.totalHtCents,
        conditions: input.conditions ?? null,
        clauses: input.clauses ?? [],
        originalTextHash: null,
        validityDate: input.validityDate ?? null,
        notes: input.notes ?? null,
        issuedAt: input.issueNumber ? now : null,
        signedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        items: input.items.map((item, idx) => ({
          id: item.id,
          position: item.position ?? idx,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          unit: item.unit,
          lineTotalCents: item.lineTotalCents,
          serviceId: item.serviceId ?? null,
        })),
      };
      store.quotes.set(id, quote);
      return quote;
    },
    async update(id, input): Promise<Quote> {
      const existing = store.quotes.get(id);
      if (!existing) throw new Error(`update: quote not found ${id}`);
      const updated: Quote = {
        ...existing,
        ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.validityDate !== undefined ? { validityDate: input.validityDate } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.totalHtCents !== undefined ? { totalHtCents: input.totalHtCents } : {}),
        items:
          input.items?.map((item, idx) => ({
            id: item.id,
            position: item.position ?? idx,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            unit: item.unit,
            lineTotalCents: item.lineTotalCents,
            serviceId: item.serviceId ?? null,
          })) ?? existing.items,
        updatedAt: Date.now(),
      };
      store.quotes.set(id, updated);
      return updated;
    },
    async updateStatus(id, status: QuoteStatus): Promise<Quote> {
      const existing = store.quotes.get(id);
      if (!existing) throw new Error(`updateStatus: quote not found ${id}`);
      const updated: Quote = { ...existing, status, updatedAt: Date.now() };
      store.quotes.set(id, updated);
      return updated;
    },
    async setOriginalTextHash(id, hash): Promise<Quote> {
      const existing = store.quotes.get(id);
      if (!existing) throw new Error(`setOriginalTextHash: quote not found ${id}`);
      const updated: Quote = { ...existing, originalTextHash: hash, updatedAt: Date.now() };
      store.quotes.set(id, updated);
      return updated;
    },
  };

  const clientsMock: ClientsApi = {
    async list(): Promise<Client[]> {
      return clients;
    },
    async get(id): Promise<Client | null> {
      return clients.find((c) => c.id === id) ?? null;
    },
  };

  const prestationsMock: PrestationsApi = {
    async list(): Promise<Service[]> {
      return services;
    },
  };

  const workspaceMock: WorkspaceApi = {
    async get(): Promise<Workspace | null> {
      return workspace;
    },
  };

  const numberingMock: NumberingApi = {
    async peekNextQuote() {
      const year = new Date().getFullYear();
      const sequence = store.sequence + 1;
      return {
        year,
        sequence,
        formatted: formatQuoteNumber(year, sequence),
      };
    },
  };

  const pdfMock: PdfApi = {
    async renderQuote(): Promise<Uint8Array> {
      return new Uint8Array([37, 80, 68, 70]); // "%PDF" magic bytes.
    },
    async renderInvoice(): Promise<Uint8Array> {
      return new Uint8Array([37, 80, 68, 70]); // "%PDF" magic bytes.
    },
    async renderAuditTrail(): Promise<Uint8Array> {
      return new Uint8Array([37, 80, 68, 70]); // "%PDF" magic bytes.
    },
    async saveDialog(): Promise<string | null> {
      return "/tmp/fake.pdf";
    },
    async writeFile(): Promise<void> {
      return;
    },
  };

  setQuotesApi(quotesMock);
  setClientsApi(clientsMock);
  setPrestationsApi(prestationsMock);
  setWorkspaceApi(workspaceMock);
  setNumberingApi(numberingMock);
  setPdfApi(pdfMock);

  return {
    store,
    reset: () => {
      setQuotesApi(null);
      setClientsApi(null);
      setPrestationsApi(null);
      setWorkspaceApi(null);
      setNumberingApi(null);
      setPdfApi(null);
    },
  };
}
