import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "../data-display/Sparkline.js";

describe("Sparkline", () => {
  it("rend un svg avec polyline pour des données", () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const poly = container.querySelector("polyline");
    expect(poly).not.toBeNull();
  });

  it("supporte un tableau vide", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
