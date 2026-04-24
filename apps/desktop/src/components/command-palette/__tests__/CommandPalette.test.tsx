import type { Client, Service } from "@fakt/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteProvider, useCommandPalette } from "../CommandPaletteProvider.js";
import { invalidateSearchIndex } from "../useCommandPaletteIndex.js";

const mockClients: Client[] = [
  {
    id: "c1",
    workspaceId: "ws-1",
    name: "Atelier Mercier",
    legalForm: "Micro-entreprise",
    siret: null,
    address: null,
    contactName: "Tom",
    email: "tom@mercier.fr",
    sector: "design",
    firstCollaboration: null,
    note: null,
    archivedAt: null,
    createdAt: 1700000000000,
  },
];

const mockServices: Service[] = [
  {
    id: "s1",
    workspaceId: "ws-1",
    name: "Développement React",
    description: null,
    unit: "jour",
    unitPriceCents: 80000,
    tags: ["dev"],
    archivedAt: null,
    createdAt: 1700000000000,
  },
];

// Depuis 2026-04-24 : useCommandPaletteIndex utilise le sidecar HTTP (api.*)
// et non plus `invoke(list_clients)` (commande Tauri inexistante -> rien
// ne remontait dans la palette). On mocke donc l'objet `api` exporte depuis
// ../../../api/index.js.
vi.mock("../../../api/index.js", () => ({
  api: {
    clients: { list: vi.fn(async () => mockClients) },
    services: { list: vi.fn(async () => mockServices) },
    quotes: { list: vi.fn(async () => [] as never[]) },
    invoices: { list: vi.fn(async () => [] as never[]) },
  },
}));

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

function OpenButton(): ReactElement {
  const { open } = useCommandPalette();
  return <button onClick={open}>Ouvrir</button>;
}

const renderProvider = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <CommandPaletteProvider>
        <OpenButton />
      </CommandPaletteProvider>
    </MemoryRouter>
  );

describe("CommandPaletteProvider", () => {
  beforeEach(() => {
    // Reset l'index shared entre chaque test pour forcer le reload.
    invalidateSearchIndex();
  });

  it("s'ouvre via le bouton", async () => {
    renderProvider();
    await userEvent.click(screen.getByText("Ouvrir"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("s'ouvre via le raccourci Ctrl+K", () => {
    renderProvider();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("se ferme avec Escape", async () => {
    renderProvider();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("affiche les clients dans les résultats", async () => {
    renderProvider();
    await userEvent.click(screen.getByText("Ouvrir"));

    await waitFor(() => {
      expect(screen.getByText("Atelier Mercier")).toBeInTheDocument();
    });
  });

  it("affiche les prestations dans les résultats", async () => {
    renderProvider();
    await userEvent.click(screen.getByText("Ouvrir"));

    await waitFor(() => {
      expect(screen.getByText("Développement React")).toBeInTheDocument();
    });
  });
});

describe("⌘K performance", () => {
  it("s'ouvre en < 100ms (synchrone)", () => {
    renderProvider();
    const start = performance.now();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const elapsed = performance.now() - start;
    // L'ouverture de la palette (setState + rendu) doit être < 100ms
    expect(elapsed).toBeLessThan(100);
  });
});
