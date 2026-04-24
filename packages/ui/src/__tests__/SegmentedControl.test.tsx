import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "../primitives/SegmentedControl.js";

describe("SegmentedControl", () => {
  const OPTIONS = [
    { value: "draw" as const, label: "Trackpad" },
    { value: "type" as const, label: "Clavier" },
  ];

  it("rend un tablist avec N tabs", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="draw"
        onChange={() => {}}
        ariaLabel="mode"
      />
    );
    const tablist = screen.getByRole("tablist", { name: /mode/i });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("marque le segment actif avec aria-selected", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="type"
        onChange={() => {}}
      />
    );
    const active = screen.getByRole("tab", { name: /clavier/i });
    expect(active).toHaveAttribute("aria-selected", "true");
    const inactive = screen.getByRole("tab", { name: /trackpad/i });
    expect(inactive).toHaveAttribute("aria-selected", "false");
  });

  it("appelle onChange quand on clique un segment inactif", () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="draw" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /clavier/i }));
    expect(onChange).toHaveBeenCalledWith("type");
  });

  it("n'appelle pas onChange pour un segment disabled", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B", disabled: true },
        ]}
        value="a"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: /^B$/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("pleine largeur par défaut (grid 100%)", () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="draw" onChange={() => {}} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.display).toBe("grid");
    expect(root.style.width).toBe("100%");
  });

  it("respecte fullWidth=false → inline-grid, width auto", () => {
    const { container } = render(
      <SegmentedControl
        options={OPTIONS}
        value="draw"
        onChange={() => {}}
        fullWidth={false}
      />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.display).toBe("inline-grid");
    expect(root.style.width).toBe("auto");
  });

  it("sans border-radius inline (Brutal)", () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="draw" onChange={() => {}} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.borderRadius).toBe("");
    const tab = screen.getAllByRole("tab")[0] as HTMLElement;
    expect(tab.style.borderRadius).toBe("");
  });

  it("navigation flèche droite passe au segment suivant", () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="draw" onChange={onChange} />);
    const active = screen.getByRole("tab", { name: /trackpad/i });
    active.focus();
    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("type");
  });
});
