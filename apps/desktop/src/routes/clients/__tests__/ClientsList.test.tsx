import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ClientsRoute } from "../index.js";
import type { Client } from "@fakt/shared";

// Stub Tauri
vi.mock("@tauri-apps/api/core", () => {
  const mockClients: Client[] = [
    {
      id: "c1",
      workspaceId: "ws-1",
      name: "Atelier Mercier",
      legalForm: "Micro-entreprise",
      siret: null,
      address: "12 rue Pasteur, 84000 Avignon",
      contactName: "Tom",
      email: "tom@mercier.fr",
      sector: "design",
      firstCollaboration: null,
      note: null,
      archivedAt: null,
      createdAt: 1700000000000,
    },
    {
      id: "c2",
      workspaceId: "ws-1",
      name: "StartupTech",
      legalForm: "SAS",
      siret: null,
      address: null,
      contactName: "Alice",
      email: "alice@startuptech.io",
      sector: "tech",
      firstCollaboration: null,
      note: null,
      archivedAt: null,
      createdAt: 1700100000000,
    },
  ];

  return {
    invoke: vi.fn().mockImplementation((command: string) => {
      if (command === "list_clients") return Promise.resolve(mockClients);
      if (command === "list_quotes") return Promise.resolve([]);
      if (command === "list_invoices") return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
});

vi.mock("@fakt/design-tokens", () => ({
  tokens: {
    color: {
      ink: "#000",
      surface: "#fff",
      paper2: "#f5f5f0",
      muted: "#999",
      infoBg: "#e0f0ff",
      warnBg: "#fff3cd",
      successBg: "#d4edda",
      dangerBg: "#f8d7da",
      accentSoft: "#ffff00",
    },
    font: { ui: "Space Grotesk, sans-serif", mono: "JetBrains Mono, monospace" },
    fontSize: { xs: "11px", sm: "12px", base: "14px", lg: "16px", xl: "20px" },
    fontWeight: { bold: "700", black: "800" },
    spacing: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px" },
    stroke: { base: "2px" },
  },
}));

const renderWithRouter = (ui: ReactElement): ReturnType<typeof render> =>
  render(<MemoryRouter initialEntries={["/clients"]}>{ui}</MemoryRouter>);

describe("ClientsRoute", () => {
  it("affiche la liste des clients", async () => {
    renderWithRouter(<ClientsRoute />);
    await waitFor(() => {
      expect(screen.getByText("Atelier Mercier")).toBeInTheDocument();
      expect(screen.getByText("StartupTech")).toBeInTheDocument();
    });
  });

  it("affiche le titre CLIENTS", () => {
    renderWithRouter(<ClientsRoute />);
    expect(screen.getByText("Clients")).toBeInTheDocument();
  });

  it("affiche le bouton Nouveau client", () => {
    renderWithRouter(<ClientsRoute />);
    expect(screen.getByRole("button", { name: /nouveau client/i })).toBeInTheDocument();
  });

  it("ouvre la modale ClientForm sur clic Nouveau client", async () => {
    renderWithRouter(<ClientsRoute />);
    await userEvent.click(screen.getByRole("button", { name: /nouveau client/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("a une barre de recherche accessible", () => {
    renderWithRouter(<ClientsRoute />);
    expect(screen.getByRole("textbox", { name: /recherche client/i })).toBeInTheDocument();
  });

  it("a un toggle corbeille", () => {
    renderWithRouter(<ClientsRoute />);
    expect(screen.getByText(/afficher la corbeille/i)).toBeInTheDocument();
  });
});
