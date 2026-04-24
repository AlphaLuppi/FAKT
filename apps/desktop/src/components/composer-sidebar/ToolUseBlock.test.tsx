/**
 * Tests ToolUseBlock - carte repliable "OUTIL: xxx" avec JSON input.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolUseBlock } from "./ToolUseBlock.js";

describe("ToolUseBlock", () => {
  it("rend le nom de l'outil en header", () => {
    render(<ToolUseBlock name="list_clients" input={{}} />);
    expect(screen.getByText("list_clients")).toBeInTheDocument();
  });

  it("affiche le JSON input au clic", () => {
    render(<ToolUseBlock name="get_invoice" input={{ id: "F2026-001", archived: false }} />);
    fireEvent.click(screen.getByTestId("tool-use-toggle"));
    expect(screen.getByText(/F2026-001/)).toBeInTheDocument();
    expect(screen.getByText(/archived/)).toBeInTheDocument();
  });

  it("tolere un input non-JSON sans crash", () => {
    render(<ToolUseBlock name="noop" input={null} defaultOpen />);
    expect(screen.getByText("null")).toBeInTheDocument();
  });

  it("loader ... pendant le stream", () => {
    render(<ToolUseBlock name="foo" input={{}} streaming />);
    expect(screen.getByTestId("tool-use-loading")).toBeInTheDocument();
  });
});
