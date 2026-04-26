/**
 * Tests UpdateBanner — flow découplé en 3 états + actions download/apply.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./UpdateBanner.js";
import {
  type ProcessModuleLike,
  type UpdaterEvent,
  type UpdaterModuleLike,
  UpdaterProvider,
} from "./UpdaterContext.js";

interface SetupOpts {
  available?: boolean;
  onDownload?: (emit: (event: UpdaterEvent) => void) => Promise<void>;
}

function setup(opts: SetupOpts): {
  updater: UpdaterModuleLike;
  proc: ProcessModuleLike;
  tauriInvoke: ReturnType<typeof vi.fn>;
  rendered: ReactElement;
} {
  const updater: UpdaterModuleLike = {
    check: vi.fn().mockResolvedValue(
      opts.available
        ? {
            version: "0.2.0",
            currentVersion: "0.1.9",
            body: "Notes test",
            date: null,
            download: vi.fn().mockImplementation(async (cb?: (e: UpdaterEvent) => void) => {
              if (opts.onDownload && cb) await opts.onDownload(cb);
            }),
            install: vi.fn().mockResolvedValue(undefined),
          }
        : null
    ),
  };
  const proc: ProcessModuleLike = { relaunch: vi.fn().mockResolvedValue(undefined) };
  const tauriInvoke = vi.fn().mockResolvedValue(undefined);
  const rendered = (
    <UpdaterProvider
      updaterModule={updater}
      processModule={proc}
      releaseFetcher={async () => null}
      tauriInvoke={tauriInvoke}
    >
      <UpdateBanner />
    </UpdaterProvider>
  );
  return { updater, proc, tauriInvoke, rendered };
}

describe("UpdateBanner", () => {
  it("ne rend rien quand aucune update n'est disponible", async () => {
    const { rendered, updater } = setup({ available: false });
    render(rendered);
    await waitFor(() => expect(updater.check).toHaveBeenCalled());
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("affiche la bannière idle avec le titre cliquable et les 2 boutons", async () => {
    const { rendered } = setup({ available: true });
    render(rendered);
    const banner = await screen.findByTestId("update-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute("data-phase")).toBe("idle");
    expect(banner.textContent).toMatch(/v0\.2\.0/);
    expect(screen.getByTestId("update-banner-title")).toBeInTheDocument();
    expect(screen.getByTestId("update-banner-install")).toBeInTheDocument();
    expect(screen.getByTestId("update-banner-dismiss")).toBeInTheDocument();
  });

  it("dismiss masque la bannière", async () => {
    const { rendered } = setup({ available: true });
    render(rendered);
    await screen.findByTestId("update-banner");
    fireEvent.click(screen.getByTestId("update-banner-dismiss"));
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("clic sur le titre ouvre la modale notes", async () => {
    const { rendered } = setup({ available: true });
    render(rendered);
    await screen.findByTestId("update-banner");
    fireEvent.click(screen.getByTestId("update-banner-title"));
    await screen.findByTestId("update-modal");
    expect(screen.getByTestId("update-modal-close")).toBeInTheDocument();
  });

  it("clic Mettre à jour bascule en phase ready avec bouton Redémarrer", async () => {
    const { rendered } = setup({
      available: true,
      onDownload: async (emit) => {
        emit({ event: "Started", data: { contentLength: 500 } });
        emit({ event: "Progress", data: { chunkLength: 500 } });
        emit({ event: "Finished" });
      },
    });
    render(rendered);
    await screen.findByTestId("update-banner");

    fireEvent.click(screen.getByTestId("update-banner-install"));

    const restart = await screen.findByTestId("update-banner-restart");
    expect(restart).toBeInTheDocument();
    expect(screen.getByTestId("update-banner-ready").textContent).toMatch(/redémarrage requis/i);
  });

  it("clic Redémarrer maintenant déclenche prepare_for_install + install + relaunch", async () => {
    const { rendered, proc, tauriInvoke } = setup({
      available: true,
      onDownload: async (emit) => {
        emit({ event: "Started", data: { contentLength: 500 } });
        emit({ event: "Progress", data: { chunkLength: 500 } });
        emit({ event: "Finished" });
      },
    });
    render(rendered);
    await screen.findByTestId("update-banner");

    fireEvent.click(screen.getByTestId("update-banner-install"));
    const restart = await screen.findByTestId("update-banner-restart");

    fireEvent.click(restart);

    await waitFor(() => expect(proc.relaunch).toHaveBeenCalled());
    expect(tauriInvoke).toHaveBeenCalledWith("prepare_for_install");
  });
});
