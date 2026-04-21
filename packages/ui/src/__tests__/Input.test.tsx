import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input, Textarea } from "../primitives/Input.js";

describe("Input", () => {
  it("affiche le label et le hint", () => {
    render(<Input label="Nom" hint="Requis" />);
    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(screen.getByText("Requis")).toBeInTheDocument();
  });

  it("transmet onChange", () => {
    const onChange = vi.fn();
    render(<Input label="Nom" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Tom" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("applique la classe invalid", () => {
    render(<Input label="Email" invalid />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveClass("fakt-input", "fakt-input--invalid");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Textarea", () => {
  it("rend avec label et rows par défaut", () => {
    render(<Textarea label="Notes" />);
    const ta = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta.rows).toBe(4);
  });
});
