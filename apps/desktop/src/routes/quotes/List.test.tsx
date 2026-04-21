import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QuotesListRoute } from "./List.js";
import { installMockApis, FIXTURE_CLIENT } from "./__test-helpers__/mockApis.js";
import type { Quote } from "@fakt/shared";

const now = Date.now();

const QUOTE_FIXTURES: Quote[] = [
  {
    id: "q1",
    workspaceId: "ws-1",
    clientId: FIXTURE_CLIENT.id,
    number: "D2026-001",
    year: 2026,
    sequence: 1,
    title: "Site vitrine",
    status: "sent",
    totalHtCents: 350000,
    conditions: null,
    validityDate: null,
    notes: null,
    issuedAt: now,
    signedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
  },
  {
    id: "q2",
    workspaceId: "ws-1",
    clientId: FIXTURE_CLIENT.id,
    number: null,
    year: null,
    sequence: null,
    title: "E-shop pâtisserie",
    status: "draft",
    totalHtCents: 720000,
    conditions: null,
    validityDate: null,
    notes: null,
    issuedAt: null,
    signedAt: null,
    archivedAt: null,
    createdAt: now - 1000,
    updatedAt: now - 1000,
    items: [],
  },
];

describe("QuotesListRoute", () => {
  let mocks: ReturnType<typeof installMockApis>;

  beforeEach(() => {
    mocks = installMockApis({ quotes: QUOTE_FIXTURES });
  });

  afterEach(() => {
    mocks.reset();
  });

  function renderRoute(): void {
    render(
      <MemoryRouter>
        <QuotesListRoute />
      </MemoryRouter>,
    );
  }

  it("affiche les devis récupérés depuis l'API", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText("Site vitrine")).toBeInTheDocument();
      expect(screen.getByText("E-shop pâtisserie")).toBeInTheDocument();
    });
  });

  it("affiche le numéro pour les devis émis, — pour les drafts", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText("D2026-001")).toBeInTheDocument();
    });
  });

  it("filtre par statut via les chips", async () => {
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText("Site vitrine")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("status-filter-draft"));
    await waitFor(() => {
      expect(screen.queryByText("Site vitrine")).not.toBeInTheDocument();
      expect(screen.getByText("E-shop pâtisserie")).toBeInTheDocument();
    });
  });

  it("propose un menu [Manuel / IA]", async () => {
    renderRoute();
    fireEvent.click(screen.getByTestId("new-quote-menu"));
    expect(screen.getByTestId("new-quote-manual")).toBeInTheDocument();
    expect(screen.getByTestId("new-quote-ai")).toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun devis", async () => {
    mocks.reset();
    mocks = installMockApis({ quotes: [] });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("quotes-empty")).toBeInTheDocument();
    });
  });
});
