import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stubs Tauri commands
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Stub healthCheck
vi.mock("@fakt/ai", () => ({
  healthCheck: vi.fn().mockResolvedValue({
    installed: true,
    version: "1.0.0",
    path: "/usr/local/bin/claude",
  }),
}));

// Stub toast et Toaster
vi.mock("@fakt/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fakt/ui")>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    Toaster: () => null,
  };
});

import { MemoryRouter } from "react-router";
import { WizardRoute } from "../Wizard.js";

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <WizardRoute />
    </MemoryRouter>
  );
}

const VALID_SIRET = "73282932000074";

describe("Wizard — rendu initial (étape 1)", () => {
  it("affiche le heading Identité légale", () => {
    renderWizard();
    // Le h2 du step 1 contient "Votre identité légale"
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent?.toLowerCase()).toMatch(/identit/i);
  });

  it("affiche un champ SIRET avec placeholder", () => {
    renderWizard();
    const siretInput = screen.getByPlaceholderText(/123 456 789/);
    expect(siretInput).toBeInTheDocument();
  });

  it("bouton Suivant désactivé si formulaire vide", () => {
    renderWizard();
    const nextBtn = screen.getByRole("button", { name: /suivant/i });
    expect(nextBtn).toBeDisabled();
  });
});

describe("Wizard — navigation étape 1 → 2", () => {
  it("active le bouton Suivant quand le formulaire est valide", async () => {
    const user = userEvent.setup();
    renderWizard();

    const nameInput = screen.getByLabelText(/nom ou raison/i);
    const siretInput = screen.getByPlaceholderText(/123 456 789/);
    const addressInput = screen.getByLabelText(/adresse/i);
    const emailInput = screen.getByLabelText(/email de facturation/i);

    await user.type(nameInput, "Atelier Mercier");
    await user.type(siretInput, VALID_SIRET);
    await user.type(addressInput, "12 rue de la République, 13001 Marseille");
    await user.type(emailInput, "contact@atelier-mercier.fr");

    const nextBtn = screen.getByRole("button", { name: /suivant/i });
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
  });

  it("passe à l'étape Claude CLI après submit étape 1", async () => {
    const user = userEvent.setup();
    renderWizard();

    const nameInput = screen.getByLabelText(/nom ou raison/i);
    const siretInput = screen.getByPlaceholderText(/123 456 789/);
    const addressInput = screen.getByLabelText(/adresse/i);
    const emailInput = screen.getByLabelText(/email de facturation/i);

    await user.type(nameInput, "Atelier Mercier");
    await user.type(siretInput, VALID_SIRET);
    await user.type(addressInput, "12 rue de la République, 13001 Marseille");
    await user.type(emailInput, "contact@atelier-mercier.fr");

    const nextBtn = screen.getByRole("button", { name: /suivant/i });
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    await user.click(nextBtn);

    await waitFor(() => {
      // L'étape 2 a un h2 contenant "Claude CLI"
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.textContent?.toLowerCase()).toMatch(/claude/i);
    });
  });
});

describe("Wizard — étape 2 Claude CLI (skip)", () => {
  it("affiche la checkbox 'Je configurerai Claude plus tard' en étape 2", async () => {
    const user = userEvent.setup();
    renderWizard();

    // Aller à l'étape 2
    await user.type(screen.getByLabelText(/nom ou raison/i), "Test");
    await user.type(screen.getByPlaceholderText(/123 456 789/), VALID_SIRET);
    await user.type(screen.getByLabelText(/adresse/i), "12 rue test");
    await user.type(screen.getByLabelText(/email de facturation/i), "a@b.fr");
    const nextBtn = screen.getByRole("button", { name: /suivant/i });
    await waitFor(() => expect(nextBtn).not.toBeDisabled());
    await user.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/configurerai claude plus tard/i)).toBeInTheDocument();
    });
  });
});

describe("Wizard — barre de progression", () => {
  it("affiche un indicateur d'étape courante avec aria-current", () => {
    renderWizard();
    const currentStep = document.querySelector("[aria-current='step']");
    expect(currentStep).toBeInTheDocument();
  });

  it("affiche le numéro de l'étape active (1)", () => {
    renderWizard();
    const currentStep = document.querySelector("[aria-current='step']");
    expect(currentStep?.textContent).toBe("1");
  });
});
