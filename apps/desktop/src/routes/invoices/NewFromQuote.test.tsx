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

  it("affiche le picker et les 3 modes radio", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });

    // Sélection du devis signé
    const picker = screen.getByTestId("quote-picker");
    fireEvent.change(picker, { target: { value: FIXTURE_SIGNED_QUOTE.id } });

    await waitFor(() => {
      expect(screen.getByTestId("mode-radio-deposit30")).toBeInTheDocument();
      expect(screen.getByTestId("mode-radio-balance")).toBeInTheDocument();
      expect(screen.getByTestId("mode-radio-full")).toBeInTheDocument();
    });
  });

  it("affiche un bouton Continuer actif sous le picker (auto-select 1er devis)", async () => {
    renderRoute();
    // Auto-sélection du 1er devis (FIXTURE_SIGNED_QUOTE est seul) → bouton actif sans clic.
    const button = await screen.findByTestId("quote-picker-continue");
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.textContent).toContain("Continuer");
  });

  it("mode acompte 30% : affiche une ligne avec 30% du total", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("quote-picker"), {
      target: { value: FIXTURE_SIGNED_QUOTE.id },
    });
    await waitFor(() => {
      expect(screen.getByTestId("mode-radio-deposit30")).toBeInTheDocument();
    });

    const total = await screen.findByTestId("invoice-total");
    // 30 % de 500 000 cents = 150 000 cents = 1 500,00 €
    expect(total.textContent?.replace(/\s/g, "")).toContain("1500,00");
  });

  it("mode total (full) : recopie toutes les lignes du devis", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("quote-picker"), {
      target: { value: FIXTURE_SIGNED_QUOTE.id },
    });
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
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("quote-picker"), {
      target: { value: FIXTURE_SIGNED_QUOTE.id },
    });
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

  it("crée la facture en mode from-quote avec numéro F2026-XXX", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("quote-picker"), {
      target: { value: FIXTURE_SIGNED_QUOTE.id },
    });
    await waitFor(() => {
      expect(screen.getByTestId("invoice-create-and-issue")).toBeInTheDocument();
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
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("quote-picker"), {
      target: { value: FIXTURE_SIGNED_QUOTE.id },
    });
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
      expect(screen.getByTestId("quote-picker")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("quote-picker"), {
      target: { value: FIXTURE_SIGNED_QUOTE.id },
    });
    await waitFor(() => {
      expect(screen.getByTestId("invoice-create-and-issue")).toBeInTheDocument();
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
