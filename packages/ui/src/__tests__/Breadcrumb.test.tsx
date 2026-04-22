import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "../data-display/Breadcrumb.js";

describe("Breadcrumb", () => {
  it("affiche les items et marque le courant", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Devis", onClick: () => {} },
          { label: "D2026-001", current: true },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "Devis" })).toBeInTheDocument();
    const curr = screen.getByRole("button", { name: "D2026-001" });
    expect(curr).toHaveAttribute("data-current", "true");
    expect(curr).toBeDisabled();
  });

  it("déclenche onClick sur un item non courant", () => {
    const onClick = vi.fn();
    render(<Breadcrumb items={[{ label: "Home", onClick }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onClick).toHaveBeenCalled();
  });
});
