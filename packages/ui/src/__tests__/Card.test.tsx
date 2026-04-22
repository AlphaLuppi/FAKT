import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../layout/Card.js";

describe("Card", () => {
  it("rend children avec title et eyebrow", () => {
    render(
      <Card eyebrow="KPI" title="CA SIGNÉ">
        <span>content</span>
      </Card>
    );
    expect(screen.getByText("KPI")).toBeInTheDocument();
    expect(screen.getByText("CA SIGNÉ")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("applique la bonne classe de shadow", () => {
    const { container } = render(<Card shadow="lg">x</Card>);
    expect(container.firstChild).toHaveClass("fakt-card", "fakt-card--raised-lg");
  });
});
