import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete, type AutocompleteOption } from "../primitives/Autocomplete.js";

const OPTS: AutocompleteOption<{ price: number }>[] = [
  { value: "refonte", label: "Refonte site", data: { price: 2500 } },
  { value: "integration", label: "Intégration UI", data: { price: 1200 } },
  { value: "audit", label: "Audit tech", data: { price: 900 } },
];

describe("Autocomplete", () => {
  it("rend un combobox textarea", () => {
    render(
      <Autocomplete
        value=""
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={OPTS}
        ariaLabel="Description"
      />
    );
    const tb = screen.getByRole("combobox", { name: /description/i });
    expect(tb).toBeInTheDocument();
    expect(tb.tagName).toBe("TEXTAREA");
  });

  it("n'affiche pas le listbox tant que la value < minChars", () => {
    render(
      <Autocomplete
        value="a"
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={OPTS}
        minChars={2}
        ariaLabel="Description"
      />
    );
    // Le combobox est rendu, mais aria-expanded=false et pas de listbox
    const tb = screen.getByRole("combobox");
    expect(tb).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("affiche les suggestions quand la value ≥ minChars au focus", () => {
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={OPTS.slice(0, 2)}
        minChars={2}
        ariaLabel="Description"
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => {
      tb.focus();
    });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("sélection via Enter déclenche onSelect avec l'option highlightée", () => {
    const onSelect = vi.fn();
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={onSelect}
        suggestions={OPTS}
        minChars={2}
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => tb.focus());
    fireEvent.keyDown(tb, { key: "ArrowDown" });
    fireEvent.keyDown(tb, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0].value).toBe(OPTS[1]?.value);
  });

  it("ferme le dropdown sur Escape", () => {
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={OPTS}
        minChars={2}
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => tb.focus());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(tb, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("clic (mousedown) sur une option déclenche onSelect", () => {
    const onSelect = vi.fn();
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={onSelect}
        suggestions={OPTS}
        minChars={2}
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => tb.focus());
    const option0 = screen.getAllByRole("option")[0];
    expect(option0).toBeDefined();
    fireEvent.mouseDown(option0 as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ value: OPTS[0]?.value })
    );
  });

  it("Tab sélectionne aussi l'élément highlighté", () => {
    const onSelect = vi.fn();
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={onSelect}
        suggestions={OPTS}
        minChars={2}
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => tb.focus());
    fireEvent.keyDown(tb, { key: "Tab" });
    expect(onSelect).toHaveBeenCalled();
  });

  it("navigation ArrowDown / ArrowUp wraps autour de la liste", () => {
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={OPTS}
        minChars={2}
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => tb.focus());
    // 3 options : down wrap → idx 1, 2, 0
    fireEvent.keyDown(tb, { key: "ArrowDown" });
    fireEvent.keyDown(tb, { key: "ArrowDown" });
    fireEvent.keyDown(tb, { key: "ArrowDown" });
    const opts = screen.getAllByRole("option");
    expect(opts[0]).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowUp depuis idx=0 wrap vers la dernière option", () => {
    render(
      <Autocomplete
        value="re"
        onChange={() => {}}
        onSelect={() => {}}
        suggestions={OPTS}
        minChars={2}
      />
    );
    const tb = screen.getByRole("combobox");
    act(() => tb.focus());
    fireEvent.keyDown(tb, { key: "ArrowUp" });
    const opts = screen.getAllByRole("option");
    expect(opts[opts.length - 1]).toHaveAttribute("aria-selected", "true");
  });
});
