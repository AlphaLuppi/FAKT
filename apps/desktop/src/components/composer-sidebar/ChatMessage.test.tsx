/**
 * Tests ChatMessage - orchestre le rendu d'un message avec ses blocs.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessage } from "./ChatMessage.js";
import type { ChatMessageRich } from "./useChatStream.js";

function make(msg: Partial<ChatMessageRich>): ChatMessageRich {
  return {
    id: msg.id ?? "m1",
    role: msg.role ?? "assistant",
    blocks: msg.blocks ?? [],
    streaming: msg.streaming ?? false,
    at: msg.at ?? 0,
  };
}

describe("ChatMessage", () => {
  it("rend un message user avec simple texte", () => {
    const m = make({ role: "user", blocks: [{ type: "text", text: "Salut" }] });
    render(<ChatMessage message={m} timestamp="a l'instant" />);
    expect(screen.getByTestId("composer-msg-user")).toBeInTheDocument();
    expect(screen.getByText("Salut")).toBeInTheDocument();
  });

  it("rend un message assistant avec markdown", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "text", text: "# Titre" }],
    });
    render(<ChatMessage message={m} timestamp="a l'instant" />);
    expect(screen.getByRole("heading", { level: 1, name: "Titre" })).toBeInTheDocument();
  });

  it("groupe les blocs non-text en trace accordéon (collapsed par défaut)", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "thinking", thinking: "secret" }],
    });
    render(<ChatMessage message={m} timestamp="" />);
    const toggle = screen.getByTestId("m1-trace0-trace-toggle");
    expect(toggle).toBeInTheDocument();
    // Collapsed : détails masqués.
    expect(screen.queryByTestId("m1-trace0-trace-details")).toBeNull();
    // Le contenu "secret" n'apparaît que déplié.
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("déplie la trace au clic et affiche les détails d'un tool_use", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "tool_use", id: "t1", name: "list_clients", input: { q: "abc" } }],
    });
    render(<ChatMessage message={m} timestamp="" />);
    // Résumé collapsed mentionne le tool name.
    expect(screen.getByText(/list_clients/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("m1-trace0-trace-toggle"));
    expect(screen.getByTestId("m1-trace0-trace-details")).toBeInTheDocument();
    expect(screen.getByTestId("m1-trace0-tool-0")).toBeInTheDocument();
  });

  it("déplie et affiche le badge OK d'un tool_result", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "tool_result", toolUseId: "t1", content: "ok", isError: false }],
    });
    render(<ChatMessage message={m} timestamp="" />);
    fireEvent.click(screen.getByTestId("m1-trace0-trace-toggle"));
    const result = screen.getByTestId("m1-trace0-result-0");
    expect(result).toHaveTextContent(/OK/);
  });

  it("affiche le status streaming quand streaming=true (même sans blocs)", () => {
    const m = make({ role: "assistant", blocks: [], streaming: true });
    render(<ChatMessage message={m} timestamp="" />);
    expect(screen.getByTestId("streaming-status")).toBeInTheDocument();
  });

  it("affiche un curseur clignotant quand streaming + blocs", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "text", text: "live" }],
      streaming: true,
    });
    render(<ChatMessage message={m} timestamp="" />);
    expect(screen.getByTestId("streaming-cursor")).toBeInTheDocument();
  });

  it("rend les blocs dans l'ordre (text puis trace puis text)", () => {
    const m = make({
      role: "assistant",
      blocks: [
        { type: "text", text: "avant" },
        { type: "thinking", thinking: "reflexion" },
        { type: "text", text: "apres" },
      ],
    });
    const { container } = render(<ChatMessage message={m} timestamp="" />);
    const html = container.innerHTML;
    const avantIdx = html.indexOf("avant");
    const traceIdx = html.indexOf("trace-toggle");
    const apresIdx = html.indexOf("apres");
    expect(avantIdx).toBeLessThan(traceIdx);
    expect(traceIdx).toBeLessThan(apresIdx);
  });
});
