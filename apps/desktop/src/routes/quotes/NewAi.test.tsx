import {
  type AiProvider,
  type AiStreamEvent,
  type ChatMessage,
  type CliInfo,
  type ExtractedQuote,
  setAi,
} from "@fakt/ai";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewAi } from "./NewAi.js";
import { installMockApis } from "./__test-helpers__/mockApis.js";

function createProvider(opts: {
  installed: boolean;
  extractResult?: ExtractedQuote;
  throwAbort?: boolean;
  rawStringResult?: string;
  emptyItemsResult?: ExtractedQuote;
}): AiProvider {
  return {
    async healthCheck(): Promise<CliInfo> {
      return { installed: opts.installed };
    },
    async *extractQuoteFromBrief(_brief, options): AsyncIterable<AiStreamEvent<ExtractedQuote>> {
      if (opts.rawStringResult !== undefined) {
        yield {
          type: "done",
          data: opts.rawStringResult as unknown as ExtractedQuote,
        };
        return;
      }
      if (opts.emptyItemsResult) {
        yield { type: "done", data: opts.emptyItemsResult };
        return;
      }
      if (!opts.extractResult) {
        yield { type: "error", message: "no fixture" };
        return;
      }
      yield { type: "delta", data: { client: opts.extractResult.client } };
      if (options?.signal?.aborted) {
        return;
      }
      yield { type: "done", data: opts.extractResult };
    },
    async *draftEmail(): AsyncIterable<AiStreamEvent<string>> {
      yield { type: "done", data: "" };
    },
    async *chat(_msgs: ChatMessage[]): AsyncIterable<AiStreamEvent<string>> {
      yield { type: "done", data: "" };
    },
  };
}

const FIXTURE_EXTRACTED: ExtractedQuote = {
  client: { name: "Maison Berthe", email: "hello@berthe.fr" },
  items: [
    {
      description: "Cadrage & design",
      quantity: 1,
      unitPrice: 2500,
      unit: "forfait",
    },
    {
      description: "Intégration Shopify",
      quantity: 3,
      unitPrice: 1200,
      unit: "day",
    },
  ],
  validUntil: "2026-12-31",
  notes: "Livraison avant la fête des mères.",
};

