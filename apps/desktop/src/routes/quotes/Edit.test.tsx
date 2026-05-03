import type { Quote } from "@fakt/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuoteEditRoute } from "./Edit.js";
import { FIXTURE_CLIENT, FIXTURE_WORKSPACE, installMockApis } from "./__test-helpers__/mockApis.js";

const now = Date.now();

const DRAFT_QUOTE: Quote = {
  id: "q-draft",
  workspaceId: FIXTURE_WORKSPACE.id,
  clientId: FIXTURE_CLIENT.id,
  number: null,
  year: null,
  sequence: null,
  externalNumber: null,
  importedAt: null,
  title: "Titre préchargé",
  status: "draft",
  totalHtCents: 50000,
  conditions: null,
  clauses: [],
  originalTextHash: null,
  validityDate: now + 30 * 86400000,
  notes: "Note préexistante",
  issuedAt: null,
  signedAt: null,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  items: [
    {
      id: "item-1",
      position: 0,
      description: "Ligne préchargée",
      quantity: 1000,
      unitPriceCents: 50000,
      unit: "jour",
      lineTotalCents: 50000,
      serviceId: null,
    },
  ],
};

const SENT_QUOTE: Quote = {
  ...DRAFT_QUOTE,
  id: "q-sent",
  status: "sent",
  number: "D2026-007",
  year: 2026,
  sequence: 7,
  issuedAt: now,
};

describe("QuoteEditRoute", () => {
  let mocks: ReturnType<typeof installMockApis>;

  afterEach(() => {
    mocks?.reset();
  });

  function renderAt(path: string, quote: Quote): void {
    mocks = installMockApis({ quotes: [quote] });
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quotes/:id/edit" element={<QuoteEditRoute />} />
          <Route path="/quotes/:id" element={<div data-testid="detail-route">detail</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("preload les valeurs du devis (titre, notes, ligne)", async () => {
    renderAt("/quotes/q-draft/edit", DRAFT_QUOTE);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Titre préchargé")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Note préexistante")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Ligne préchargée")).toBeInTheDocument();
    });
  });

  it("redirige vers la Detail route si le devis n'est pas en draft", async () => {
    renderAt("/quotes/q-sent/edit", SENT_QUOTE);
    await waitFor(() => {
      expect(screen.getByTestId("detail-route")).toBeInTheDocument();
    });
  });
});
