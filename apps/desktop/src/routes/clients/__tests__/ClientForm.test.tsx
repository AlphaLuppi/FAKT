import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientForm } from "../ClientForm.js";
import type { ClientFormValues } from "../ClientForm.js";

// Stub @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

// Stub @fakt/design-tokens
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

const noop = async (): Promise<void> => undefined;

describe("ClientForm", () => {
  it("s'affiche avec les bons champs", () => {
    render(<ClientForm open={true} onClose={noop} onSubmit={noop} />);
    expect(screen.getByLabelText(/nom ou raison sociale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/siret/i)).toBeInTheDocument();
  });

  it("ferme la modal sur Annuler", async () => {
    const onClose = vi.fn();
    render(<ClientForm open={true} onClose={onClose} onSubmit={noop} />);
    await userEvent.click(screen.getByText("Annuler"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("refuse le submit si le nom est vide", async () => {
    const onSubmit = vi.fn();
    render(<ClientForm open={true} onClose={noop} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    // Pas d'appel à onSubmit car validation échoue
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepte un SIRET valide (Luhn)", async () => {
    const onSubmit = vi.fn(async (_values: ClientFormValues): Promise<void> => undefined);
    render(<ClientForm open={true} onClose={noop} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/nom ou raison sociale/i), "Acme SA");
    // SIRET valide (La Poste exception)
    await userEvent.type(screen.getByLabelText(/siret/i), "35600000000048");

    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Acme SA" }));
    });
  });

  it("affiche une erreur si le SIRET est invalide", async () => {
    const onSubmit = vi.fn();
    render(<ClientForm open={true} onClose={noop} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/nom ou raison sociale/i), "Test Corp");
    await userEvent.type(screen.getByLabelText(/siret/i), "12345678901234");

    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByText(/siret est invalide/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pré-remplit les champs en mode édition", () => {
    const initialClient = {
      id: "client-1",
      workspaceId: "ws-1",
      name: "Client Test",
      legalForm: "SASU",
      siret: null,
      address: "1 rue de la Paix, 75001 Paris",
      contactName: "Jean Dupont",
      email: "jean@test.fr",
      sector: "tech",
      firstCollaboration: null,
      note: "Note test",
      archivedAt: null,
      createdAt: Date.now(),
    };

    render(<ClientForm open={true} onClose={noop} onSubmit={noop} initial={initialClient} />);

    expect(screen.getByDisplayValue("Client Test")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jean@test.fr")).toBeInTheDocument();
  });

  it("ne s'affiche pas si open=false", () => {
    render(<ClientForm open={false} onClose={noop} onSubmit={noop} />);
    expect(screen.queryByLabelText(/nom ou raison sociale/i)).not.toBeInTheDocument();
  });
});
