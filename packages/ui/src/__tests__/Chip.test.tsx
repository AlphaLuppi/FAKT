import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chip } from "../data-display/Chip.js";

describe("Chip", () => {
  it("rend children avec la classe fakt-chip", () => {
    render(<Chip tone="warn">À relancer</Chip>);
    const el = screen.getByText("À relancer");
    expect(el).toHaveClass("fakt-chip");
  });
});
