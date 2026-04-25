import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setInvoiceApi } from "../../features/doc-editor/invoice-api.js";
import { setQuotesApi } from "../../features/doc-editor/quotes-api.js";
import { ArchiveRoute } from "./index.js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => null),
}));

vi.mock("../../api/index.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../api/index.js");
  return {
    ...actual,
    api: {
      clients: { list: vi.fn(async () => []) },
      services: { list: vi.fn(async () => []) },
    },
  };
});

vi.mock("../quotes/hooks.js", () => ({
  useWorkspace: () => ({
    workspace: {
      id: "ws1",
      name: "Mon Entreprise",
      siret: "12345678901234",
      legalForm: "Micro-entreprise",
      address: "Avignon",
      email: "contact@mercier.fr",
      iban: null,
      tvaMention: "TVA non applicable",
      createdAt: Date.now(),
    },
  }),
}));

beforeEach(() => {
  setQuotesApi({
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    create: vi.fn(async () => {
      throw new Error("not impl");
    }),
    update: vi.fn(async () => {
      throw new Error("not impl");
    }),
    updateStatus: vi.fn(async () => {
      throw new Error("not impl");
    }),
  });
  setInvoiceApi({
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    create: vi.fn(async () => {
      throw new Error("not impl");
    }),
    createFromQuote: vi.fn(async () => {
      throw new Error("not impl");
    }),
    update: vi.fn(async () => {
      throw new Error("not impl");
    }),
    updateStatus: vi.fn(async () => {
      throw new Error("not impl");
    }),
    markPaid: vi.fn(async () => {
      throw new Error("not impl");
    }),
    delete: vi.fn(async () => undefined),
  });
});

function renderArchive() {
  return render(
    <MemoryRouter>
      <ArchiveRoute />
    </MemoryRouter>
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
