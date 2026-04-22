import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewScratch } from "./NewScratch.js";
import { installInvoiceMockApis } from "./__test-helpers__/mockInvoiceApis.js";

describe("NewScratch", () => {
  let mocks: ReturnType<typeof installInvoiceMockApis>;

  beforeEach(() => {
    mocks = installInvoiceMockApis();
  });

  afterEach(() => {
    mocks.reset();
  });

  function renderRoute(): void {
    render(
      <MemoryRouter initialEntries={["/invoices/new?from=scratch"]}>
        <NewScratch />
      </MemoryRouter>
    );
  }

  it("affiche les boutons Save draft et Créer+émettre", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("invoice-save-draft")).toBeInTheDocument();
      expect(screen.getByTestId("invoice-create-and-issue")).toBeInTheDocument();
    });
  });

  it("affiche la section mentions légales obligatoires", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("legal-mentions-section")).toBeInTheDocument();
      expect(screen.getByTestId("mention-tva")).toHaveTextContent("art. 293 B");
      expect(screen.getByTestId("mention-penalty")).toHaveTextContent("pénalité");
      expect(screen.getByTestId("mention-lumpsum")).toHaveTextContent("40 €");
    });
  });

  it("affiche des erreurs quand on tente de créer sans client ni item", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("invoice-save-draft")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("invoice-create-and-issue"));
    await waitFor(() => {
      const errors = screen.getByTestId("form-errors");
      expect(errors).toBeInTheDocument();
      expect(errors.textContent?.toLowerCase()).toContain("client");
      expect(errors.textContent?.toLowerCase()).toContain("ligne");
    });
  });

  it("ajoute des items et recalcule le total live", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("items-add")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("items-add"));
    expect(screen.getByTestId("item-row-0")).toBeInTheDocument();

    const qty = screen.getByLabelText("Quantité") as HTMLInputElement;
    const price = screen.getByLabelText("Prix unitaire HT") as HTMLInputElement;

    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.change(price, { target: { value: "1500" } });

    const total = screen.getByTestId("invoice-total");
    expect(total.textContent).toContain("3");
    expect(total.textContent).toContain("000,00");
  });

  it("affiche la date d'échéance dérivée de issuedAt + jours", async () => {
    renderRoute();
    const display = await screen.findByTestId("due-date-display");
    expect(display.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
