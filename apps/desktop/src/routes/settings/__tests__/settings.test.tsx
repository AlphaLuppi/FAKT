import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` est hoisté en haut du fichier. Pour partager des spies entre la
// factory et les tests, on utilise `vi.hoisted` qui garantit la déclaration
// avant le mock.
const { mockInvoke, mockWorkspaceGet, mockSettingsSet } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue(null),
  // Par défaut retourne null (pas d'onboarding fait). Les describe qui
  // ont besoin du workspace le configurent explicitement en beforeEach.
  mockWorkspaceGet: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
  mockSettingsSet: vi.fn<(key: string, value: string) => Promise<unknown>>().mockResolvedValue({
    key: "x",
    value: "y",
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// `Settings.tsx` utilise l'API sidecar (api.workspace.get, api.settings.set),
// pas les Tauri commands. On mock le client API pour que les tests fonctionnent
// sans sidecar réel.
vi.mock("../../../api/index.js", () => ({
  api: {
    workspace: {
      get: mockWorkspaceGet,
    },
    settings: {
      set: mockSettingsSet,
    },
  },
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock("@fakt/ai", () => ({
  healthCheck: vi.fn().mockResolvedValue({
    installed: false,
    installHint: "Installer Claude Code : winget install Anthropic.Claude",
  }),
}));

vi.mock("@fakt/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fakt/ui")>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    Toaster: () => null,
  };
});

import { MemoryRouter } from "react-router";
import { SettingsRoute } from "../Settings.js";

const mockWorkspace = {
  id: "ws-1",
  name: "Mon Entreprise",
  legalForm: "Micro-entreprise",
  siret: "73282932000074",
  address: "12 rue de la République, 13001 Marseille",
  email: "contact@atelier-mercier.fr",
  iban: null,
  tvaMention: "TVA non applicable, art. 293 B du CGI",
  createdAt: Date.now(),
};

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsRoute />
    </MemoryRouter>
  );
}

describe("SettingsRoute — rendu et tabs", () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue(mockWorkspace);
  });

  it("affiche le titre 'Paramètres'", () => {
    renderSettings();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/param/i);
  });

  it("affiche les 4 tabs", () => {
    renderSettings();
    expect(screen.getByRole("tab", { name: /identit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /claude cli/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /certificat/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /t.l.m.trie/i })).toBeInTheDocument();
  });

  it("affiche le tab Identité par défaut avec aria-selected", () => {
    renderSettings();
    const identityTab = screen.getByRole("tab", { name: /identit/i });
    expect(identityTab).toHaveAttribute("aria-selected", "true");
  });

  it("les autres tabs ont aria-selected=false par défaut", () => {
    renderSettings();
    expect(screen.getByRole("tab", { name: /claude cli/i })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: /certificat/i })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("bascule vers le tab CLI au clic", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /claude cli/i }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /claude cli/i })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });
  });

  it("bascule vers le tab Télémétrie", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /t.l.m.trie/i }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /t.l.m.trie/i })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });
  });
});

describe("SettingsRoute — tab Identité", () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue(mockWorkspace);
    mockWorkspaceGet.mockResolvedValue(mockWorkspace);
  });

  it("pré-remplit le champ nom avec le workspace après chargement", async () => {
    renderSettings();
    // api.workspace.get() est async — attendre le chargement
    await waitFor(
      () => {
        const nameInput = screen.getByLabelText(/nom ou raison/i) as HTMLInputElement;
        expect(nameInput.value).toBe("Mon Entreprise");
      },
      { timeout: 2000 }
    );
  });
});

describe("SettingsRoute — tab Claude CLI", () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue(null);
  });

  it("affiche l'onglet Claude CLI avec son titre", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /claude cli/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(/claude code cli/i);
    });
  });
});

describe("SettingsRoute — tab Télémétrie", () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue(null);
  });

  it("checkbox télémétrie désactivée par défaut", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /t.l.m.trie/i }));

    await waitFor(() => {
      const checkbox = screen.getByLabelText(/t.l.m.trie anonyme/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });
  });
});

describe("SettingsRoute — tab Sessions IA (verbose mode)", () => {
  beforeEach(() => {
    // Par défaut, list_ai_sessions retourne une liste vide.
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_ai_sessions") {
        return Promise.resolve({ active: [], history: [] });
      }
      return Promise.resolve(null);
    });
    window.localStorage.clear();
  });

  it("affiche la section toggle verbose", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /sessions ia/i }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-ai-verbose-section")).toBeInTheDocument();
    });
  });

  it("toggle verbose persistant par défaut sur ON", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /sessions ia/i }));

    const checkbox = await waitFor(
      () => screen.getByTestId("settings-ai-verbose-toggle") as HTMLInputElement
    );
    expect(checkbox.checked).toBe(true);
  });

  it("décocher le toggle verbose écrit false dans localStorage", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /sessions ia/i }));

    const checkbox = await waitFor(
      () => screen.getByTestId("settings-ai-verbose-toggle") as HTMLInputElement
    );
    await user.click(checkbox);
    await waitFor(() => {
      expect(window.localStorage.getItem("fakt:ai:verbose-mode")).toBe("false");
    });
  });
});
