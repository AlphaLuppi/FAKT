import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "../data-display/StatusPill.js";

describe("StatusPill", () => {
  it("affiche le label par défaut selon le statut", () => {
    render(<StatusPill status="signed" />);
    expect(screen.getByText("Signé")).toBeInTheDocument();
  });

  it("permet un label custom", () => {
    render(<StatusPill status="paid" label="Réglée" />);
    expect(screen.getByText("Réglée")).toBeInTheDocument();
  });

  it("supporte la variante invoiced avec label 'Facturé'", () => {
    render(<StatusPill status="invoiced" />);
    expect(screen.getByText("Facturé")).toBeInTheDocument();
  });

  it("supporte la variante paid (vert)", () => {
    render(<StatusPill status="paid" />);
    expect(screen.getByText("Payée")).toBeInTheDocument();
  });

  it("supporte la variante overdue (rouge)", () => {
    render(<StatusPill status="overdue" />);
    expect(screen.getByText("En retard")).toBeInTheDocument();
  });

  it("signed utilise fond noir + texte jaune", () => {
    const { container } = render(<StatusPill status="signed" />);
    const pill = container.querySelector<HTMLElement>("[data-status='signed']");
    expect(pill).not.toBeNull();
    expect(pill?.style.background).toContain("rgb(0, 0, 0)");
    expect(pill?.style.color).toContain("rgb(255, 255, 0)");
  });

  it("invoiced utilise borderStyle dashed (semi-terminal)", () => {
    const { container } = render(<StatusPill status="invoiced" />);
    const pill = container.querySelector<HTMLElement>("[data-status='invoiced']");
    expect(pill).not.toBeNull();
    expect(pill?.style.borderStyle).toBe("dashed");
  });
});
