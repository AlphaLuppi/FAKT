import type { Quote } from "@fakt/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteDetailRoute } from "./Detail.js";
import { FIXTURE_CLIENT, FIXTURE_WORKSPACE, installMockApis } from "./__test-helpers__/mockApis.js";

const now = Date.now();

const ISSUED_QUOTE: Quote = {
  id: "q-issued",
  workspaceId: FIXTURE_WORKSPACE.id,
  clientId: FIXTURE_CLIENT.id,
  number: "D2026-001",
  year: 2026,
  sequence: 1,
  title: "Site vitrine",
  status: "sent",
  totalHtCents: 350000,
  conditions: null,
  validityDate: now + 30 * 86400000,
  notes: "Projet prioritaire",
  issuedAt: now,
  signedAt: null,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  items: [],
};

const DRAFT_QUOTE: Quote = {
  ...ISSUED_QUOTE,
  id: "q-draft",
  status: "draft",
  number: null,
  year: null,
  sequence: null,
  issuedAt: null,
};

describe("QuoteDetailRoute", () => {
  let mocks: ReturnType<typeof installMockApis>;

  beforeEach(() => {
    // Stub URL.createObjectURL for jsdom.
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(
        () => "blob:mocked"
      ) as unknown as typeof URL.createObjectURL;
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mocked");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    }
  });

  afterEach(() => {
    mocks?.reset();
    vi.restoreAllMocks();
  });

  function renderAt(path: string, quote: Quote): void {
    mocks = installMockApis({ quotes: [quote] });
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/quotes/:id" element={<QuoteDetailRoute />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("affiche le numéro, le titre et le statut d'un devis émis", async () => {
    renderAt("/quotes/q-issued", ISSUED_QUOTE);
    await waitFor(() => {
      expect(screen.getAllByText("D2026-001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Site vitrine")).toBeInTheDocument();
    });
  });

  it("rend un iframe PDF pour un devis émis", async () => {
    renderAt("/quotes/q-issued", ISSUED_QUOTE);
    await waitFor(() => {
      expect(screen.getByTestId("pdf-iframe")).toBeInTheDocument();
    });
  });

  it("affiche un placeholder quand le devis est en draft (pas de numéro)", async () => {
    renderAt("/quotes/q-draft", DRAFT_QUOTE);
    await waitFor(() => {
      expect(screen.getByTestId("pdf-placeholder")).toBeInTheDocument();
    });
  });

  it("affiche le bouton Éditer uniquement pour les drafts", async () => {
    renderAt("/quotes/q-issued", ISSUED_QUOTE);
    await waitFor(() => {
      expect(screen.getByTestId("detail-edit")).toBeDisabled();
    });
  });

  it("expose le bouton Préparer email (Track K) hors draft", async () => {
    renderAt("/quotes/q-issued", ISSUED_QUOTE);
    await waitFor(() => {
      expect(screen.getByTestId("detail-prepare-email")).toBeDefined();
      // detail-sign est actif mais désactivé tant que pdfBytes n'est pas chargé
      expect(screen.getByTestId("detail-sign")).toBeDisabled();
    });
  });

  it("affiche 'Marquer envoyé' sur un devis en draft numéroté", async () => {
    const draftNumbered: Quote = {
      ...DRAFT_QUOTE,
      id: "q-draft-numbered",
      number: "D2026-007",
      year: 2026,
      sequence: 7,
      issuedAt: now,
    };
    renderAt("/quotes/q-draft-numbered", draftNumbered);
    await waitFor(() => {
      expect(screen.getByTestId("detail-mark-sent")).toBeInTheDocument();
    });
  });

  it("affiche la mention TVA micro-entreprise et signature client", async () => {
    renderAt("/quotes/q-issued", ISSUED_QUOTE);
    await waitFor(() => {
      expect(screen.getByText(/art\. 293 B/i)).toBeInTheDocument();
      expect(screen.getByText(/bon pour accord/i)).toBeInTheDocument();
    });
  });

  it("le clic 'Marquer envoyé' ouvre une modale de confirmation", async () => {
    const draftNumbered: Quote = {
      ...DRAFT_QUOTE,
      id: "q-draft-confirm",
      number: "D2026-008",
      year: 2026,
      sequence: 8,
      issuedAt: now,
    };
    renderAt("/quotes/q-draft-confirm", draftNumbered);
    await waitFor(() => {
      expect(screen.getByTestId("detail-mark-sent")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("detail-mark-sent"));
    await waitFor(() => {
      expect(screen.getByTestId("detail-mark-sent-confirm")).toBeInTheDocument();
      expect(screen.getByTestId("detail-mark-sent-cancel")).toBeInTheDocument();
    });
  });

  it("confirmer 'Marquer envoyé' passe le devis en status=sent", async () => {
    const draftNumbered: Quote = {
      ...DRAFT_QUOTE,
      id: "q-draft-transition",
      number: "D2026-009",
      year: 2026,
      sequence: 9,
      issuedAt: now,
    };
    renderAt("/quotes/q-draft-transition", draftNumbered);
    await waitFor(() => {
      expect(screen.getByTestId("detail-mark-sent")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("detail-mark-sent"));
    await waitFor(() => {
      expect(screen.getByTestId("detail-mark-sent-confirm")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("detail-mark-sent-confirm"));
    await waitFor(() => {
      const stored = mocks.store.quotes.get("q-draft-transition");
      expect(stored?.status).toBe("sent");
    });
  });
});
