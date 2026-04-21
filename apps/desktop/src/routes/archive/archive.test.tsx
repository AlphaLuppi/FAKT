import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { setQuotesApi } from "../../features/doc-editor/quotes-api.js";
import { setInvoiceApi } from "../../features/doc-editor/invoice-api.js";
import { ArchiveRoute } from "./index.js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
}));

vi.mock("../quotes/hooks.js", () => ({
  useWorkspace: () => ({
    workspace: {
      id: "ws1",
      name: "Atelier Mercier",
      siret: "12345678901234",
      legalForm: "Micro-entreprise",
      address: "Avignon",
      email: "contact@mercier.fr",
      iban: null,
      tvaMention: "TVA non applicable",
      createdAt: Date.now(),
    },
  }),
  useClientsList: () => ({ clients: [] }),
}));

beforeEach(() => {
  setQuotesApi({
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    create: vi.fn(async () => { throw new Error("not impl"); }),
    update: vi.fn(async () => { throw new Error("not impl"); }),
    updateStatus: vi.fn(async () => { throw new Error("not impl"); }),
  });
  setInvoiceApi({
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    create: vi.fn(async () => { throw new Error("not impl"); }),
    createFromQuote: vi.fn(async () => { throw new Error("not impl"); }),
    update: vi.fn(async () => { throw new Error("not impl"); }),
    updateStatus: vi.fn(async () => { throw new Error("not impl"); }),
    markPaid: vi.fn(async () => { throw new Error("not impl"); }),
    delete: vi.fn(async () => undefined),
  });
});

function renderArchive() {
  return render(
    <MemoryRouter>
      <ArchiveRoute />
    </MemoryRouter>,
  );
}

describe("ArchiveRoute", () => {
  it("affiche le titre de la route", () => {
    renderArchive();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent?.toLowerCase()).toContain("archive");
  });

  it("affiche le bouton d'export", () => {
    renderArchive();
    expect(screen.getByTestId("archive-export-btn")).toBeDefined();
  });

  it("affiche les stats vides (0 devis, 0 factures)", async () => {
    renderArchive();
    const cells = await screen.findAllByText("0");
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });
});
