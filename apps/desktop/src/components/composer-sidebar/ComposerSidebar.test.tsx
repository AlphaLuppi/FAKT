import { setAi } from "@fakt/ai";
import type { AiProvider, AiStreamEvent, ChatMessage, CliInfo } from "@fakt/ai";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerSidebarProvider, useComposerSidebar } from "./ComposerContext.js";
import { ComposerSidebar } from "./ComposerSidebar.js";

function makeAiMock(reply: string): AiProvider {
  return {
    async healthCheck(): Promise<CliInfo> {
      return { installed: true, version: "0.0.0-test" };
    },
    async *extractQuoteFromBrief() {
      yield { type: "done", data: { client: { name: "" }, items: [] } } as AiStreamEvent<never>;
    },
    async *draftEmail() {
      yield { type: "done", data: reply } as AiStreamEvent<string>;
    },
    async *chat(_msgs: ChatMessage[]): AsyncIterable<AiStreamEvent<string>> {
      yield { type: "delta", data: reply.slice(0, 5) };
      yield { type: "done", data: reply };
    },
  };
}

function OpenButton(): ReactElement {
  const { open } = useComposerSidebar();
  return (
    <button onClick={open} data-testid="open-composer">
      Ouvrir
    </button>
  );
}

function renderComposer(): void {
  render(
    <MemoryRouter>
      <ComposerSidebarProvider>
        <OpenButton />
        <ComposerSidebar />
      </ComposerSidebarProvider>
    </MemoryRouter>
  );
}

describe("ComposerSidebar", () => {
  beforeEach(() => {
    setAi(makeAiMock("Bonjour, je suis l'assistant FAKT."));
  });

  it("n'est pas visible par défaut", () => {
    renderComposer();
    expect(screen.queryByTestId("composer-sidebar")).not.toBeInTheDocument();
  });

  it("s'ouvre via le bouton", async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId("open-composer"));
    await waitFor(() => {
      expect(screen.getByTestId("composer-sidebar")).toBeInTheDocument();
    });
  });

  it("ferme via le bouton close", async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId("open-composer"));
    await waitFor(() => expect(screen.getByTestId("composer-sidebar")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("composer-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("composer-sidebar")).not.toBeInTheDocument();
    });
  });

  it("envoie un message et affiche la réponse", async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId("open-composer"));
    await waitFor(() => expect(screen.getByTestId("composer-input")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("composer-input"), { target: { value: "Bonjour" } });
    fireEvent.click(screen.getByTestId("composer-send"));

    await waitFor(() => {
      expect(screen.getByText("Bonjour")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Bonjour, je suis l'assistant FAKT.")).toBeInTheDocument();
    });
  });

  it("reset efface l'historique", async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId("open-composer"));
    await waitFor(() => expect(screen.getByTestId("composer-input")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("composer-input"), { target: { value: "Test" } });
    fireEvent.click(screen.getByTestId("composer-send"));
    await waitFor(() => expect(screen.getByText("Test")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("composer-reset"));
    await waitFor(() => {
      expect(screen.queryByText("Test")).not.toBeInTheDocument();
    });
  });

  it("bouton send est désactivé si input vide", async () => {
    renderComposer();
    fireEvent.click(screen.getByTestId("open-composer"));
    await waitFor(() => expect(screen.getByTestId("composer-send")).toBeInTheDocument());
    expect(screen.getByTestId("composer-send")).toBeDisabled();
  });
});
