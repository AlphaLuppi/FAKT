import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Overlay } from "../overlays/Overlay.js";

describe("Overlay", () => {
  it("ne rend rien quand fermé", () => {
    const { container } = render(<Overlay open={false}>x</Overlay>);
    expect(container).toBeEmptyDOMElement();
  });

  it("ferme au clic sur le backdrop", () => {
    const onClose = vi.fn();
    render(
      <Overlay open onClose={onClose}>
        <div>content</div>
      </Overlay>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalled();
  });
});