describe("NewAi route", () => {
  let mocks: ReturnType<typeof installMockApis> | null = null;

  beforeEach(() => {
    mocks = installMockApis();
  });

  afterEach(() => {
    mocks?.reset();
    mocks = null;
  });

  function renderRoute(): void {
    render(
      <MemoryRouter>
        <NewAi />
      </MemoryRouter>
    );
  }

  it("affiche un blocage CLI absent quand healthCheck retourne installed=false", async () => {
    setAi(createProvider({ installed: false }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-cli-missing")).toBeInTheDocument();
    });
  });

  it("affiche par défaut l'onglet texte avec le textarea brief", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-tab-text")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ai-brief")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-dropzone")).toBeNull();
  });

  it("bascule sur l'onglet fichier et affiche la dropzone", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-tab-file")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("ai-tab-file"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-dropzone")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("ai-brief")).toBeNull();
    expect(screen.getByTestId("ai-dropzone-hint")).toBeInTheDocument();
  });

  it("lance l'extraction et affiche les lignes extraites éditables", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-brief")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("ai-brief"), {
      target: { value: "Brief complet Maison Berthe" },
    });

    fireEvent.click(screen.getByTestId("ai-extract"));

    await waitFor(() => {
      expect(screen.getByTestId("ai-extracted")).toBeInTheDocument();
    });
    const nameInput = screen.getByTestId("ai-edit-client-name") as HTMLInputElement;
    expect(nameInput.value).toBe("Maison Berthe");
    const desc0 = screen.getByTestId("ai-edit-item-0-desc") as HTMLInputElement;
    expect(desc0.value).toBe("Cadrage & design");
    const desc1 = screen.getByTestId("ai-edit-item-1-desc") as HTMLInputElement;
    expect(desc1.value).toBe("Intégration Shopify");
  });

  it("désactive le bouton Extraire quand aucun contenu n'est saisi", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-extract")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ai-extract")).toBeDisabled();
  });

  it("affiche un total non-nul et active UTILISER quand items présents", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-brief")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("ai-brief"), {
      target: { value: "Brief pour Maison Berthe" },
    });
    fireEvent.click(screen.getByTestId("ai-extract"));

    await waitFor(() => {
      expect(screen.getByTestId("ai-extracted")).toBeInTheDocument();
    });

    const total = screen.getByTestId("ai-extracted-total");
    expect(total.textContent).toMatch(/6\s*100/);
    expect(screen.getByTestId("ai-apply")).not.toBeDisabled();
  });

  it("permet d'éditer le nom client extrait avant d'appliquer", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId("ai-brief")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("ai-brief"), { target: { value: "brief" } });
    fireEvent.click(screen.getByTestId("ai-extract"));
    await waitFor(() => expect(screen.getByTestId("ai-extracted")).toBeInTheDocument());

    const nameInput = screen.getByTestId("ai-edit-client-name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Maison Berthe SARL" } });
    expect((screen.getByTestId("ai-edit-client-name") as HTMLInputElement).value).toBe(
      "Maison Berthe SARL"
    );
  });

  it("permet d'ajouter et supprimer une ligne dans la preview", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId("ai-brief")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("ai-brief"), { target: { value: "brief" } });
    fireEvent.click(screen.getByTestId("ai-extract"));
    await waitFor(() => expect(screen.getByTestId("ai-extracted")).toBeInTheDocument());

    const list = screen.getByTestId("ai-edit-items");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(screen.getByTestId("ai-edit-item-add"));
    expect(within(screen.getByTestId("ai-edit-items")).getAllByRole("listitem")).toHaveLength(3);

    fireEvent.click(screen.getByTestId("ai-edit-item-2-remove"));
    expect(within(screen.getByTestId("ai-edit-items")).getAllByRole("listitem")).toHaveLength(2);
  });

  it("recalcule le total quand on édite la quantité d'une ligne", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId("ai-brief")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("ai-brief"), { target: { value: "brief" } });
    fireEvent.click(screen.getByTestId("ai-extract"));
    await waitFor(() => expect(screen.getByTestId("ai-extracted")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("ai-edit-item-1-qty"), { target: { value: "5" } });
    const total = screen.getByTestId("ai-extracted-total");
    // 2500 + 5 * 1200 = 8500
    expect(total.textContent).toMatch(/8\s*500/);
  });

  it("affiche un message d'aide quand aucune ligne n'est extraite", async () => {
    const emptyResult: ExtractedQuote = {
      client: { name: "Client inconnu" },
      items: [],
    };
    setAi(createProvider({ installed: true, emptyItemsResult: emptyResult }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-brief")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("ai-brief"), {
      target: { value: "Brief très vague" },
    });
    fireEvent.click(screen.getByTestId("ai-extract"));

    await waitFor(() => {
      expect(screen.getByTestId("ai-no-items-hint")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ai-apply")).toBeDisabled();
  });

  it("affiche erreur + bouton sortie brute quand le CLI retourne une string non-JSON", async () => {
    setAi(
      createProvider({
        installed: true,
        rawStringResult: "Je n'ai pas compris ton brief, peux-tu reformuler ?",
      })
    );
    renderRoute();
    await waitFor(() => {
      expect(screen.getByTestId("ai-brief")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("ai-brief"), {
      target: { value: "brief random" },
    });
    fireEvent.click(screen.getByTestId("ai-extract"));

    await waitFor(() => {
      expect(screen.getByTestId("ai-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ai-raw-output-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-raw-output-content")).toBeNull();

    fireEvent.click(screen.getByTestId("ai-raw-output-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-raw-output-content")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ai-raw-output-content").textContent).toMatch(/reformuler/);
  });

  it("drag-drop d'un .txt dans l'onglet fichier crée une carte status=ready", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    await waitFor(() => expect(screen.getByTestId("ai-tab-file")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("ai-tab-file"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-dropzone")).toBeInTheDocument();
    });

    const zone = screen.getByTestId("ai-dropzone");
    const file = new File(["Mission refonte site Maison Berthe — budget 8k€"], "brief.txt", {
      type: "text/plain",
    });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("ai-file-list")).toBeInTheDocument();
    });
    expect(screen.getByText(/brief\.txt/)).toBeInTheDocument();

    await waitFor(() => {
      const ready = document.querySelectorAll('[data-status="ready"]');
      if (ready.length === 0) throw new Error("file not ready yet");
    });
    expect(screen.getByTestId("ai-extract")).not.toBeDisabled();
  });

  it("drag-drop d'un format non supporté crée une carte avec status=error", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    fireEvent.click(screen.getByTestId("ai-tab-file"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-dropzone")).toBeInTheDocument();
    });

    const zone = screen.getByTestId("ai-dropzone");
    const file = new File(["content"], "bad.png", { type: "image/png" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      const errors = document.querySelectorAll('[data-status="error"]');
      if (errors.length === 0) throw new Error("error not yet");
    });
    expect(screen.getAllByText(/bad\.png/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("ai-extract")).toBeDisabled();
  });

  it("affiche un hint formats sous la dropzone dans l'onglet fichier", async () => {
    setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
    renderRoute();
    fireEvent.click(screen.getByTestId("ai-tab-file"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-dropzone-hint")).toBeInTheDocument();
    });
    const hint = screen.getByTestId("ai-dropzone-hint").textContent ?? "";
    expect(hint.toUpperCase()).toContain("PDF");
  });

  it(
    "le bouton Retirer enlève une carte fichier en cours de parsing",
    { timeout: 20000 },
    async () => {
      setAi(createProvider({ installed: true, extractResult: FIXTURE_EXTRACTED }));
      renderRoute();
      fireEvent.click(screen.getByTestId("ai-tab-file"));
      await waitFor(() => {
        expect(screen.getByTestId("ai-dropzone")).toBeInTheDocument();
      });

      const zone = screen.getByTestId("ai-dropzone");
      const hangingFile = new File(["fake pdf"], "stuck.pdf", { type: "application/pdf" });
      Object.defineProperty(hangingFile, "arrayBuffer", {
        value: () => new Promise<ArrayBuffer>(() => {}),
      });
      fireEvent.drop(zone, { dataTransfer: { files: [hangingFile] } });

      await waitFor(() => {
        const parsing = document.querySelectorAll('[data-status="parsing"]');
        if (parsing.length === 0) throw new Error("parsing not yet");
      });

      const removeButtons = screen.getAllByText(/Retirer/i);
      expect(removeButtons.length).toBeGreaterThan(0);
      const firstRemove = removeButtons[0];
      if (!firstRemove) throw new Error("no remove button");
      fireEvent.click(firstRemove);

      await waitFor(() => {
        const parsing = document.querySelectorAll('[data-status="parsing"]');
        expect(parsing.length).toBe(0);
      });
    }
  );
});
