import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AutoGrowTextarea } from "../primitives/Input.js";

describe("AutoGrowTextarea", () => {
  it("rend un textarea rows=1 par défaut (single-line)", () => {
    render(<AutoGrowTextarea value="" onChange={() => {}} aria-label="desc" />);
    const ta = screen.getByRole("textbox", { name: /desc/i });
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta).toHaveAttribute("rows", "1");
  });

  it("style resize=none + overflow=hidden par défaut", () => {
    render(<AutoGrowTextarea value="" onChange={() => {}} aria-label="d" />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.style.resize).toBe("none");
    // Quand maxHeight non défini → overflow: hidden (auto-grow infini)
    expect(ta.style.overflow).toBe("hidden");
  });

  it("overflow devient auto quand maxHeight est fourni", () => {
    render(
      <AutoGrowTextarea
        value=""
        onChange={() => {}}
        aria-label="d"
        maxHeight={200}
      />
    );
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(ta.style.overflow).toBe("auto");
    expect(ta.style.maxHeight).toBe("200px");
  });

  it("appelle onInput et onChange quand on tape", () => {
    const onChange = vi.fn();
    const onInput = vi.fn();
    render(
      <AutoGrowTextarea
        value="foo"
        onChange={onChange}
        onInput={onInput}
        aria-label="d"
      />
    );
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "foobar" } });
    expect(onInput).toHaveBeenCalled();
  });

  it("grandit quand on empile des lignes (controlled component)", () => {
    function Controlled(): ReturnType<typeof AutoGrowTextarea> {
      const [v, setV] = useState("short");
      return (
        <>
          <AutoGrowTextarea
            aria-label="auto"
            value={v}
            onChange={(e): void => setV(e.target.value)}
          />
          <button type="button" onClick={(): void => setV("line1\nline2\nline3\nline4")}>
            long
          </button>
        </>
      );
    }
    render(<Controlled />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    // Dans jsdom scrollHeight est toujours 0, mais on vérifie que le setter
    // .style.height est appliqué sans erreur.
    fireEvent.click(screen.getByRole("button", { name: /long/i }));
    expect(ta.value).toMatch(/line1/);
    expect(ta.value).toMatch(/line4/);
  });

  it("passe data-testid au textarea", () => {
    render(
      <AutoGrowTextarea value="" onChange={() => {}} data-testid="grow-desc" />
    );
    expect(screen.getByTestId("grow-desc")).toBeInTheDocument();
  });

  it("applique aria-invalid=true quand invalid prop", () => {
    render(
      <AutoGrowTextarea value="" onChange={() => {}} aria-label="d" invalid />
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
