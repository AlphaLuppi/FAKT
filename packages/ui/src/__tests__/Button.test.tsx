import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../primitives/Button.js";

describe("Button", () => {
  it("rend le label et type button par défaut", () => {
    render(<Button>Envoyer</Button>);
    const btn = screen.getByRole("button", { name: /envoyer/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "button");
  });

  it("applique les classes de variant et size", () => {
    render(
      <Button variant="danger" size="lg">
        Supprimer
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("fakt-btn", "fakt-btn--danger", "fakt-btn--lg");
  });

  it("déclenche onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas onClick quand disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ne pose aucun border-radius inline (règle Brutal)", () => {
    const { container } = render(<Button>Primary</Button>);
    const btn = container.firstChild as HTMLButtonElement;
    // Règle Brutal : jamais de radius > 0 posé en inline style
    expect(btn.style.borderRadius).toBe("");
  });
});
