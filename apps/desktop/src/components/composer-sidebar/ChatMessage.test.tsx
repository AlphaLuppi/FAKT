/**
 * Tests ChatMessage - orchestre le rendu d'un message avec ses blocs.
 */

import { render, screen } from "@testing-library/react";
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

  it("rend un thinking block replie", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "thinking", thinking: "secret" }],
    });
    render(<ChatMessage message={m} timestamp="" />);
    expect(screen.getByTestId("thinking-block")).toBeInTheDocument();
  });

  it("rend un tool_use block", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "tool_use", id: "t1", name: "list_clients", input: {} }],
    });
    render(<ChatMessage message={m} timestamp="" />);
    expect(screen.getByTestId("tool-use-block")).toBeInTheDocument();
    expect(screen.getByText("list_clients")).toBeInTheDocument();
  });

  it("rend un tool_result block avec badge OK", () => {
    const m = make({
      role: "assistant",
      blocks: [{ type: "tool_result", toolUseId: "t1", content: "ok", isError: false }],
    });
    render(<ChatMessage message={m} timestamp="" />);
    expect(screen.getByTestId("tool-result-badge")).toHaveTextContent("OK");
  });

  it("affiche loader ... quand blocks vide et streaming=true", () => {
    const m = make({ role: "assistant", blocks: [], streaming: true });
    render(<ChatMessage message={m} timestamp="" />);
    expect(screen.getByTestId("msg-loading")).toBeInTheDocument();
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

  it("rend les blocs dans l'ordre (text puis thinking puis text)", () => {
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
    const thinkingIdx = html.indexOf("Thinking");
    const apresIdx = html.indexOf("apres");
    expect(avantIdx).toBeLessThan(thinkingIdx);
    expect(thinkingIdx).toBeLessThan(apresIdx);
  });
});
