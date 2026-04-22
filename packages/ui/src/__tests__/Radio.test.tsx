import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup } from "../primitives/Radio.js";

describe("RadioGroup", () => {
  it("rend les options et coche la valeur courante", () => {
    render(
      <RadioGroup
        name="doc"
        value="devis"
        options={[
          { value: "devis", label: "Devis" },
          { value: "facture", label: "Facture" },
        ]}
      />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect((radios[1] as HTMLInputElement).checked).toBe(false);
  });

  it("déclenche onChange avec la nouvelle valeur", () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="doc"
        value="devis"
        onChange={onChange}
        options={[
          { value: "devis", label: "Devis" },
          { value: "facture", label: "Facture" },
        ]}
      />
    );
    fireEvent.click(screen.getAllByRole("radio")[1] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith("facture");
  });
});
