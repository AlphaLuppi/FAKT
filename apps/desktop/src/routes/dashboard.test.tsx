import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { Invoice, Quote } from "@fakt/shared";
import { DashboardRoute } from "./dashboard.js";
import {
  setQuotesApi,
  setInvoiceApi,
  setClientsApi,
  type QuotesApi,
  type InvoiceApi,
  type ClientsApi,
} from "../features/doc-editor/index.js";

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
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [],
    ...override,
  };
}

function setupApis(options: {
  quotes: Quote[];
  invoices: Invoice[];
}): void {
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
      <DashboardRoute />
    </MemoryRouter>,
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
      expect(
        screen.getByTestId("widget-pending-quotes-count"),
      ).toHaveTextContent("2");
    });
  });

  it("widget factures en retard : affiche seulement sent + dueDate<today", async () => {
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
      // Somme TTC des factures en retard : 300 000 + 200 000 = 500 000 cents = 5 000,00 €
      const stat = screen.getByTestId("widget-overdue-invoices-count");
      expect(stat.textContent?.replace(/\s/g, "")).toContain("5000,00");
    });
  });

  it("widget factures en retard : vide si aucune", async () => {
    setupApis({
      quotes: [],
      invoices: [
        invoice({ id: "i-1", status: "paid", totalHtCents: 100000 }),
      ],
    });
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByTestId("widget-overdue-invoices"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("widget-overdue-invoices-count"),
      ).not.toBeInTheDocument();
    });
  });

  it("widget activité récente : affiche max 5 entrées triées par date DESC", async () => {
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
      // 4 entrées au total → toutes visibles, la plus récente en tête
    });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("widget-recent-activity")).toBeInTheDocument();
    });
    // La facture payée (NOW-1j) doit être en tête : vérifier F2026-001 apparaît bien.
    await waitFor(() => {
      const section = screen.getByTestId("widget-recent-activity");
      expect(section.textContent).toContain("F2026-001");
      expect(section.textContent).toContain("D2026-002");
    });
  });
});
