import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "../overlays/CommandPalette.js";

const ITEMS = [
  { id: "a", label: "Nouveau devis" },
  { id: "b", label: "Nouvelle facture" },
  { id: "c", label: "Rechercher client" },
];

describe("CommandPalette", () => {
  it("rend les items filtrés", () => {
    render(
      <CommandPalette
        open
        items={ITEMS}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Nouveau devis")).toBeInTheDocument();
    expect(screen.getByText("Nouvelle facture")).toBeInTheDocument();
  });

  it("filtre selon la saisie", () => {
    render(
      <CommandPalette
        open
        items={ITEMS}
        onClose={() => {}}
        onSelect={() => {}}
      />,
    );
    const input = screen.getByRole("textbox", { name: /commande/i });
    fireEvent.change(input, { target: { value: "client" } });
    expect(screen.getByText("Rechercher client")).toBeInTheDocument();
    expect(screen.queryByText("Nouveau devis")).not.toBeInTheDocument();
  });

  it("déclenche onSelect puis onClose au clic", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        items={ITEMS}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /nouveau devis/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(onClose).toHaveBeenCalled();
  });
});
