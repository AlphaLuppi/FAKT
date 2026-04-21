import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "../layout/Topbar.js";

describe("Topbar", () => {
  it("rend title, subtitle et actions", () => {
    render(
      <Topbar
        title="Dashboard"
        subtitle="3 en attente"
        actions={<button type="button">Action</button>}
      />,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("3 en attente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});
