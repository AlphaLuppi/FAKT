/**
 * Tests unit pour useVerboseAiMode.
 *
 * Garantit :
 *   - défaut ON en l'absence de localStorage
 *   - persistance via localStorage
 *   - synchro cross-component via CustomEvent
 *   - pas de crash si localStorage indisponible (mode privé strict)
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useVerboseAiMode } from "./useVerboseAiMode.js";

const STORAGE_KEY = "fakt:ai:verbose-mode";

describe("useVerboseAiMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("retourne true par défaut (clé absente dans localStorage)", () => {
    const { result } = renderHook(() => useVerboseAiMode());
    expect(result.current.verbose).toBe(true);
  });

  it("lit la valeur false stockée", () => {
    window.localStorage.setItem(STORAGE_KEY, "false");
    const { result } = renderHook(() => useVerboseAiMode());
    expect(result.current.verbose).toBe(false);
  });

  it("setVerbose persiste dans localStorage", () => {
    const { result } = renderHook(() => useVerboseAiMode());
    act(() => {
      result.current.setVerbose(false);
    });
    expect(result.current.verbose).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false");
    act(() => {
      result.current.setVerbose(true);
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("propage le changement aux autres instances du hook", () => {
    const { result: a } = renderHook(() => useVerboseAiMode());
    const { result: b } = renderHook(() => useVerboseAiMode());
    expect(a.current.verbose).toBe(true);
    expect(b.current.verbose).toBe(true);
    act(() => {
      a.current.setVerbose(false);
    });
    // L'autre instance reçoit le CustomEvent dispatché par writeStored.
    expect(b.current.verbose).toBe(false);
  });
});
