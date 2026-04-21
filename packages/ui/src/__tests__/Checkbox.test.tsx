import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "../primitives/Checkbox.js";

describe("Checkbox", () => {
  it("rend avec label", () => {
    render(<Checkbox label="Accepter" />);
    expect(screen.getByText("Accepter")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("déclenche onChange au clic", () => {
    const onChange = vi.fn();
    render(<Checkbox label="OK" onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalled();
  });
});
