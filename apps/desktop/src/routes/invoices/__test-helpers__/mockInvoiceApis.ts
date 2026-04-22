import type {
  Invoice,
  InvoiceStatus,
  InvoiceKind,
  Client,
  Service,
  Workspace,
  Quote,
  PaymentMethod,
} from "@fakt/shared";
import { formatInvoiceNumber } from "@fakt/core";
import {
  setInvoiceApi,
  setQuotesApi,
  setClientsApi,
  setPrestationsApi,
  setWorkspaceApi,
  setPdfApi,
  type InvoiceApi,
  type QuotesApi,
  type ClientsApi,
  type PrestationsApi,
  type WorkspaceApi,
  type PdfApi,
} from "../../../features/doc-editor/index.js";

export const FIXTURE_WORKSPACE: Workspace = {
  id: "ws-1",
  name: "Atelier Mercier",
  legalForm: "Micro-entreprise",
  siret: "12345678901234",
  address: "10 rue du Test, 84000 Avignon",
  email: "tom@example.com",
  iban: "FR76 3000 6000 0112 3456 7890 189",
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

export const FIXTURE_SIGNED_QUOTE: Quote = {
  id: "q-signed-1",
  workspaceId: "ws-1",
  clientId: "client-1",
  number: "D2026-001",
  year: 2026,
  sequence: 1,
  title: "Refonte site vitrine",
  status: "signed",
  totalHtCents: 500000,
  conditions: null,
  validityDate: null,
  notes: null,
  issuedAt: Date.now() - 86400000,
  signedAt: Date.now() - 3600000,
  archivedAt: null,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now() - 3600000,
  items: [
    {
      id: "qi-1",
      position: 0,
      description: "Conception & maquettes",
      quantity: 5000,
      unitPriceCents: 50000,
      unit: "jour",
      lineTotalCents: 250000,
      serviceId: null,
    },
    {
      id: "qi-2",
      position: 1,
      description: "Intégration & développement",
      quantity: 5000,
      unitPriceCents: 50000,
      unit: "jour",
      lineTotalCents: 250000,
      serviceId: null,
    },
  ],
};

interface Store {
  invoices: Map<string, Invoice>;
  quotes: Map<string, Quote>;
  sequence: number;
}

export interface InstallOptions {
  invoices?: Invoice[];
  quotes?: Quote[];
  clients?: Client[];
  services?: Service[];
  workspace?: Workspace | null;
  /** Si true, simulate l'échec sur delete d'une facture non-draft (DB guard). */
  deleteGuardEnabled?: boolean;
}

export function installInvoiceMockApis(options?: InstallOptions): {
  store: Store;
  reset: () => void;
} {
  const store: Store = {
    invoices: new Map((options?.invoices ?? []).map((i) => [i.id, i])),
    quotes: new Map((options?.quotes ?? []).map((q) => [q.id, q])),
    sequence: 0,
  };

  const clients = options?.clients ?? [FIXTURE_CLIENT];
  const services = options?.services ?? [FIXTURE_SERVICE];
  const workspace = options?.workspace ?? FIXTURE_WORKSPACE;
  const deleteGuardEnabled = options?.deleteGuardEnabled ?? true;

  function nextNumber(): { number: string; year: number; sequence: number } {
    store.sequence += 1;
    const year = new Date().getFullYear();
    return {
      number: formatInvoiceNumber(year, store.sequence),
      year,
      sequence: store.sequence,
    };
  }

  const invoiceMock: InvoiceApi = {
    async list(input): Promise<Invoice[]> {
      let results = Array.from(store.invoices.values());
      if (input?.quoteId) {
        results = results.filter((i) => i.quoteId === input.quoteId);
      }
      if (input?.status) {
        const statuses = Array.isArray(input.status)
          ? input.status
          : [input.status];
        results = results.filter((i) => statuses.includes(i.status));
      }
      return results;
    },
    async get(id): Promise<Invoice | null> {
      return store.invoices.get(id) ?? null;
    },
    async create(input): Promise<Invoice> {
      const id = `inv-${store.invoices.size + 1}`;
      let number: string | null = null;
      let year: number | null = null;
      let sequence: number | null = null;
      let status: InvoiceStatus = "draft";
      let issuedAt: number | null = null;
      if (input.issueNumber) {
        const n = nextNumber();
        number = n.number;
        year = n.year;
        sequence = n.sequence;
        status = "draft";
        issuedAt = Date.now();
      }
      const now = Date.now();
      const invoice: Invoice = {
        id,
        workspaceId: "ws-1",
        clientId: input.clientId,
        quoteId: input.quoteId ?? null,
        number,
        year,
        sequence,
        kind: input.kind,
        depositPercent: input.depositPercent ?? null,
        title: input.title,
        status,
        totalHtCents: input.totalHtCents,
        dueDate: input.dueDate ?? null,
        paidAt: null,
        paymentMethod: input.paymentMethod ?? null,
        paymentNotes: null,
        legalMentions: input.legalMentions,
        issuedAt,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        items: input.items.map((item, idx) => ({
          id: item.id,
          position: idx,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          unit: item.unit,
          lineTotalCents: item.lineTotalCents,
          serviceId: item.serviceId ?? null,
        })),
      };
      store.invoices.set(id, invoice);
      return invoice;
    },
    async createFromQuote(input): Promise<Invoice> {
      const quote = store.quotes.get(input.quoteId);
      if (!quote) throw new Error(`Quote ${input.quoteId} not found`);

      let kind: InvoiceKind;
      let totalHtCents: number;
      let depositPercent: number | null = null;

      if (input.mode === "deposit30") {
        kind = "deposit";
        depositPercent = 30;
        totalHtCents =
          input.totalHtCents ?? Math.floor((quote.totalHtCents * 30) / 100);
      } else if (input.mode === "full") {
        kind = "total";
        totalHtCents = input.totalHtCents ?? quote.totalHtCents;
      } else {
        kind = "balance";
        // calcule le solde
        const existingDeposits = Array.from(store.invoices.values())
          .filter((inv) => inv.quoteId === quote.id && inv.kind === "deposit")
          .reduce((sum, inv) => sum + inv.totalHtCents, 0);
        totalHtCents = input.totalHtCents ?? quote.totalHtCents - existingDeposits;
      }

      const id = `inv-${store.invoices.size + 1}`;
      const now = Date.now();
      let number: string | null = null;
      let year: number | null = null;
      let sequence: number | null = null;
      let issuedAt: number | null = null;

      if (input.issueNumber) {
        const n = nextNumber();
        number = n.number;
        year = n.year;
        sequence = n.sequence;
        issuedAt = now;
      }

      const invoice: Invoice = {
        id,
        workspaceId: quote.workspaceId,
        clientId: quote.clientId,
        quoteId: quote.id,
        number,
        year,
        sequence,
        kind,
        depositPercent,
        title: input.title ?? quote.title,
        status: "draft",
        totalHtCents,
        dueDate: input.dueDate ?? null,
        paidAt: null,
        paymentMethod: input.paymentMethod ?? null,
        paymentNotes: null,
        legalMentions: input.legalMentions,
        issuedAt,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        items:
          input.items?.map((item, idx) => ({
            id: item.id,
            position: idx,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            unit: item.unit,
            lineTotalCents: item.lineTotalCents,
            serviceId: item.serviceId ?? null,
          })) ??
          quote.items.map((item) => ({
            id: `${id}-item-${item.position}`,
            position: item.position,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            unit: item.unit,
            lineTotalCents: item.lineTotalCents,
            serviceId: item.serviceId,
          })),
      };
      store.invoices.set(id, invoice);
      return invoice;
    },
    async update(id, input): Promise<Invoice> {
      const existing = store.invoices.get(id);
      if (!existing) throw new Error(`update: invoice not found ${id}`);
      if (existing.status !== "draft") {
        throw new Error(
          "invoice is not in draft status — cannot update",
        );
      }
      const updated: Invoice = {
        ...existing,
        ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.paymentMethod !== undefined
          ? { paymentMethod: input.paymentMethod ?? null }
          : {}),
        ...(input.totalHtCents !== undefined
          ? { totalHtCents: input.totalHtCents }
          : {}),
        items:
          input.items?.map((item, idx) => ({
            id: item.id,
            position: idx,
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            unit: item.unit,
            lineTotalCents: item.lineTotalCents,
            serviceId: item.serviceId ?? null,
          })) ?? existing.items,
        updatedAt: Date.now(),
      };
      store.invoices.set(id, updated);
      return updated;
    },
    async updateStatus(id, status): Promise<Invoice> {
      const existing = store.invoices.get(id);
      if (!existing) throw new Error(`updateStatus: invoice not found ${id}`);
      if (status === "sent" && existing.status !== "draft") {
        throw new Error(
          `updateStatus: invalid transition ${existing.status} → ${status}`,
        );
      }
      const updated: Invoice = {
        ...existing,
        status,
        updatedAt: Date.now(),
      };
      store.invoices.set(id, updated);
      return updated;
    },
    async markPaid(id, input): Promise<Invoice> {
      const existing = store.invoices.get(id);
      if (!existing) throw new Error(`markPaid: invoice not found ${id}`);
      if (existing.status !== "sent" && existing.status !== "overdue") {
        throw new Error(
          `markPaid: invalid transition ${existing.status} → paid`,
        );
      }
      const updated: Invoice = {
        ...existing,
        status: "paid",
        paidAt: input.paidAt,
        paymentMethod: input.method as PaymentMethod,
        updatedAt: Date.now(),
      };
      store.invoices.set(id, updated);
      return updated;
    },
    async delete(id): Promise<void> {
      const existing = store.invoices.get(id);
      if (!existing) throw new Error(`delete: invoice not found ${id}`);
      if (deleteGuardEnabled && existing.status !== "draft") {
        throw new Error(
          "cannot hard delete non-draft invoice (archival mandatory 10y CGI)",
        );
      }
      store.invoices.delete(id);
    },
  };

  const quotesMock: QuotesApi = {
    async list(input): Promise<Quote[]> {
      let results = Array.from(store.quotes.values());
      if (input?.status) {
        const statuses = Array.isArray(input.status)
          ? input.status
          : [input.status];
        results = results.filter((q) => statuses.includes(q.status));
      }
      return results;
    },
    async get(id): Promise<Quote | null> {
      return store.quotes.get(id) ?? null;
    },
    async create(): Promise<Quote> {
      throw new Error("not implemented in invoice mocks");
    },
    async update(): Promise<Quote> {
      throw new Error("not implemented in invoice mocks");
    },
    async updateStatus(id, status): Promise<Quote> {
      const existing = store.quotes.get(id);
      if (!existing) throw new Error(`updateStatus: quote not found ${id}`);
      const updated: Quote = { ...existing, status, updatedAt: Date.now() };
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

  const pdfMock: PdfApi = {
    async renderQuote(): Promise<Uint8Array> {
      return new Uint8Array([37, 80, 68, 70]);
    },
    async renderInvoice(): Promise<Uint8Array> {
      return new Uint8Array([37, 80, 68, 70]);
    },
    async saveDialog(): Promise<string | null> {
      return "/tmp/fake.pdf";
    },
    async writeFile(): Promise<void> {
      return;
    },
  };

  setInvoiceApi(invoiceMock);
  setQuotesApi(quotesMock);
  setClientsApi(clientsMock);
  setPrestationsApi(prestationsMock);
  setWorkspaceApi(workspaceMock);
  setPdfApi(pdfMock);

  return {
    store,
    reset: (): void => {
      setInvoiceApi(null);
      setQuotesApi(null);
      setClientsApi(null);
      setPrestationsApi(null);
      setWorkspaceApi(null);
      setPdfApi(null);
    },
  };
}
