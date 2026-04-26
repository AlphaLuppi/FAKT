/**
 * UpdaterContext — orchestre la détection, le téléchargement et l'application
 * d'une mise à jour via `tauri-plugin-updater` v2.
 *
 * Flow utilisateur (cf. demande Tom) :
 *
 *   1. `check()` au mount → si update dispo, expose `info` + `available=true`.
 *   2. L'utilisateur clique « Mettre à jour » → `download()` ne fait QUE
 *      télécharger l'artifact (event Started/Progress/Finished pour la
 *      progress bar) et bascule la phase à `'ready'`. L'app reste ouverte
 *      et utilisable.
 *   3. L'utilisateur clique « Redémarrer maintenant » → `applyAndRestart()`
 *      invoke d'abord la commande Rust `prepare_for_install` qui kill le
 *      sidecar et attend ~1.5s que Windows libère le file handle (sans ça
 *      NSIS échoue avec « Error opening file for writing fakt-api.exe »),
 *      puis `update.install()` (Windows : NSIS prend la main et tue
 *      l'app ; macOS/Linux : patch in-place + relaunch explicite).
 *
 * Tous les imports de modules natifs (`@tauri-apps/plugin-updater`,
 * `@tauri-apps/plugin-process`, `@tauri-apps/api/core`) sont dynamiques
 * pour permettre au bundle web de les exclure et aux tests Vitest de les
 * mocker via les props d'injection.
 */

import type { ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

export type DownloadPhase = "idle" | "downloading" | "ready" | "installing" | "done" | "error";

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
  /**
   * Télécharge l'artifact updater dans un buffer Tauri sans l'appliquer.
   * Phase finale : `'ready'` (l'app reste ouverte). Idempotent.
   */
  download: () => Promise<void>;
  /**
   * Applique l'update téléchargé : kill du sidecar, install NSIS/.app/.deb
   * puis relaunch. Sur Windows, cette promise ne se résout généralement pas
   * (le NSIS tue le process avant). Idempotent.
   */
  applyAndRestart: () => Promise<void>;
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
  download: async () => undefined,
  applyAndRestart: async () => undefined,
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
  /**
   * Override du fetcher de body GitHub Release (tests). Reçoit la version
   * détectée (sans préfixe `v`) et renvoie le body Markdown de la release —
   * ou null en cas d'échec / release introuvable. Le défaut hit l'API
   * GitHub publique (rate-limit 60 req/h non auth, suffisant pour un check
   * au boot). On override aussi pour éviter les requêtes réseau dans Vitest.
   */
  releaseFetcher?: (version: string, signal: AbortSignal) => Promise<string | null>;
  /**
   * Override de l'invoke Tauri pour tests. Sert à mocker la commande
   * `prepare_for_install` (kill sidecar + sleep) sans dépendre du runtime
   * Tauri. En prod, on tombe sur `@tauri-apps/api/core::invoke`.
   */
  tauriInvoke?: (cmd: string) => Promise<unknown>;
}

/**
 * Forme minimale du module `@tauri-apps/plugin-updater` qu'on consomme.
 * Permet de typer le mock dans les tests sans dépendre du module réel.
 *
 * Les méthodes `download` et `install` sont séparées pour le flow découplé
 * (download au click "Mettre à jour", install au click "Redémarrer").
 * `downloadAndInstall` reste exposé en optional pour compat avec les anciens
 * mocks de tests qui peuvent ne pas avoir migré.
 */
export interface UpdaterModuleLike {
  check: () => Promise<UpdateHandleLike | null>;
}

export interface UpdateHandleLike {
  version: string;
  currentVersion: string;
  body?: string | null;
  date?: string | null;
  download: (onEvent?: (event: UpdaterEvent) => void) => Promise<void>;
  install: () => Promise<void>;
}

export type UpdaterEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export interface ProcessModuleLike {
  relaunch: () => Promise<void>;
}

/**
 * Repo GitHub source-of-truth pour les release notes. Le `latest.json`
 * publié par tauri-action contient un placeholder figé au moment du
 * build CI ; on enrichit donc les notes en fetchant le body de la
 * release GitHub (mis à jour post-build par `gh release edit --notes-file`
 * via le skill /release).
 */
const FAKT_RELEASES_REPO = "AlphaLuppi/FAKT";

