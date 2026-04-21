import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { ItemsEditor, type EditableItem } from "./ItemsEditor.js";

function Harness({ initial }: { initial: EditableItem[] }): ReactElement {
  const [items, setItems] = useState<EditableItem[]>(initial);
  let n = 0;
  return (
    <ItemsEditor value={items} onChange={setItems} makeId={() => `gen-${n++}`} />
  );
}

describe("ItemsEditor", () => {
  it("affiche un état vide quand il n'y a pas d'items", () => {
    render(<Harness initial={[]} />);
    expect(screen.getByTestId("items-empty")).toBeInTheDocument();
  });

  it("ajoute un item via le bouton dédié", () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByTestId("items-add"));
    expect(screen.getByTestId("item-row-0")).toBeInTheDocument();
  });

  it("recalcule le total ligne à la saisie de quantité et prix", () => {
    const item: EditableItem = {
      id: "a",
      position: 0,
      description: "Prestation test",
      quantity: 1000,
      unitPriceCents: 10000,
      unit: "jour",
      lineTotalCents: 10000,
      serviceId: null,
    };
    render(<Harness initial={[item]} />);
    const qtyInput = screen.getByLabelText("Quantité") as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: "3" } });
    const total = screen.getByTestId("item-total-0");
    expect(total.textContent).toContain("300,00");
  });

  it("supprime un item via le bouton ×", () => {
    const item: EditableItem = {
      id: "a",
      position: 0,
      description: "A supprimer",
      quantity: 1000,
      unitPriceCents: 10000,
      unit: "jour",
      lineTotalCents: 10000,
      serviceId: null,
    };
    render(<Harness initial={[item]} />);
    fireEvent.click(screen.getByTestId("item-remove-0"));
    expect(screen.getByTestId("items-empty")).toBeInTheDocument();
  });

  it("conserve les positions séquentielles après suppression", () => {
    const items: EditableItem[] = [
      {
        id: "a",
        position: 0,
        description: "Ligne 1",
        quantity: 1000,
        unitPriceCents: 100,
        unit: "jour",
        lineTotalCents: 100,
        serviceId: null,
      },
      {
        id: "b",
        position: 1,
        description: "Ligne 2",
        quantity: 1000,
        unitPriceCents: 200,
        unit: "jour",
        lineTotalCents: 200,
        serviceId: null,
      },
      {
        id: "c",
        position: 2,
        description: "Ligne 3",
        quantity: 1000,
        unitPriceCents: 300,
        unit: "jour",
        lineTotalCents: 300,
        serviceId: null,
      },
    ];
    render(<Harness initial={items} />);
    fireEvent.click(screen.getByTestId("item-remove-1"));
    expect(screen.queryByTestId("item-row-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("item-row-1")).toBeInTheDocument();
  });

  it("affiche la mention TVA micro-entreprise", () => {
    render(<Harness initial={[]} />);
    expect(
      screen.getByText(/art\. 293 B/i),
    ).toBeInTheDocument();
  });

  it("ne rend aucun border-radius inline (règle Brutal)", () => {
    const { container } = render(<Harness initial={[]} />);
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).style.borderRadius).toBe("");
    });
  });
});
