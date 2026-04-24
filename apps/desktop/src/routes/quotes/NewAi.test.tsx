import {
  type AiProvider,
  type AiStreamEvent,
  type ChatMessage,
  type CliInfo,
  type ExtractedQuote,
  setAi,
} from "@fakt/ai";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NewAi } from "./NewAi.js";
import { installMockApis } from "./__test-helpers__/mockApis.js";

function createProvider(opts: {
  installed: boolean;
  extractResult?: ExtractedQuote;
  throwAbort?: boolean;
  /**
   * Simule le fallback côté Rust : quand l'extracteur JSON n'a pas pu
   * parser la sortie CLI, il renvoie une string brute. L'UI doit afficher
   * un message d'erreur + le bouton "Voir la sortie brute", pas une card
   * vide à 0€.
   */
  rawStringResult?: string;
  /** Simule un done avec un ExtractedQuote sans items (items: []). */
  emptyItemsResult?: ExtractedQuote;
}): AiProvider {
  return {
    async healthCheck(): Promise<CliInfo> {
      return { installed: opts.installed };
    },
    async *extractQuoteFromBrief(_brief, options): AsyncIterable<AiStreamEvent<ExtractedQuote>> {
      if (opts.rawStringResult !== undefined) {
        // Le Rust renvoie une string brute quand son parser JSON échoue —
        // on caste via unknown pour respecter la signature générique.
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
};

describe("NewAi", () => {
  let mocks: ReturnType<typeof installMockApis>;

  beforeEach(() => {
    mocks = installMockApis();
  });

  afterEach(() => {
    mocks.reset();
    setAi(null);
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

  it("lance l'extraction et affiche les lignes extraites", async () => {
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
    expect(screen.getAllByText(/Maison Berthe/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cadrage & design/)).toBeInTheDocument();
    expect(screen.getByText(/Intégration Shopify/)).toBeInTheDocument();
  });

  it("disable le bouton Extraire quand le brief est vide", async () => {
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

    // 2500 + 3 * 1200 = 6100 €
    const total = screen.getByTestId("ai-extracted-total");
    expect(total.textContent).toMatch(/6\s*100/);
    expect(screen.getByTestId("ai-apply")).not.toBeDisabled();
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
    // Le bouton "Voir la sortie brute" doit être visible.
    expect(screen.getByTestId("ai-raw-output-toggle")).toBeInTheDocument();
    // Par défaut le contenu brut est masqué.
    expect(screen.queryByTestId("ai-raw-output-content")).toBeNull();

    // Toggle : on clique et le contenu apparaît.
    fireEvent.click(screen.getByTestId("ai-raw-output-toggle"));
    await waitFor(() => {
      expect(screen.getByTestId("ai-raw-output-content")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ai-raw-output-content").textContent).toMatch(/reformuler/);
  });
});
