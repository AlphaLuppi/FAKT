import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "../data-display/Avatar.js";

describe("Avatar", () => {
  it("calcule les initiales depuis le nom", () => {
    render(<Avatar name="Tom Andrieu" />);
    expect(screen.getByText("TA")).toBeInTheDocument();
  });

  it("expose un role img et un aria-label", () => {
    render(<Avatar name="Atelier Mercier" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "Atelier Mercier");
  });
});
