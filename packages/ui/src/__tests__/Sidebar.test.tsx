import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../layout/Sidebar.js";

describe("Sidebar", () => {
  it("affiche les items et le badge", () => {
    render(
      <Sidebar
        brand="FAKT"
        items={[
          { id: "a", label: "Devis", badge: 7 },
          { id: "b", label: "Factures" },
        ]}
      />,
    );
    expect(screen.getByText("FAKT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /devis/i })).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("déclenche onSelect au clic", () => {
    const onSelect = vi.fn();
    render(
      <Sidebar
        items={[{ id: "a", label: "Devis" }]}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /devis/i }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("marque l'item courant comme actif", () => {
    render(
      <Sidebar
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        currentId="b"
      />,
    );
    const btnB = screen.getByRole("button", { name: /^B$/ });
    expect(btnB).toHaveAttribute("data-active", "true");
  });
});
