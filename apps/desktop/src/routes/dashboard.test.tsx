import type { Invoice, Quote } from "@fakt/shared";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerSidebarProvider } from "../components/composer-sidebar/ComposerContext.js";
import {
  type ClientsApi,
  type InvoiceApi,
  type QuotesApi,
  setClientsApi,
  setInvoiceApi,
  setQuotesApi,
} from "../features/doc-editor/index.js";
import { DashboardRoute } from "./dashboard.js";

const WS = "ws-1";
const CLIENT_ID = "c-1";
const NOW = Date.now();
const ONE_DAY = 24 * 3600 * 1000;

function quote(override: Partial<Quote>): Quote {
  return {
    id: "q-x",
    workspaceId: WS,
    clientId: CLIENT_ID,
    number: null,
    year: null,
    sequence: null,
    title: "Devis test",
    status: "draft",
    totalHtCents: 100000,
    conditions: null,
    validityDate: null,
    notes: null,
    issuedAt: null,
    signedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [],
    ...override,
  };
}

function invoice(override: Partial<Invoice>): Invoice {
  return {
    id: "i-x",
    workspaceId: WS,
    clientId: CLIENT_ID,
    quoteId: null,
    number: null,
    year: null,
    sequence: null,
    kind: "independent",
    depositPercent: null,
    title: "Facture test",
    status: "draft",
    totalHtCents: 200000,
    dueDate: null,
    paidAt: null,
    paymentMethod: null,
    paymentNotes: null,
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [],
    ...override,
  };
}

function setupApis(options: { quotes: Quote[]; invoices: Invoice[] }): void {
  const qApi: Partial<QuotesApi> = {
    async list() {
      return options.quotes;
    },
    async get(id) {
      return options.quotes.find((q) => q.id === id) ?? null;
    },
  };
  const iApi: Partial<InvoiceApi> = {
    async list() {
      return options.invoices;
    },
    async get(id) {
      return options.invoices.find((i) => i.id === id) ?? null;
    },
  };
  const cApi: Partial<ClientsApi> = {
    async list() {
      return [];
    },
    async get() {
      return null;
    },
  };
  setQuotesApi(qApi as QuotesApi);
  setInvoiceApi(iApi as InvoiceApi);
  setClientsApi(cApi as ClientsApi);
}

function renderDashboard(): void {
  render(
    <MemoryRouter>
      <ComposerSidebarProvider>
        <DashboardRoute />
      </ComposerSidebarProvider>
    </MemoryRouter>
  );
}

describe("DashboardRoute", () => {
  afterEach(() => {
    setQuotesApi(null);
    setInvoiceApi(null);
    setClientsApi(null);
  });

  it("affiche le titre du dashboard", async () => {
    setupApis({ quotes: [], invoices: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-root")).toBeInTheDocument();
    });
  });

  it("affiche les 4 KPIs", async () => {
    setupApis({ quotes: [], invoices: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("kpi-ca-emis")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-ca-encaisse")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-devis-attente")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-factures-retard")).toBeInTheDocument();
    });
  });

  it("affiche le pipeline", async () => {
    setupApis({ quotes: [], invoices: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-pipeline")).toBeInTheDocument();
    });
  });

  it("widget devis en attente : affiche le count des devis status='sent'", async () => {
    setupApis({
      quotes: [
        quote({ id: "q-1", status: "sent", number: "D2026-001" }),
        quote({ id: "q-2", status: "sent", number: "D2026-002" }),
        quote({ id: "q-3", status: "draft" }),
        quote({ id: "q-4", status: "signed", number: "D2026-003" }),
      ],
      invoices: [],
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("kpi-devis-attente-value")).toHaveTextContent("2");
    });
  });

  it("widget factures en retard : affiche le count overdue", async () => {
    const pastDue = NOW - 30 * ONE_DAY;
    const futureDue = NOW + 30 * ONE_DAY;
    setupApis({
      quotes: [],
      invoices: [
        invoice({
          id: "i-1",
          status: "sent",
          dueDate: pastDue,
          totalHtCents: 300000,
          number: "F2026-001",
        }),
        invoice({
          id: "i-2",
          status: "sent",
          dueDate: pastDue,
          totalHtCents: 200000,
          number: "F2026-002",
        }),
        invoice({
          id: "i-3",
          status: "sent",
          dueDate: futureDue,
          totalHtCents: 100000,
          number: "F2026-003",
        }),
        invoice({
          id: "i-4",
          status: "paid",
          dueDate: pastDue,
          totalHtCents: 500000,
          number: "F2026-004",
        }),
      ],
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("kpi-factures-retard-value")).toHaveTextContent("2");
    });
  });

  it("widget activité récente : affiche les entrées triées par date DESC", async () => {
    setupApis({
      quotes: [
        quote({
          id: "q-1",
          createdAt: NOW - 6 * ONE_DAY,
          updatedAt: NOW - 6 * ONE_DAY,
          number: "D2026-001",
        }),
        quote({
          id: "q-2",
          status: "sent",
          issuedAt: NOW - 2 * ONE_DAY,
          createdAt: NOW - 5 * ONE_DAY,
          updatedAt: NOW - 2 * ONE_DAY,
          number: "D2026-002",
        }),
      ],
      invoices: [
        invoice({
          id: "i-1",
          status: "paid",
          paidAt: NOW - 1 * ONE_DAY,
          createdAt: NOW - 3 * ONE_DAY,
          updatedAt: NOW - 1 * ONE_DAY,
          number: "F2026-001",
        }),
        invoice({
          id: "i-2",
          status: "sent",
          issuedAt: NOW - 4 * ONE_DAY,
          createdAt: NOW - 4 * ONE_DAY,
          updatedAt: NOW - 4 * ONE_DAY,
          number: "F2026-002",
        }),
      ],
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("widget-recent-activity")).toBeInTheDocument();
    });
    await waitFor(() => {
      const section = screen.getByTestId("widget-recent-activity");
      expect(section.textContent).toContain("F2026-001");
      expect(section.textContent).toContain("D2026-002");
    });
  });

  it("section suggestions IA s'affiche", async () => {
    setupApis({ quotes: [], invoices: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-suggestions")).toBeInTheDocument();
    });
  });
});
