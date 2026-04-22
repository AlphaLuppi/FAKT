import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../overlays/Modal.js";

describe("Modal", () => {
  it("ne rend rien quand fermé", () => {
    const { queryByRole } = render(
      <Modal open={false} title="T">
        body
      </Modal>
    );
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rend le title et children quand ouvert", () => {
    render(
      <Modal open title="Confirmer">
        <span>body</span>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmer")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("ferme via Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open title="T" onClose={onClose}>
        body
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
