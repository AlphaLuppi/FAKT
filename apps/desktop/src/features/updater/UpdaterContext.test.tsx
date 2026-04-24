/**
 * Tests UpdaterContext — détection check() + flow d'install + relaunch.
 * Le module @tauri-apps/plugin-updater est mocké via la prop `updaterModule`
 * de UpdaterProvider (pattern dependency injection — pas besoin de
 * vi.mock du module qui est résolu côté Tauri natif uniquement).
 */

import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type ProcessModuleLike,
  type UpdaterEvent,
  type UpdaterModuleLike,
  UpdaterProvider,
  useUpdater,
} from "./UpdaterContext.js";

function makeUpdater(opts: {
  available?: boolean;
  version?: string;
  notes?: string | null;
  onDownload?: (emit: (event: UpdaterEvent) => void) => Promise<void>;
  shouldThrow?: Error;
}): UpdaterModuleLike {
  return {
    check: vi.fn().mockImplementation(async () => {
      if (opts.shouldThrow) throw opts.shouldThrow;
      if (!opts.available) return null;
      return {
        version: opts.version ?? "0.2.0",
        currentVersion: "0.1.9",
        body: opts.notes ?? "Notes",
        date: "2026-04-25T10:00:00Z",
        downloadAndInstall: vi.fn().mockImplementation(async (cb?: (e: UpdaterEvent) => void) => {
          if (opts.onDownload && cb) await opts.onDownload(cb);
        }),
      };
    }),
  };
}

function makeProcess(): ProcessModuleLike {
  return { relaunch: vi.fn().mockResolvedValue(undefined) };
}

function wrapper(updater: UpdaterModuleLike, proc: ProcessModuleLike) {
  return ({ children }: { children: ReactNode }): ReactElement => (
    <UpdaterProvider updaterModule={updater} processModule={proc} autoCheck={true}>
      {children}
    </UpdaterProvider>
  );
}

describe("UpdaterContext", () => {
  it("expose available=false quand check() retourne null", async () => {
    const updater = makeUpdater({ available: false });
    const proc = makeProcess();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrapper(updater, proc) });
    await waitFor(() => expect(updater.check).toHaveBeenCalled());
    expect(result.current.available).toBe(false);
    expect(result.current.info).toBeNull();
  });

  it("expose available=true + info quand une release est trouvée", async () => {
    const updater = makeUpdater({ available: true, version: "0.2.0", notes: "## Changelog" });
    const proc = makeProcess();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrapper(updater, proc) });
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.info?.version).toBe("0.2.0");
    expect(result.current.info?.notes).toBe("## Changelog");
    expect(result.current.info?.currentVersion).toBe("0.1.9");
  });

  it("ne crash pas si check() throw (endpoint injoignable)", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const updater = makeUpdater({ shouldThrow: new Error("network down") });
    const proc = makeProcess();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrapper(updater, proc) });
    await waitFor(() => expect(updater.check).toHaveBeenCalled());
    expect(result.current.available).toBe(false);
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it("install() émet les events Started / Progress / Finished et relaunch", async () => {
    const updater = makeUpdater({
      available: true,
      onDownload: async (emit) => {
        emit({ event: "Started", data: { contentLength: 1000 } });
        emit({ event: "Progress", data: { chunkLength: 250 } });
        emit({ event: "Progress", data: { chunkLength: 750 } });
        emit({ event: "Finished" });
      },
    });
    const proc = makeProcess();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrapper(updater, proc) });
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.progress.phase).toBe("done");
    expect(result.current.progress.downloaded).toBe(1000);
    expect(result.current.progress.total).toBe(1000);
    expect(proc.relaunch).toHaveBeenCalledTimes(1);
  });

  it("install() bascule en phase=error si downloadAndInstall throw", async () => {
    const updater: UpdaterModuleLike = {
      check: vi.fn().mockResolvedValue({
        version: "0.2.0",
        currentVersion: "0.1.9",
        body: null,
        date: null,
        downloadAndInstall: vi.fn().mockRejectedValue(new Error("sig invalid")),
      }),
    };
    const proc = makeProcess();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrapper(updater, proc) });
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.progress.phase).toBe("error");
    expect(result.current.progress.error).toBe("sig invalid");
    expect(proc.relaunch).not.toHaveBeenCalled();
  });

  it("dismiss() ne purge pas info mais set dismissed=true", async () => {
    const updater = makeUpdater({ available: true });
    const proc = makeProcess();
    const { result } = renderHook(() => useUpdater(), { wrapper: wrapper(updater, proc) });
    await waitFor(() => expect(result.current.available).toBe(true));

    act(() => result.current.dismiss());

    expect(result.current.dismissed).toBe(true);
    expect(result.current.info).not.toBeNull();
  });

  it("ne déclenche pas check() automatique quand autoCheck=false", async () => {
    const updater = makeUpdater({ available: true });
    const proc = makeProcess();
    const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <UpdaterProvider updaterModule={updater} processModule={proc} autoCheck={false}>
        {children}
      </UpdaterProvider>
    );
    function Probe(): ReactElement {
      const u = useUpdater();
      return <span data-testid="probe">{u.available ? "yes" : "no"}</span>;
    }
    render(
      <Wrapper>
        <Probe />
      </Wrapper>
    );
    expect(updater.check).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").textContent).toBe("no");
  });
});
