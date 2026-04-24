/**
 * Tests ThinkingBlock - carte repliable "THINKING".
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThinkingBlock } from "./ThinkingBlock.js";

describe("ThinkingBlock", () => {
  it("rend le header THINKING avec chevron ferme par defaut", () => {
    render(<ThinkingBlock thinking="reflexion" />);
    expect(screen.getByTestId("thinking-block")).toBeInTheDocument();
    const toggle = screen.getByTestId("thinking-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("reflexion")).not.toBeInTheDocument();
  });

  it("ouvre le contenu au clic", () => {
    render(<ThinkingBlock thinking="raisonnement detaille" />);
    fireEvent.click(screen.getByTestId("thinking-toggle"));
    expect(screen.getByTestId("thinking-toggle")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("raisonnement detaille")).toBeInTheDocument();
  });

  it("defaultOpen=true affiche le contenu direct", () => {
    render(<ThinkingBlock thinking="auto-open" defaultOpen />);
    expect(screen.getByText("auto-open")).toBeInTheDocument();
  });

  it("affiche un indicator ... pendant le streaming", () => {
    render(<ThinkingBlock thinking="..." streaming />);
    expect(screen.getByTestId("thinking-loading")).toBeInTheDocument();
  });
});
