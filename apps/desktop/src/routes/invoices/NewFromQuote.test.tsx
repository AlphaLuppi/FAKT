import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewFromQuote } from "./NewFromQuote.js";
import {
  FIXTURE_SIGNED_QUOTE,
  installInvoiceMockApis,
} from "./__test-helpers__/mockInvoiceApis.js";

describe("NewFromQuote", () => {
  let mocks: ReturnType<typeof installInvoiceMockApis>;

  beforeEach(() => {
    mocks = installInvoiceMockApis({ quotes: [FIXTURE_SIGNED_QUOTE] });
  });

  afterEach(() => {
    mocks.reset();
  });

  function renderRoute(): void {
    render(
      <MemoryRouter initialEntries={["/invoices/new?from=quote"]}>
        <NewFromQuote />
      </MemoryRouter>
    );
  }

  it("affiche le picker trigger et auto-sélectionne le 1er devis éligible", async () => {
    renderRoute();
    // Trigger toujours visible avant sélection.
    await waitFor(() => {
      expect(screen.getByTestId("quote-picker-trigger")).toBeInTheDocument();
    });
    // Auto-sélection → form de mode visible sans clic utilisateur.
    await waitFor(() => {
      expect(screen.getByTestId("mode-radio-deposit30")).toBeInTheDocument();
      expect(screen.getByTestId("mode-radio-balance")).toBeInTheDocument();
      expect(screen.getByTestId("mode-radio-full")).toBeInTheDocument();
    });
  });

  it("ouvre la modal du picker et permet de sélectionner via une row", async () => {
    renderRoute();
    const trigger = await screen.findByTestId("quote-picker-trigger");
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByTestId("quote-picker-modal")).toBeInTheDocument();
    });
    const row = screen.getByTestId(`quote-picker-row-${FIXTURE_SIGNED_QUOTE.id}`);
    fireEvent.click(row);
    // Modal se ferme après sélection.
    await waitFor(() => {
      expect(screen.queryByTestId("quote-picker-modal")).not.toBeInTheDocument();
    });
  });

  it("filtre 'sans facture' : devis signé sans aucune facture est listé", async () => {
    renderRoute();
    fireEvent.click(await screen.findByTestId("quote-picker-trigger"));
    fireEvent.click(await screen.findByTestId("quote-picker-filter-unbilled"));
    expect(screen.getByTestId(`quote-picker-row-${FIXTURE_SIGNED_QUOTE.id}`)).toBeInTheDocument();
  });

  it("mode acompte 30% : affiche une ligne avec 30% du total", async () => {
    renderRoute();
    await waitFor(() => {
      const total = screen.getByTestId("invoice-total");
      // 30 % de 500 000 cents = 150 000 cents = 1 500,00 €
      expect(total.textContent?.replace(/\s/g, "")).toContain("1500,00");
    });
  });

  it("mode total (full) : recopie toutes les lignes du devis", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("mode-radio-full")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("mode-radio-full"));

    await waitFor(() => {
      // 2 items copiés du devis
      expect(screen.getByTestId("item-row-0")).toBeInTheDocument();
      expect(screen.getByTestId("item-row-1")).toBeInTheDocument();
    });
    const total = screen.getByTestId("invoice-total");
    expect(total.textContent?.replace(/\s/g, "")).toContain("5000,00");
  });

  it("mode solde (balance) : calcule le solde après acompte", async () => {
    mocks.reset();
    mocks = installInvoiceMockApis({
      quotes: [FIXTURE_SIGNED_QUOTE],
      invoices: [
        {
          id: "inv-deposit",
          workspaceId: "ws-1",
          clientId: "client-1",
          quoteId: FIXTURE_SIGNED_QUOTE.id,
          number: "F2026-001",
          year: 2026,
          sequence: 1,
          externalNumber: null,
          importedAt: null,
          kind: "deposit",
          depositPercent: 30,
          title: "Acompte",
          status: "paid",
          totalHtCents: 150000,
          dueDate: null,
          paidAt: Date.now(),
          paymentMethod: "wire",
          paymentNotes: null,
          legalMentions: "TVA non applicable, art. 293 B du CGI",
          issuedAt: Date.now() - 86400000,
          archivedAt: null,
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now(),
          items: [],
        },
      ],
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("mode-radio-balance")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("mode-radio-balance"));

    await waitFor(() => {
      const total = screen.getByTestId("invoice-total");
      // 500 000 - 150 000 = 350 000 cents = 3 500,00 €
      expect(total.textContent?.replace(/\s/g, "")).toContain("3500,00");
    });
  });

  it("filtre 'acompte facturé' : un devis avec acompte payé y apparaît", async () => {
    mocks.reset();
    mocks = installInvoiceMockApis({
      quotes: [FIXTURE_SIGNED_QUOTE],
      invoices: [
        {
          id: "inv-deposit",
          workspaceId: "ws-1",
          clientId: "client-1",
          quoteId: FIXTURE_SIGNED_QUOTE.id,
          number: "F2026-001",
          year: 2026,
          sequence: 1,
          externalNumber: null,
          importedAt: null,
          kind: "deposit",
          depositPercent: 30,
          title: "Acompte",
          status: "paid",
          totalHtCents: 150000,
          dueDate: null,
          paidAt: Date.now(),
          paymentMethod: "wire",
          paymentNotes: null,
          legalMentions: "TVA non applicable, art. 293 B du CGI",
          issuedAt: Date.now() - 86400000,
          archivedAt: null,
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now(),
          items: [],
        },
      ],
    });
    renderRoute();
    fireEvent.click(await screen.findByTestId("quote-picker-trigger"));
    fireEvent.click(await screen.findByTestId("quote-picker-filter-deposit-paid"));
    expect(screen.getByTestId(`quote-picker-row-${FIXTURE_SIGNED_QUOTE.id}`)).toBeInTheDocument();
  });

  it("exclut un devis dont la facture totale a déjà été émise", async () => {
    mocks.reset();
    mocks = installInvoiceMockApis({
      quotes: [FIXTURE_SIGNED_QUOTE],
      invoices: [
        {
          id: "inv-total",
          workspaceId: "ws-1",
          clientId: "client-1",
          quoteId: FIXTURE_SIGNED_QUOTE.id,
          number: "F2026-002",
          year: 2026,
          sequence: 2,
          externalNumber: null,
          importedAt: null,
          kind: "total",
          depositPercent: null,
          title: "Total",
          status: "sent",
          totalHtCents: 500000,
          dueDate: null,
          paidAt: null,
          paymentMethod: "wire",
          paymentNotes: null,
          legalMentions: "TVA non applicable, art. 293 B du CGI",
          issuedAt: Date.now() - 3600000,
          archivedAt: null,
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          items: [],
        },
      ],
    });
    renderRoute();
    // Aucun devis éligible → message vide affiché, pas de trigger.
    await waitFor(() => {
      expect(screen.getByTestId("no-signed-quote")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("quote-picker-trigger")).not.toBeInTheDocument();
  });

  it("crée la facture en mode from-quote avec numéro F2026-XXX", async () => {
    renderRoute();
    await waitFor(() => {
      const total = screen.getByTestId("invoice-total");
      expect(total.textContent?.replace(/\s/g, "")).toContain("1500,00");
    });

    fireEvent.click(screen.getByTestId("invoice-create-and-issue"));

    await waitFor(() => {
      const invoices = Array.from(mocks.store.invoices.values());
      expect(invoices).toHaveLength(1);
      const inv = invoices[0];
      if (inv === undefined) throw new Error("invoice manquante apres create-and-issue");
      expect(inv.number).toMatch(/^F\d{4}-\d{3}$/);
      expect(inv.kind).toBe("deposit");
      expect(inv.quoteId).toBe(FIXTURE_SIGNED_QUOTE.id);
    });
  });

  it("mode total (full) : passe le devis lié à 'invoiced' automatiquement", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("mode-radio-full")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("mode-radio-full"));
    await waitFor(() => {
      expect(screen.getByTestId("invoice-create-and-issue")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("invoice-create-and-issue"));

    await waitFor(() => {
      const stored = mocks.store.quotes.get(FIXTURE_SIGNED_QUOTE.id);
      expect(stored?.status).toBe("invoiced");
    });
  });

  it("mode acompte 30% : le devis lié reste 'signed' (pas de transition auto)", async () => {
    renderRoute();
    await waitFor(() => {
      const total = screen.getByTestId("invoice-total");
      expect(total.textContent?.replace(/\s/g, "")).toContain("1500,00");
    });

    fireEvent.click(screen.getByTestId("invoice-create-and-issue"));

    await waitFor(() => {
      const invoices = Array.from(mocks.store.invoices.values());
      expect(invoices).toHaveLength(1);
    });
    const stored = mocks.store.quotes.get(FIXTURE_SIGNED_QUOTE.id);
    expect(stored?.status).toBe("signed");
  });
});
