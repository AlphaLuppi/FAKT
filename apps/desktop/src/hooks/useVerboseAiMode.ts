/**
 * useVerboseAiMode — toggle "Mode verbose IA" persistant.
 *
 * Contrôle l'affichage des étapes internes de l'IA dans le Composer IA :
 *   - thinking blocks (extended thinking Claude)
 *   - tool_use blocks (appels d'outils MCP)
 *   - tool_result blocks (retours d'outils)
 *
 * Persistance : localStorage (clé `fakt:ai:verbose-mode`). Le workspace
 * settings côté sidecar (api.settings.set) n'est pas utilisé ici — la
 * préférence est purement UI/device et ne mérite pas un round-trip API.
 * Défaut : ON (debug friendly pour v0.1.x, Tom peut désactiver pour un
 * rendu "chat propre" une fois la feature stabilisée).
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "fakt:ai:verbose-mode";
const DEFAULT_VERBOSE = true;

/** Lit la valeur stockée sans provoquer d'erreur si localStorage indisponible. */
function readStored(): boolean {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return DEFAULT_VERBOSE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_VERBOSE;
    return raw === "true";
  } catch {
    return DEFAULT_VERBOSE;
  }
}

function writeStored(enabled: boolean): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    // Notifie les autres composants de la page (settings + sidebar) du
    // changement sans avoir à reload — useVerboseAiMode y écoute et refresh.
    window.dispatchEvent(
      new CustomEvent<{ enabled: boolean }>(STORAGE_EVENT, { detail: { enabled } })
    );
  } catch {
    // Silencieux — mode privé strict ou quota dépassé : on perd la persistance
    // mais l'UI fonctionne (la mémoire in-state reste valide).
  }
}

const STORAGE_EVENT = "fakt:verbose-mode-change";

export interface UseVerboseAiMode {
  verbose: boolean;
  setVerbose: (enabled: boolean) => void;
}

/**
 * Retourne l'état courant + un setter. La valeur est partagée entre toutes
 * les instances du hook via un CustomEvent + listener — un toggle dans
 * Settings se répercute immédiatement dans le ComposerSidebar sans remount.
 */
export function useVerboseAiMode(): UseVerboseAiMode {
  const [verbose, setVerboseState] = useState<boolean>(readStored);

  useEffect(() => {
    const onChange = (evt: Event): void => {
      if (!(evt instanceof CustomEvent)) return;
      const detail = evt.detail as { enabled?: boolean } | undefined;
      if (typeof detail?.enabled === "boolean") {
        setVerboseState(detail.enabled);
      }
    };
    window.addEventListener(STORAGE_EVENT, onChange);
    // Storage event : couvre le cas d'un changement depuis un autre onglet
    // ou une autre fenêtre Tauri (mono-window en v0.1 mais au cas où).
    const onStorage = (evt: StorageEvent): void => {
      if (evt.key === STORAGE_KEY && evt.newValue !== null) {
        setVerboseState(evt.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return (): void => {
      window.removeEventListener(STORAGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setVerbose = useCallback((enabled: boolean): void => {
    setVerboseState(enabled);
    writeStored(enabled);
  }, []);

  return { verbose, setVerbose };
}
