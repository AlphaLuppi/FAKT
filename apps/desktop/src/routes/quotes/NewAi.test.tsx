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
}): AiProvider {
  return {
    async healthCheck(): Promise<CliInfo> {
      return { installed: opts.installed };
    },
    async *extractQuoteFromBrief(_brief, options): AsyncIterable<AiStreamEvent<ExtractedQuote>> {
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
});
