import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "../data-display/Chip.js";

describe("Chip", () => {
  it("rend children avec la classe fakt-chip", () => {
    render(<Chip tone="warn">À relancer</Chip>);
    const el = screen.getByText("À relancer");
    expect(el).toHaveClass("fakt-chip");
  });
});
