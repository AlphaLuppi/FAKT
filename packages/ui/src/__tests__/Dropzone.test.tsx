import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dropzone } from "../primitives/Dropzone.js";

function makeFile(name: string, content = "hello", type = "text/plain"): File {
  return new File([content], name, { type });
}

describe("Dropzone", () => {
  it("rend les children au repos et n'affiche pas l'overlay", () => {
    render(
      <Dropzone onFiles={vi.fn()} data-testid="dz">
        <textarea data-testid="inner" />
      </Dropzone>
    );
    expect(screen.getByTestId("inner")).toBeInTheDocument();
    expect(screen.getByTestId("dz")).toHaveAttribute("data-over", "false");
  });

  it("passe en état drag-over sur dragEnter et affiche le label", () => {
    render(
      <Dropzone onFiles={vi.fn()} data-testid="dz" label="DÉPOSE ICI">
        <span>inner</span>
      </Dropzone>
    );
    const zone = screen.getByTestId("dz");
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(zone).toHaveAttribute("data-over", "true");
    expect(screen.getByText("DÉPOSE ICI")).toBeInTheDocument();
  });

  it("revient à l'état repos après dragLeave symétrique à dragEnter", () => {
    render(
      <Dropzone onFiles={vi.fn()} data-testid="dz">
        <span>inner</span>
      </Dropzone>
    );
    const zone = screen.getByTestId("dz");
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    fireEvent.dragLeave(zone, { dataTransfer: { files: [] } });
    expect(zone).toHaveAttribute("data-over", "false");
  });

  it("déclenche onFiles sur drop avec les fichiers déposés", () => {
    const onFiles = vi.fn();
    render(
      <Dropzone onFiles={onFiles} data-testid="dz">
        <span>inner</span>
      </Dropzone>
    );
    const zone = screen.getByTestId("dz");
    const file = makeFile("a.txt");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    const received = onFiles.mock.calls[0]?.[0] as File[];
    expect(received).toHaveLength(1);
    expect(received[0]?.name).toBe("a.txt");
  });

  it("n'appelle pas onFiles sur drop vide", () => {
    const onFiles = vi.fn();
    render(
      <Dropzone onFiles={onFiles} data-testid="dz">
        <span>inner</span>
      </Dropzone>
    );
    const zone = screen.getByTestId("dz");
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it("click sur la zone (hors input) ouvre le file dialog", () => {
    const onFiles = vi.fn();
    const { container } = render(
      <Dropzone onFiles={onFiles} data-testid="dz">
        <div data-testid="content">Contenu</div>
      </Dropzone>
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByTestId("content"));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("click sur un <button> enfant n'ouvre PAS le file dialog", () => {
    const onFiles = vi.fn();
    const { container } = render(
      <Dropzone onFiles={onFiles} data-testid="dz">
        <button type="button" data-testid="inner-btn">
          Action
        </button>
      </Dropzone>
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByTestId("inner-btn"));
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("ne drop pas quand disabled", () => {
    const onFiles = vi.fn();
    render(
      <Dropzone onFiles={onFiles} disabled data-testid="dz">
        <span>inner</span>
      </Dropzone>
    );
    const zone = screen.getByTestId("dz");
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("a.txt")] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(zone).toHaveAttribute("aria-disabled", "true");
  });

  it("propage accept sur l'input caché (joined sur ,)", () => {
    const { container } = render(
      <Dropzone onFiles={vi.fn()} accept={[".txt", ".md"]}>
        <span>inner</span>
      </Dropzone>
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    expect(input.getAttribute("accept")).toBe(".txt,.md");
  });

  it("touche Enter déclenche le file dialog (accessibilité clavier)", () => {
    const { container } = render(
      <Dropzone onFiles={vi.fn()} data-testid="dz">
        <span>inner</span>
      </Dropzone>
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(screen.getByTestId("dz"), { key: "Enter" });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("ne pose aucun border-radius inline (règle Brutal)", () => {
    const { container } = render(
      <Dropzone onFiles={vi.fn()}>
        <span>inner</span>
      </Dropzone>
    );
    const dz = container.firstChild as HTMLDivElement;
    expect(dz.style.borderRadius).toBe("");
  });
});
