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
  /**
   * Override du fetcher de body GitHub Release (tests). Reçoit la version
   * détectée (sans préfixe `v`) et renvoie le body Markdown de la release —
   * ou null en cas d'échec / release introuvable. Le défaut hit l'API
   * GitHub publique (rate-limit 60 req/h non auth, suffisant pour un check
   * au boot). On override aussi pour éviter les requêtes réseau dans Vitest.
   */
  releaseFetcher?: (version: string, signal: AbortSignal) => Promise<string | null>;
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
}: UpdaterProviderProps): ReactElement {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress>(initialProgress);
  const [dismissed, setDismissed] = useState(false);
  const checkInFlight = useRef(false);
  const installInFlight = useRef(false);
  // Handle Update conservé entre check() et install() : garantit que les notes
  // affichées dans la modale correspondent EXACTEMENT à l'artifact téléchargé,
  // même si la release GitHub est modifiée entre la détection et le clic.
  const updateHandleRef = useRef<UpdateHandleLike | null>(null);

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

  const install = useCallback(async (): Promise<void> => {
    if (installInFlight.current) return;
    if (!info) return;
    installInFlight.current = true;
    setProgress({ phase: "downloading", total: null, downloaded: 0, error: null });
    try {
      // Réutilise le handle obtenu lors du check initial : garantit que les
      // notes affichées correspondent à l'artifact téléchargé. Si pas de handle
      // (re-check forcé entre-temps, edge case tests), on refait un check.
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
      // Sur Windows en mode `passive`, NSIS lance l'installer qui tue le
      // processus actuel et relance le binaire mis à jour : relaunch() est
      // alors no-op (process déjà mort). Sur macOS/Linux, downloadAndInstall
      // applique le patch à chaud et relaunch() est nécessaire pour redémarrer.
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
