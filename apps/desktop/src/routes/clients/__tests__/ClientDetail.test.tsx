/**
 * Tests du ClientDetail — vérifie la navigation vers devis/factures liés
 * et la pagination "Voir les N …" pour les clients avec > 5 documents.
 */
import type { Client, Invoice, Quote } from "@fakt/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientDetail } from "../ClientDetail.js";

const now = Date.now();

const CLIENT: Client = {
  id: "c1",
  workspaceId: "ws1",
  name: "CASA MIA",
  legalForm: "SARL",
  siret: "89513306400017",
  address: "51 rue Laurent Bertrand",
  contactName: "Marco Bianchi",
  email: "hello@casamia.fr",
  sector: null,
  firstCollaboration: null,
  note: null,
  archivedAt: null,
  createdAt: now,
};

function makeQuote(id: string, number: string | null = null): Quote {
  return {
    id,
    workspaceId: "ws1",
    clientId: "c1",
    number,
    year: null,
    sequence: null,
    externalNumber: null,
    importedAt: null,
    title: `Devis ${id}`,
    status: "draft",
    totalHtCents: 100000,
    conditions: null,
    validityDate: null,
    notes: null,
    issuedAt: null,
    signedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
  };
}

function makeInvoice(id: string, number: string | null = null): Invoice {
  return {
    id,
    workspaceId: "ws1",
    clientId: "c1",
    quoteId: null,
    number,
    year: null,
    sequence: null,
    externalNumber: null,
    importedAt: null,
    kind: "total",
    depositPercent: null,
    title: `Facture ${id}`,
    status: "draft",
    totalHtCents: 100000,
    dueDate: null,
    paidAt: null,
    paymentMethod: null,
    paymentNotes: null,
    legalMentions: "",
    issuedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
  };
}

function LocationTracker({
  onLocation,
}: {
  onLocation: (path: string) => void;
}): null {
  const loc = useLocation();
  onLocation(`${loc.pathname}${loc.search}`);
  return null;
}

function renderWithRouter(props: Parameters<typeof ClientDetail>[0]): {
  locations: string[];
} {
  const locations: string[] = [];
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/*"
          element={
            <>
              <ClientDetail {...props} />
              <LocationTracker onLocation={(p): void => void locations.push(p)} />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  return { locations };
}

describe("ClientDetail — navigation", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onEdit: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onEdit = vi.fn();
    onDelete = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rend les devis liés (≤5) avec rows clickables qui naviguent", () => {
    const quotes = [makeQuote("q1", "D2026-001"), makeQuote("q2", "D2026-002")];
    const { locations } = renderWithRouter({
      open: true,
      onClose,
      client: CLIENT,
      quotes,
      invoices: [],
      onEdit,
      onDelete,
    });

    const row = screen.getByTestId("client-detail-quote-q1");
    expect(row).toBeInTheDocument();
    expect(row.tagName).toBe("BUTTON");
    fireEvent.click(row);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(locations.at(-1)).toBe("/quotes/q1");
  });

  it("rend les factures liées avec rows clickables qui naviguent", () => {
    const invoices = [makeInvoice("i1", "F2026-001")];
    const { locations } = renderWithRouter({
      open: true,
      onClose,
      client: CLIENT,
      quotes: [],
      invoices,
      onEdit,
      onDelete,
    });

    const row = screen.getByTestId("client-detail-invoice-i1");
    fireEvent.click(row);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(locations.at(-1)).toBe("/invoices/i1");
  });

  it("tronque à 5 items + rend lien 'Voir les N devis' quand >5", () => {
    const quotes = Array.from({ length: 8 }, (_, i) => makeQuote(`q${i}`, `D2026-${i}`));
    const { locations } = renderWithRouter({
      open: true,
      onClose,
      client: CLIENT,
      quotes,
      invoices: [],
      onEdit,
      onDelete,
    });

    // Les 5 premiers sont visibles
    expect(screen.getByTestId("client-detail-quote-q0")).toBeInTheDocument();
    expect(screen.getByTestId("client-detail-quote-q4")).toBeInTheDocument();
    // Le 6e ne l'est pas
    expect(screen.queryByTestId("client-detail-quote-q5")).not.toBeInTheDocument();

    // Lien "Voir les 8 devis"
    const more = screen.getByTestId("client-detail-more-quotes");
    expect(more).toHaveTextContent(/Voir les 8 devis/);
    fireEvent.click(more);
    expect(onClose).toHaveBeenCalled();
    expect(locations.at(-1)).toBe("/quotes?client=c1");
  });

  it("pas de lien 'Voir les N' si ≤ 5 devis", () => {
    const quotes = [makeQuote("q1")];
    renderWithRouter({
      open: true,
      onClose,
      client: CLIENT,
      quotes,
      invoices: [],
      onEdit,
      onDelete,
    });
    expect(screen.queryByTestId("client-detail-more-quotes")).not.toBeInTheDocument();
  });

  it("tronque aussi les factures à 5 avec lien 'Voir les N'", () => {
    const invoices = Array.from({ length: 7 }, (_, i) => makeInvoice(`i${i}`));
    const { locations } = renderWithRouter({
      open: true,
      onClose,
      client: CLIENT,
      quotes: [],
      invoices,
      onEdit,
      onDelete,
    });
    const more = screen.getByTestId("client-detail-more-invoices");
    expect(more).toHaveTextContent(/Voir les 7 factures/);
    fireEvent.click(more);
    expect(locations.at(-1)).toBe("/invoices?client=c1");
  });
});
