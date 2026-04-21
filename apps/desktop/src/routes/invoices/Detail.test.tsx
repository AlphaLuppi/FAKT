import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { InvoiceDetailRoute } from "./Detail.js";
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
    number: "F2026-001",
    year: 2026,
    sequence: 1,
    kind: "independent",
    depositPercent: null,
    title: "Sample",
    status: "sent",
    totalHtCents: 100000,
    dueDate: null,
    paidAt: null,
    paymentMethod: "wire",
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: now,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
    ...override,
  };
}

function renderDetail(id: string): void {
  render(
    <MemoryRouter initialEntries={[`/invoices/${id}`]}>
      <Routes>
        <Route path="/invoices/:id" element={<InvoiceDetailRoute />} />
        <Route path="/invoices" element={<div data-testid="list">list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InvoiceDetailRoute", () => {
  let mocks: ReturnType<typeof installInvoiceMockApis>;

  beforeEach(() => {
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(
        () => "blob:mocked",
      ) as unknown as typeof URL.createObjectURL;
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mocked");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL =
        vi.fn() as unknown as typeof URL.revokeObjectURL;
    }
  });

  afterEach(() => {
    mocks.reset();
    vi.restoreAllMocks();
  });

  it("affiche le numéro et le StatusPill", async () => {
    const invoice = mkInvoice({ id: "inv-1", status: "sent" });
    mocks = installInvoiceMockApis({ invoices: [invoice] });
    renderDetail("inv-1");

    await waitFor(() => {
      expect(screen.getAllByText("F2026-001").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("actions Send/MarkPaid sont stub (désactivés)", async () => {
    const invoice = mkInvoice({ id: "inv-2", status: "sent" });
    mocks = installInvoiceMockApis({ invoices: [invoice] });
    renderDetail("inv-2");

    await waitFor(() => {
      const sendBtn = screen.getByTestId("invoice-detail-send-stub");
      expect(sendBtn).toBeDisabled();
      const markPaid = screen.getByTestId("invoice-detail-markpaid-stub");
      expect(markPaid).toBeDisabled();
    });
  });

  it("bouton Supprimer est ABSENT si status !== 'draft' (protection)", async () => {
    const invoice = mkInvoice({ id: "inv-3", status: "sent" });
    mocks = installInvoiceMockApis({ invoices: [invoice] });
    renderDetail("inv-3");

    await waitFor(() => {
      expect(screen.getAllByText("F2026-001").length).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.queryByTestId("invoice-detail-delete"),
    ).not.toBeInTheDocument();
  });

  it("bouton Éditer désactivé si non-draft", async () => {
    const invoice = mkInvoice({ id: "inv-4", status: "paid" });
    mocks = installInvoiceMockApis({ invoices: [invoice] });
    renderDetail("inv-4");

    await waitFor(() => {
      const editBtn = screen.getByTestId("invoice-detail-edit");
      expect(editBtn).toBeDisabled();
    });
  });

  it("bouton Supprimer PRÉSENT si status === 'draft'", async () => {
    const invoice = mkInvoice({
      id: "inv-5",
      status: "draft",
      number: null,
      issuedAt: null,
    });
    mocks = installInvoiceMockApis({ invoices: [invoice] });
    renderDetail("inv-5");

    await waitFor(() => {
      expect(screen.getByTestId("invoice-detail-delete")).toBeInTheDocument();
    });
  });

  it("delete sur draft fonctionne, delete sur issued throw (guard DB)", async () => {
    const draft = mkInvoice({
      id: "inv-d",
      status: "draft",
      number: null,
      issuedAt: null,
    });
    const issued = mkInvoice({ id: "inv-i", status: "sent" });
    mocks = installInvoiceMockApis({ invoices: [draft, issued] });

    // Appel direct du mock API pour tester le guard DB.
    const { invoiceApi } = await import("../../features/doc-editor/index.js");
    await invoiceApi.delete(draft.id);
    expect(mocks.store.invoices.has(draft.id)).toBe(false);

    let caught: Error | null = null;
    try {
      await invoiceApi.delete(issued.id);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught?.message).toMatch(/non-draft|archival|10y/i);
    expect(mocks.store.invoices.has(issued.id)).toBe(true);
  });

  it("affiche 'introuvable' si invoice inexistante", async () => {
    mocks = installInvoiceMockApis({ invoices: [] });
    renderDetail("inv-missing");

    await waitFor(() => {
      expect(
        screen.getByTestId("invoice-detail-not-found"),
      ).toBeInTheDocument();
    });
  });
});
