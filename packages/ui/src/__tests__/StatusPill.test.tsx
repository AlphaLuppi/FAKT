import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