async function defaultFetchReleaseBody(
  version: string,
  signal: AbortSignal
): Promise<string | null> {
  try {
    const tag = `v${version}`;
    const url = `https://api.github.com/repos/${FAKT_RELEASES_REPO}/releases/tags/${tag}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { body?: string | null };
    const body = json.body;
    return typeof body === "string" && body.trim().length > 0 ? body : null;
  } catch {
    // Network down, CSP block, abort, JSON parse error : on retombe
    // gracieusement sur les notes du latest.json (fallback caller-side).
    return null;
  }
}

export function UpdaterProvider({
  children,
  autoCheck = true,
  updaterModule,
  processModule,
  releaseFetcher,
  tauriInvoke,
}: UpdaterProviderProps): ReactElement {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>(initialProgress);
  const [dismissed, setDismissed] = useState(false);
  const checkInFlight = useRef(false);
  const downloadInFlight = useRef(false);
  const applyInFlight = useRef(false);
  // Handle Update conservé entre check() / download() / install() : garantit
  // que l'artifact appliqué correspond exactement aux notes affichées, même
  // si la release GitHub est éditée entre la détection et le clic. Conservé
  // aussi entre download() et applyAndRestart() pour réutiliser le buffer
  // déjà téléchargé sans re-fetch.
  const updateHandleRef = useRef<UpdateHandleLike | null>(null);

  const loadUpdater = useCallback(async (): Promise<UpdaterModuleLike> => {
    if (updaterModule) return updaterModule;
    return (await import("@tauri-apps/plugin-updater")) as unknown as UpdaterModuleLike;
  }, [updaterModule]);

  const loadProcess = useCallback(async (): Promise<ProcessModuleLike> => {
    if (processModule) return processModule;
    return (await import("@tauri-apps/plugin-process")) as unknown as ProcessModuleLike;
  }, [processModule]);

  const invokeCmd = useCallback(
    async (cmd: string): Promise<unknown> => {
      if (tauriInvoke) return tauriInvoke(cmd);
      const core = (await import("@tauri-apps/api/core")) as unknown as {
        invoke: (c: string) => Promise<unknown>;
      };
      return core.invoke(cmd);
    },
    [tauriInvoke]
  );

  const runCheck = useCallback(async (): Promise<void> => {
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    try {
      const mod = await loadUpdater();
      const update = await mod.check();
      if (!update) {
        updateHandleRef.current = null;
        setInfo(null);
        return;
      }
      updateHandleRef.current = update;
      const fallbackNotes = update.body ?? null;
      setInfo({
        version: update.version,
        currentVersion: update.currentVersion,
        notes: fallbackNotes,
        date: update.date ?? null,
      });
      setDismissed(false);

      // Best-effort enrichment : on remplace les notes du latest.json
      // (souvent un placeholder CI) par le body de la release GitHub,
      // qui est la source de vérité maintenue par le skill /release.
      // Timeout 3s pour ne jamais geler l'UI si l'API est lente.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const fetcher = releaseFetcher ?? defaultFetchReleaseBody;
      const ghBody = await fetcher(update.version, ctrl.signal);
      clearTimeout(timer);
      if (ghBody) {
        setInfo((prev) =>
          prev && prev.version === update.version ? { ...prev, notes: ghBody } : prev
        );
      }
    } catch (err) {
      // Pas d'update detecte / endpoint injoignable / pubkey absente : silent.
      // L'app doit booter même si GitHub est down.
      console.warn("[updater] check failed:", err);
      updateHandleRef.current = null;
      setInfo(null);
    } finally {
      checkInFlight.current = false;
    }
  }, [loadUpdater, releaseFetcher]);

  const download = useCallback(async (): Promise<void> => {
    if (downloadInFlight.current) return;
    if (!info) return;
    downloadInFlight.current = true;
    setProgress({ phase: "downloading", total: null, downloaded: 0, error: null });
    try {
      let update = updateHandleRef.current;
      if (!update) {
        const mod = await loadUpdater();
        update = await mod.check();
        updateHandleRef.current = update;
      }
      if (!update) {
        setProgress({
          phase: "error",
          total: null,
          downloaded: 0,
          error: "Aucune mise à jour détectée",
        });
        return;
      }
      await update.download((event) => {
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
            // On ne bascule pas en 'ready' ici : on attend que le await
            // au-dessus revienne, signe que le buffer est bien finalisé
            // côté Rust. Sinon on aurait une race entre le dernier chunk
            // reçu et la fin du write.
            break;
        }
      });
      setProgress((p) => ({ ...p, phase: "ready" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress({ phase: "error", total: null, downloaded: 0, error: msg });
    } finally {
      downloadInFlight.current = false;
    }
  }, [info, loadUpdater]);

  const applyAndRestart = useCallback(async (): Promise<void> => {
    if (applyInFlight.current) return;
    const update = updateHandleRef.current;
    if (!update) {
      // Edge case : on appelle applyAndRestart sans avoir téléchargé d'abord.
      // Plutôt que de silently no-op, on signale une erreur visible.
      setProgress({
        phase: "error",
        total: null,
        downloaded: 0,
        error: "Téléchargement requis avant l'installation",
      });
      return;
    }
    applyInFlight.current = true;
    setProgress((p) => ({ ...p, phase: "installing", error: null }));
    try {
      // Étape critique Windows : kill du sidecar fakt-api.exe + grace period
      // pour libérer le file handle avant que NSIS ne tente d'écraser le
      // binaire. Sans ça : « Error opening file for writing » bloque l'install.
      await invokeCmd("prepare_for_install");
      await update.install();
      // Atteint uniquement sur macOS/Linux (Windows : NSIS tue déjà le process).
      setProgress((p) => ({ ...p, phase: "done" }));
      const proc = await loadProcess();
      await proc.relaunch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress({ phase: "error", total: null, downloaded: 0, error: msg });
    } finally {
      applyInFlight.current = false;
    }
  }, [invokeCmd, loadProcess]);

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
        download,
        applyAndRestart,
        recheck: runCheck,
        dismiss,
        dismissed,
      }}
    >
      {children}
    </UpdaterContext.Provider>
  );
}
