import type { Client } from "@fakt/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickClientModal } from "./QuickClientModal.js";

interface CreateInput {
  id: string;
  name: string;
  email: string | null;
  siret: string | null;
}

const createMock = vi.fn<(input: CreateInput) => Promise<Client>>();

vi.mock("../../api/index.js", () => ({
  api: {
    clients: {
      create: (input: CreateInput) => createMock(input),
    },
  },
}));

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "new-client-id",
    workspaceId: "ws",
    name: "Maison Berthe",
    legalForm: null,
    siret: null,
    address: null,
    contactName: null,
    email: null,
    sector: null,
    firstCollaboration: null,
    note: null,
    archivedAt: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("QuickClientModal", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("ne rend rien quand fermé", () => {
    render(<QuickClientModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.queryByTestId("quick-client-name")).not.toBeInTheDocument();
  });

  it("valide que le nom est obligatoire", async () => {
    render(<QuickClientModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByTestId("quick-client-submit"));
    await waitFor(() => {
      expect(screen.getByText(/nom est obligatoire/i)).toBeInTheDocument();
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("crée un client avec le payload minimal et appelle onCreated", async () => {
    const created = buildClient({ name: "Mon Entreprise" });
    createMock.mockResolvedValueOnce(created);
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(<QuickClientModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByTestId("quick-client-name"), {
      target: { value: "Mon Entreprise" },
    });
    fireEvent.click(screen.getByTestId("quick-client-submit"));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1);
    });
    const firstCall = createMock.mock.calls[0];
    if (!firstCall) throw new Error("createMock was not called");
    const payload = firstCall[0];
    expect(payload.name).toBe("Mon Entreprise");
    expect(payload.email).toBeNull();
    expect(payload.siret).toBeNull();
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalled();
  });

  it("rejette un SIRET invalide avant d'appeler l'API", async () => {
    render(<QuickClientModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByTestId("quick-client-name"), {
      target: { value: "Client test" },
    });
    fireEvent.change(screen.getByTestId("quick-client-siret"), {
      target: { value: "11111111111111" },
    });
    fireEvent.click(screen.getByTestId("quick-client-submit"));
    await waitFor(() => {
      expect(screen.getByText(/SIRET/i)).toBeInTheDocument();
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("affiche l'erreur quand l'API échoue", async () => {
    createMock.mockRejectedValueOnce(new Error("email déjà utilisé"));

    render(<QuickClientModal open={true} onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByTestId("quick-client-name"), {
      target: { value: "Client test" },
    });
    fireEvent.click(screen.getByTestId("quick-client-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("quick-client-error")).toHaveTextContent(/email déjà utilisé/);
    });
  });
});
