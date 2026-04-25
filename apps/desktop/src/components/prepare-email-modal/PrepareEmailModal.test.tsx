import type { Quote } from "@fakt/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setPdfApi } from "../../features/doc-editor/pdf-api.js";
import { PrepareEmailModal } from "./index.js";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "plugin:path|temp_dir") return "/tmp";
    if (cmd === "plugin:fs|create_dir") return undefined;
    if (cmd === "plugin:fs|write_text_file") return undefined;
    if (cmd === "open_email_draft") return undefined;
    if (cmd === "open_mailto_fallback") return undefined;
    return undefined;
  }),
}));

vi.mock("@fakt/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fakt/email")>();
  return {
    ...actual,
    buildEml: vi.fn(() => "From: a@b.com\r\n"),
  };
});

const MOCK_QUOTE: Quote = {
  id: "q1",
  workspaceId: "ws1",
  clientId: "c1",
  number: "D2026-001",
  year: 2026,
  sequence: 1,
  title: "Mission dev",
  status: "sent",
  totalHtCents: 300000,
  conditions: null,
  validityDate: null,
  notes: null,
  issuedAt: Date.now(),
  signedAt: null,
  archivedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  items: [],
};

const MOCK_RENDER_ARGS = {
  quote: MOCK_QUOTE as Parameters<
    typeof import("../../features/doc-editor/pdf-api.js").pdfApi.renderQuote
  >[0]["quote"],
  client: {
    id: "c1",
    name: "Maison Berthe",
    legalForm: null,
    siret: null,
    address: null,
    email: "contact@berthe.fr",
    sector: null,
    note: null,
    contactName: null,
    firstCollaboration: null,
    archivedAt: null,
    createdAt: Date.now(),
    workspaceId: "ws1",
  },
  workspace: {
    id: "ws1",
    name: "Mon Entreprise",
    legalForm: "Micro-entreprise" as const,
    siret: "12345678901234",
    address: "1 rue des Arts, Avignon",
    email: "contact@mercier.fr",
    iban: null,
    tvaMention: "TVA non applicable",
    createdAt: Date.now(),
  },
};

beforeEach(() => {
  setPdfApi({
    renderQuote: vi.fn(async () => new Uint8Array([80, 68, 70])),
    renderInvoice: vi.fn(async () => new Uint8Array([80, 68, 70])),
    saveDialog: vi.fn(async () => null),
    writeFile: vi.fn(async () => undefined),
  });
});

function renderModal(open = true) {
  return render(
    <MemoryRouter>
      <PrepareEmailModal
        open={open}
        onClose={vi.fn()}
        docType="quote"
        doc={MOCK_QUOTE}
        clientName="Maison Berthe"
        clientEmail="contact@berthe.fr"
        workspaceName="Mon Entreprise"
        workspaceEmail="contact@mercier.fr"
        renderArgs={MOCK_RENDER_ARGS}
      />
    </MemoryRouter>
  );
}

describe("PrepareEmailModal", () => {
  it("ne rend rien quand open=false", () => {
    renderModal(false);
    expect(screen.queryByTestId("prepare-email-modal-submit")).toBeNull();
  });

  it("affiche les champs quand open=true", () => {
    renderModal(true);
    expect(screen.getByTestId("prepare-email-modal-to")).toBeDefined();
    expect(screen.getByTestId("prepare-email-modal-subject")).toBeDefined();
    expect(screen.getByTestId("prepare-email-modal-body")).toBeDefined();
    expect(screen.getByTestId("prepare-email-modal-template")).toBeDefined();
  });

  it("pré-remplit l'email du client", () => {
    renderModal(true);
    const input = screen.getByTestId("prepare-email-modal-to") as HTMLInputElement;
    expect(input.value).toBe("contact@berthe.fr");
  });

  it("change de template au dropdown", () => {
    renderModal(true);
    const select = screen.getByTestId("prepare-email-modal-template") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "reminder" } });
    expect(select.value).toBe("reminder");
  });

  it("affiche le bouton annuler", () => {
    renderModal(true);
    expect(screen.getByTestId("prepare-email-modal-cancel")).toBeDefined();
  });

  it("affiche le toggle mailto", () => {
    renderModal(true);
    expect(screen.getByTestId("prepare-email-modal-mailto-toggle")).toBeDefined();
  });

  it("affiche alerte si email client absent", () => {
    render(
      <MemoryRouter>
        <PrepareEmailModal
          open={true}
          onClose={vi.fn()}
          docType="quote"
          doc={MOCK_QUOTE}
          clientName="Maison Berthe"
          clientEmail={null}
          workspaceName="Mon Entreprise"
          workspaceEmail="contact@mercier.fr"
          renderArgs={MOCK_RENDER_ARGS}
        />
      </MemoryRouter>
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
  });
});
