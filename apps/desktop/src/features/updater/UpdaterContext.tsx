/**
 * UpdaterContext — orchestre la détection et l'installation des mises à jour
 * via `tauri-plugin-updater` v2.
 *
 * Au mount du Shell on déclenche `check()` une seule fois (ne bloque pas le
 * boot : `setTimeout` 0). Si une release plus récente est dispo sur l'endpoint
 * configuré (`tauri.conf.json` → plugins.updater.endpoints), on expose
 * { available: true, version, notes, install() } au reste de l'app.
 *
 * `install()` télécharge l'artifact updater (NSIS pour Windows, .app.tar.gz
 * pour macOS, .deb pour Linux), vérifie la signature ed25519 contre la pubkey
 * embarquée dans le binaire, applique l'install puis relance l'app via
 * `tauri-plugin-process` → `relaunch()`.
 *
 * Tous les appels au plugin sont importés dynamiquement (`await import`) pour
 * que Vitest puisse mock le module facilement et que le bundle JS reste léger
 * en dev (le plugin n'est résolu que côté Tauri).
 */

import type { ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export type DownloadPhase = "idle" | "downloading" | "installing" | "done" | "error";

export interface DownloadProgress {
  phase: DownloadPhase;
  /** Octets totaux à télécharger, fourni par l'event Started. */
  total: number | null;
  /** Octets téléchargés cumulés. */
  downloaded: number;
  /** Message d'erreur si phase === "error". */
  error: string | null;
}

interface UpdaterContextValue {
  /** True dès que `check()` a renvoyé une release plus récente. */
  available: boolean;
  /** Métadonnées de la release distante (null avant `check`). */
  info: UpdateInfo | null;
  /** Progression du téléchargement / install (idle au boot). */
  progress: DownloadProgress;
  /** Lance le DL + install + relaunch. Idempotent. */
  install: () => Promise<void>;
  /** Force un re-check manuel (settings, dev). */
  recheck: () => Promise<void>;
  /** Ferme la bannière sans installer (l'info reste mémorisée pour le prochain boot). */
  dismiss: () => void;
  /** True quand l'utilisateur a cliqué "Plus tard". */
  dismissed: boolean;
}

const initialProgress: DownloadProgress = {
  phase: "idle",
  total: null,
  downloaded: 0,
  error: null,
};

const UpdaterContext = createContext<UpdaterContextValue>({
  available: false,
  info: null,
  progress: initialProgress,
  install: async () => undefined,
  recheck: async () => undefined,
  dismiss: () => undefined,
  dismissed: false,
});

export function useUpdater(): UpdaterContextValue {
  return useContext(UpdaterContext);
}

interface UpdaterProviderProps {
  children: ReactNode;
  /**
   * Désactive le check automatique au mount. Utilisé par les tests pour ne
   * pas déclencher le plugin au render.
   */
  autoCheck?: boolean;
  /**
   * Override du module updater pour tests. Si fourni, on n'importe pas
   * `@tauri-apps/plugin-updater` (qui crashe hors Tauri).
   */
  updaterModule?: UpdaterModuleLike;
  processModule?: ProcessModuleLike;
}

/**
 * Forme minimale du module `@tauri-apps/plugin-updater` qu'on consomme.
 * Permet de typer le mock dans les tests sans dépendre du module réel.
 */
export interface UpdaterModuleLike {
  check: () => Promise<UpdateHandleLike | null>;
}

export interface UpdateHandleLike {
  version: string;
  currentVersion: string;
  body?: string | null;
  date?: string | null;
  downloadAndInstall: (onEvent?: (event: UpdaterEvent) => void) => Promise<void>;
}

export type UpdaterEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export interface ProcessModuleLike {
  relaunch: () => Promise<void>;
}

export function UpdaterProvider({
  children,
  autoCheck = true,
  updaterModule,
  processModule,
}: UpdaterProviderProps): ReactElement {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>(initialProgress);
  const [dismissed, setDismissed] = useState(false);
  const checkInFlight = useRef(false);
  const installInFlight = useRef(false);

  const loadUpdater = useCallback(async (): Promise<UpdaterModuleLike> => {
    if (updaterModule) return updaterModule;
    return (await import("@tauri-apps/plugin-updater")) as unknown as UpdaterModuleLike;
  }, [updaterModule]);

  const loadProcess = useCallback(async (): Promise<ProcessModuleLike> => {
    if (processModule) return processModule;
    return (await import("@tauri-apps/plugin-process")) as unknown as ProcessModuleLike;
  }, [processModule]);

  const runCheck = useCallback(async (): Promise<void> => {
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    try {
      const mod = await loadUpdater();
      const update = await mod.check();
      if (!update) {
        setInfo(null);
        return;
      }
      setInfo({
        version: update.version,
        currentVersion: update.currentVersion,
        notes: update.body ?? null,
        date: update.date ?? null,
      });
      setDismissed(false);
    } catch (err) {
      // Pas d'update detecte / endpoint injoignable / pubkey absente : silent.
      // L'app doit booter même si GitHub est down.
      console.warn("[updater] check failed:", err);
      setInfo(null);
    } finally {
      checkInFlight.current = false;
    }
  }, [loadUpdater]);

  const install = useCallback(async (): Promise<void> => {
    if (installInFlight.current) return;
    if (!info) return;
    installInFlight.current = true;
    setProgress({ phase: "downloading", total: null, downloaded: 0, error: null });
    try {
      const mod = await loadUpdater();
      const update = await mod.check();
      if (!update) {
        setProgress({
          phase: "error",
          total: null,
          downloaded: 0,
          error: "Aucune mise à jour détectée",
        });
        return;
      }
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setProgress((p) => ({
              ...p,
              phase: "downloading",
              total: event.data.contentLength ?? null,
              downloaded: 0,
            }));
            break;
          case "Progress":
            setProgress((p) => ({
              ...p,
              phase: "downloading",
              downloaded: p.downloaded + event.data.chunkLength,
            }));
            break;
          case "Finished":
            setProgress((p) => ({ ...p, phase: "installing" }));
            break;
        }
      });
      setProgress((p) => ({ ...p, phase: "done" }));
      const proc = await loadProcess();
      await proc.relaunch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress({ phase: "error", total: null, downloaded: 0, error: msg });
    } finally {
      installInFlight.current = false;
    }
  }, [info, loadUpdater, loadProcess]);

  const dismiss = useCallback((): void => {
    setDismissed(true);
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    // setTimeout 0 : ne bloque pas le boot, le check se fait après
    // l'hydratation de l'UI.
    const id = setTimeout(() => {
      void runCheck();
    }, 0);
    return () => clearTimeout(id);
  }, [autoCheck, runCheck]);

  return (
    <UpdaterContext.Provider
      value={{
        available: info !== null,
        info,
        progress,
        install,
        recheck: runCheck,
        dismiss,
        dismissed,
      }}
    >
      {children}
    </UpdaterContext.Provider>
  );
}
