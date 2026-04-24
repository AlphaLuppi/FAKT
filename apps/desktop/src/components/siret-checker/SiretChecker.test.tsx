import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiretChecker } from "./SiretChecker.js";

describe("SiretChecker", () => {
  it("ne rend rien quand show=false", () => {
    const { container } = render(<SiretChecker value="" show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend rien quand show=true mais la valeur est vide", () => {
    const { container } = render(<SiretChecker value="" show={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend rien quand le SIRET est valide", () => {
    // SIRET Luhn-valide (suite de tests legal)
    const { container } = render(<SiretChecker value="73282932000074" show={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("indique le nombre de chiffres manquants si trop court", () => {
    render(<SiretChecker value="1234567" show={true} />);
    expect(screen.getByTestId("siret-checker")).toBeInTheDocument();
    expect(screen.getByText(/14 chiffres — vous en avez 7/)).toBeInTheDocument();
  });

  it("signale les caractères non-numériques", () => {
    render(<SiretChecker value="7328293200007A" show={true} />);
    expect(screen.getByText(/un siret ne contient que des chiffres/i)).toBeInTheDocument();
  });

  it("affiche le chiffre attendu quand la clé Luhn est mauvaise", () => {
    // SIRET avec 13 premiers bons mais dernier faux : clé attendue = 4
    render(<SiretChecker value="73282932000073" show={true} />);
    expect(screen.getByText(/clé de sécurité incorrecte/i)).toBeInTheDocument();
    expect(screen.getByText(/devrait être/i)).toBeInTheDocument();
    // Le digit attendu doit apparaître comme valeur (via <strong>)
    const strongs = screen.getAllByText(/^[0-9]$/);
    const values = strongs.map((e) => e.textContent);
    expect(values).toContain("4");
    expect(values).toContain("3");
  });

  it("ouvre un popover pédagogique 'Pourquoi ?' en cas de Luhn KO", () => {
    render(<SiretChecker value="12345678900012" show={true} />);
    expect(screen.getByText(/pourquoi ce contrôle/i)).toBeInTheDocument();
    expect(screen.getByText(/algorithme de luhn/i)).toBeInTheDocument();
  });
});
