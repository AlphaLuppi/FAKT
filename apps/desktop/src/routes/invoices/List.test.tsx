import type { Invoice } from "@fakt/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvoicesListRoute } from "./List.js";
import { FIXTURE_CLIENT, installInvoiceMockApis } from "./__test-helpers__/mockInvoiceApis.js";

const now = Date.now();

const INVOICE_FIXTURES: Invoice[] = [
  {
    id: "inv-1",
    workspaceId: "ws-1",
    clientId: FIXTURE_CLIENT.id,
    quoteId: null,
    number: "F2026-001",
    year: 2026,
    sequence: 1,
    kind: "independent",
    depositPercent: null,
    title: "Mission conseil",
    status: "sent",
    totalHtCents: 120000,
    dueDate: now + 30 * 86400000,
    paidAt: null,
    paymentMethod: "wire",
    paymentNotes: null,
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: now,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
  },
  {
    id: "inv-2",
    workspaceId: "ws-1",
    clientId: FIXTURE_CLIENT.id,
    quoteId: null,
    number: null,
    year: null,
    sequence: null,
    kind: "independent",
    depositPercent: null,
    title: "Audit UX",
    status: "draft",
    totalHtCents: 45000,
    dueDate: null,
    paidAt: null,
    paymentMethod: null,
    paymentNotes: null,
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: null,
    archivedAt: null,
    createdAt: now - 1000,
    updatedAt: now - 1000,
    items: [],
  },
];

describe("InvoicesListRoute", () => {
  let mocks: ReturnType<typeof installInvoiceMockApis>;

  beforeEach(() => {
    mocks = installInvoiceMockApis({ invoices: INVOICE_FIXTURES });
  });

  afterEach(() => {
    mocks.reset();
  });

  function renderRoute(): void {
    render(
      <MemoryRouter>
        <InvoicesListRoute />
      </MemoryRouter>
    );
  }

  it("affiche les factures récupérées depuis l'API", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText("Mission conseil")).toBeInTheDocument();
      expect(screen.getByText("Audit UX")).toBeInTheDocument();
    });
  });

  it("affiche le numéro pour les factures émises, — pour les drafts", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText("F2026-001")).toBeInTheDocument();
    });
  });

  it("filtre par statut via les chips", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText("Mission conseil")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("invoice-status-filter-draft"));
    await waitFor(() => {
      expect(screen.queryByText("Mission conseil")).not.toBeInTheDocument();
      expect(screen.getByText("Audit UX")).toBeInTheDocument();
    });
  });

  it("propose un menu [From Quote / From Scratch]", async () => {
    renderRoute();
    fireEvent.click(screen.getByTestId("new-invoice-menu"));
    expect(screen.getByTestId("new-invoice-from-quote")).toBeInTheDocument();
    expect(screen.getByTestId("new-invoice-from-scratch")).toBeInTheDocument();
  });

  it("affiche l'état vide quand aucune facture", async () => {
    mocks.reset();
    mocks = installInvoiceMockApis({ invoices: [] });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("invoices-empty")).toBeInTheDocument();
    });
  });
});
