import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "../primitives/Select.js";

describe("Select", () => {
  it("rend les options et le placeholder", () => {
    render(
      <Select
        label="Unité"
        placeholder="Choisir…"
        options={[
          { value: "h", label: "Heure" },
          { value: "j", label: "Jour" },
        ]}
      />,
    );
    expect(screen.getByText("Heure")).toBeInTheDocument();
    expect(screen.getByText("Jour")).toBeInTheDocument();
    expect(screen.getByText("Choisir…")).toBeInTheDocument();
  });

  it("déclenche onChange", () => {
    const onChange = vi.fn();
    render(
      <Select
        label="U"
        onChange={onChange}
        options={[
          { value: "h", label: "Heure" },
          { value: "j", label: "Jour" },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("U"), { target: { value: "j" } });
    expect(onChange).toHaveBeenCalled();
  });
});
