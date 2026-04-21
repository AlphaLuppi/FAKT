import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientPicker } from "./ClientPicker.js";
import type { Client } from "@fakt/shared";

const CLIENTS: Client[] = [
  {
    id: "c1",
    workspaceId: "ws",
    name: "Maison Berthe",
    legalForm: null,
    siret: null,
    address: null,
    contactName: null,
    email: "hello@berthe.fr",
    sector: null,
    firstCollaboration: null,
    note: null,
    archivedAt: null,
    createdAt: 0,
  },
  {
    id: "c2",
    workspaceId: "ws",
    name: "Atelier Mercier",
    legalForm: null,
    siret: null,
    address: null,
    contactName: null,
    email: null,
    sector: null,
    firstCollaboration: null,
    note: null,
    archivedAt: null,
    createdAt: 0,
  },
];

describe("ClientPicker", () => {
  it("affiche un placeholder quand aucun client n'est sélectionné", () => {
    render(<ClientPicker value={null} onChange={vi.fn()} clients={CLIENTS} />);
    expect(
      screen.getAllByText(/choisir un client/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("affiche le client sélectionné", () => {
    render(<ClientPicker value="c1" onChange={vi.fn()} clients={CLIENTS} />);
    expect(screen.getByText("Maison Berthe")).toBeInTheDocument();
  });

  it("ouvre le listbox et sélectionne un client", () => {
    const onChange = vi.fn();
    render(<ClientPicker value={null} onChange={onChange} clients={CLIENTS} />);
    fireEvent.click(screen.getByTestId("client-picker-toggle"));
    fireEvent.click(screen.getByTestId("client-option-c1"));
    expect(onChange).toHaveBeenCalledWith("c1", expect.objectContaining({ id: "c1" }));
  });

  it("filtre les clients via le champ search", () => {
    render(<ClientPicker value={null} onChange={vi.fn()} clients={CLIENTS} />);
    fireEvent.click(screen.getByTestId("client-picker-toggle"));
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "berthe" } });
    expect(screen.getByTestId("client-option-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("client-option-c2")).not.toBeInTheDocument();
  });

  it("invoque onQuickCreate quand le bouton est cliqué", () => {
    const onQuick = vi.fn();
    render(
      <ClientPicker
        value={null}
        onChange={vi.fn()}
        clients={CLIENTS}
        onQuickCreate={onQuick}
      />,
    );
    fireEvent.click(screen.getByText(/nouveau client rapide/i));
    expect(onQuick).toHaveBeenCalledTimes(1);
  });
});
