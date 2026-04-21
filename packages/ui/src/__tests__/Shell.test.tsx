import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shell } from "../layout/Shell.js";

describe("Shell", () => {
  it("rend sidebar, topbar et children", () => {
    render(
      <Shell sidebar={<aside>S</aside>} topbar={<div>T</div>}>
        <div>Main</div>
      </Shell>,
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
  });
});
