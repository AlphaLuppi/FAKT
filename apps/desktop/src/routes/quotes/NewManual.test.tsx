import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewManual } from "./NewManual.js";
import { installMockApis } from "./__test-helpers__/mockApis.js";

describe("NewManual", () => {
  let mocks: ReturnType<typeof installMockApis>;

  beforeEach(() => {
    mocks = installMockApis();
  });

  afterEach(() => {
    mocks.reset();
  });

  function renderRoute(): void {
    render(
      <MemoryRouter initialEntries={["/quotes/new?mode=manual"]}>
        <NewManual />
      </MemoryRouter>
    );
  }

  it("affiche les boutons Save draft et Créer+numéro", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("save-draft")).toBeInTheDocument();
      expect(screen.getByTestId("create-and-issue")).toBeInTheDocument();
    });
  });

  it("affiche des erreurs quand on tente de créer sans client ni item", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("save-draft")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("create-and-issue"));
    await waitFor(() => {
      const errors = screen.getByTestId("form-errors");
      expect(errors).toBeInTheDocument();
      expect(errors.textContent?.toLowerCase()).toContain("client");
      expect(errors.textContent?.toLowerCase()).toContain("ligne");
    });
  });

  it("ajoute des items via ItemsEditor", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("items-add")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("items-add"));
    expect(screen.getByTestId("item-row-0")).toBeInTheDocument();
  });

  it("recalcule le total global quand on saisit quantité×prix", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("items-add")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("items-add"));

    const qty = screen.getByLabelText("Quantité") as HTMLInputElement;
    const price = screen.getByLabelText("Prix unitaire HT") as HTMLInputElement;

    fireEvent.change(qty, { target: { value: "2" } });
    fireEvent.change(price, { target: { value: "1500" } });

    const total = screen.getByTestId("quote-total");
    expect(total.textContent).toContain("3");
    expect(total.textContent).toContain("000,00");
  });

  it("affiche la date de validité dérivée de issuedAt + jours", async () => {
    renderRoute();
    const display = await screen.findByTestId("validity-date-display");
    expect(display.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
