/**
 * Tests UpdateBanner — affichage conditionnel + actions install/dismiss.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { UpdateBanner } from "./UpdateBanner.js";
import {
  type ProcessModuleLike,
  type UpdaterModuleLike,
  UpdaterProvider,
} from "./UpdaterContext.js";

function setup(opts: { available?: boolean }): {
  updater: UpdaterModuleLike;
  proc: ProcessModuleLike;
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
            downloadAndInstall: vi.fn().mockResolvedValue(undefined),
          }
        : null
    ),
  };
  const proc: ProcessModuleLike = { relaunch: vi.fn().mockResolvedValue(undefined) };
  const rendered = (
    <UpdaterProvider updaterModule={updater} processModule={proc} releaseFetcher={async () => null}>
      <UpdateBanner />
    </UpdaterProvider>
  );
  return { updater, proc, rendered };
}

describe("UpdateBanner", () => {
  it("ne rend rien quand aucune update n'est disponible", async () => {
    const { rendered, updater } = setup({ available: false });
    render(rendered);
    await waitFor(() => expect(updater.check).toHaveBeenCalled());
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("affiche la bannière jaune avec la version quand update dispo", async () => {
    const { rendered } = setup({ available: true });
    render(rendered);
    const banner = await screen.findByTestId("update-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/v0\.2\.0/);
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

  it("clic Installer maintenant ouvre la modale", async () => {
    const { rendered } = setup({ available: true });
    render(rendered);
    await screen.findByTestId("update-banner");
    fireEvent.click(screen.getByTestId("update-banner-install"));
    await screen.findByTestId("update-modal");
    expect(screen.getByTestId("update-modal")).toBeInTheDocument();
  });
});
