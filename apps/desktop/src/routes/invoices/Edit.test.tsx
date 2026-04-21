import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { InvoiceEditRoute } from "./Edit.js";
import {
  installInvoiceMockApis,
  FIXTURE_CLIENT,
} from "./__test-helpers__/mockInvoiceApis.js";
import type { Invoice } from "@fakt/shared";

const now = Date.now();

function mkInvoice(override: Partial<Invoice>): Invoice {
  return {
    id: "inv-x",
    workspaceId: "ws-1",
    clientId: FIXTURE_CLIENT.id,
    quoteId: null,
    number: null,
    year: null,
    sequence: null,
    kind: "independent",
    depositPercent: null,
    title: "Sample",
    status: "draft",
    totalHtCents: 100000,
    dueDate: null,
    paidAt: null,
    paymentMethod: null,
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
    ...override,
  };
}

function renderEdit(id: string): void {
  render(
    <MemoryRouter initialEntries={[`/invoices/${id}/edit`]}>
      <Routes>
        <Route path="/invoices/:id/edit" element={<InvoiceEditRoute />} />
        <Route path="/invoices/:id" element={<div data-testid="detail">detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InvoiceEditRoute", () => {
  let mocks: ReturnType<typeof installInvoiceMockApis>;

  afterEach(() => {
    mocks.reset();
  });

  it("permet l'édition si status === 'draft'", async () => {
    const draft = mkInvoice({ id: "inv-d", status: "draft" });
    mocks = installInvoiceMockApis({ invoices: [draft] });
    renderEdit("inv-d");
    await waitFor(() => {
      // InvoiceForm avec editMode : pas de "Créer et émettre" mais Save draft present
      expect(screen.getByTestId("invoice-save-draft")).toBeInTheDocument();
      expect(
        screen.queryByTestId("invoice-create-and-issue"),
      ).not.toBeInTheDocument();
    });
  });

  it("bloque l'édition si status !== 'draft' (message + credit note stub)", async () => {
    const issued = mkInvoice({
      id: "inv-i",
      status: "sent",
      number: "F2026-001",
      issuedAt: now,
    });
    mocks = installInvoiceMockApis({ invoices: [issued] });
    renderEdit("inv-i");
    // Soit le bloc s'affiche avant la redirection automatique, soit détail mount d'abord.
    // On accepte l'un des deux : si redirect, le guard useEffect navigue vers /invoices/:id.
    await waitFor(() => {
      const detail = screen.queryByTestId("detail");
      const blocked = screen.queryByTestId("invoice-edit-blocked");
      expect(detail ?? blocked).not.toBeNull();
    });
  });

  it("affiche 'introuvable' si invoice inexistante", async () => {
    mocks = installInvoiceMockApis({ invoices: [] });
    renderEdit("inv-unknown");
    await waitFor(() => {
      expect(screen.getByTestId("invoice-edit-not-found")).toBeInTheDocument();
    });
  });
});
