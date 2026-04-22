import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrestationForm } from "../PrestationForm.js";
import type { PrestationFormValues } from "../PrestationForm.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@fakt/design-tokens", () => ({
  tokens: {
    color: {
      ink: "#000",
      surface: "#fff",
      paper2: "#f5f5f0",
      muted: "#999",
      infoBg: "#e0f0ff",
      warnBg: "#fff3cd",
      successBg: "#d4edda",
      dangerBg: "#f8d7da",
      accentSoft: "#ffff00",
    },
    font: { ui: "Space Grotesk, sans-serif", mono: "JetBrains Mono, monospace" },
    fontSize: { xs: "11px", sm: "12px", base: "14px", lg: "16px", xl: "20px" },
    fontWeight: { bold: "700", black: "800" },
    spacing: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px" },
    stroke: { base: "2px" },
  },
}));

const noop = async (): Promise<void> => undefined;

describe("PrestationForm", () => {
  it("affiche les champs obligatoires", () => {
    render(<PrestationForm open={true} onClose={noop} onSubmit={noop} />);
    expect(screen.getByLabelText(/nom de la prestation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unité/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prix unitaire/i)).toBeInTheDocument();
  });

  it("refuse le submit si nom vide", async () => {
    const onSubmit = vi.fn();
    render(<PrestationForm open={true} onClose={noop} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("soumet avec les bonnes valeurs", async () => {
    const onSubmit = vi.fn(async (_values: PrestationFormValues): Promise<void> => undefined);
    render(<PrestationForm open={true} onClose={noop} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/nom de la prestation/i), "Développement web");
    await userEvent.clear(screen.getByLabelText(/prix unitaire/i));
    await userEvent.type(screen.getByLabelText(/prix unitaire/i), "750");

    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Développement web",
          unitPriceCents: 75000,
        })
      );
    });
  });

  it("pré-remplit les champs en mode édition", () => {
    const initial = {
      id: "s1",
      workspaceId: "ws-1",
      name: "Design UI",
      description: "Création d'interfaces",
      unit: "jour" as const,
      unitPriceCents: 80000,
      tags: ["design"],
      archivedAt: null,
      createdAt: Date.now(),
    };

    render(<PrestationForm open={true} onClose={noop} onSubmit={noop} initial={initial} />);
    expect(screen.getByDisplayValue("Design UI")).toBeInTheDocument();
  });

  it("toggle un tag correctement", async () => {
    render(<PrestationForm open={true} onClose={noop} onSubmit={noop} />);
    const devTag = screen.getByText("dev");
    await userEvent.click(devTag);
    // Le tag doit être actif (fond noir)
    expect(devTag.closest("button")).toHaveStyle({ background: "var(--ink)" });
  });
});
