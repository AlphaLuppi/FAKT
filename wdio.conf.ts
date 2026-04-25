/// <reference types="node" />
/**
 * WebdriverIO configuration — tests E2E **mode release** sur le binaire Tauri
 * packagé.
 *
 * Architecture :
 *   1. `cargo install tauri-driver` doit être présent sur la machine (CI ou
 *      local). Le binaire `tauri-driver` lance un WebDriver server qui wrap
 *      l'application Tauri compilée.
 *   2. Avant `wdio run`, on lance `tauri-driver --port 4444` en background.
 *      Sur Windows, `tauri-driver` télécharge automatiquement Edge WebDriver.
 *      Sur Linux, il utilise WebKitGTK web inspector.
 *      Sur macOS, **pas supporté** par Apple — `mac` est exclu de la matrice.
 *   3. Le path du binaire à tester est défini par `FAKT_RELEASE_BINARY` (env)
 *      ou défaut détecté selon l'OS dans `releaseBinaryPath()`.
 *
 * En CI (`.github/workflows/e2e-release.yml`), le job :
 *   - build le binaire (`bun --cwd apps/desktop tauri:build`)
 *   - install `tauri-driver` via cargo
 *   - démarre `tauri-driver` en background
 *   - lance `wdio run wdio.conf.ts`
 *
 * Référence : https://v2.tauri.app/develop/tests/webdriver/
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join, resolve } from "node:path";
import type { Options } from "@wdio/types";

const REPO_ROOT = resolve(__dirname);
const TAURI_TARGET = join(REPO_ROOT, "apps", "desktop", "src-tauri", "target", "release");

/**
 * Détecte le binaire compilé selon l'OS courant. Le name du binaire est
 * défini par `tauri.conf.json` (productName=FAKT) — Tauri exporte les exes
 * en kebab-case côté Cargo (`fakt`), pas le productName complet.
 */
function releaseBinaryPath(): string {
  const override = process.env.FAKT_RELEASE_BINARY;
  if (override && existsSync(override)) return override;
  switch (platform()) {
    case "win32":
      return join(TAURI_TARGET, "fakt.exe");
    case "linux":
      return join(TAURI_TARGET, "fakt");
    case "darwin":
      // tauri-driver n'est pas supporté sur macOS — l'erreur sera levée par
      // le runner, ce path n'est donné que pour cohérence.
      return join(
        REPO_ROOT,
        "apps",
        "desktop",
        "src-tauri",
        "target",
        "universal-apple-darwin",
        "release",
        "bundle",
        "macos",
        "FAKT.app",
        "Contents",
        "MacOS",
        "fakt"
      );
    default:
      throw new Error(`Plateforme non supportée pour les tests E2E release : ${platform()}`);
  }
}

if (platform() === "darwin") {
  console.warn(
    "[wdio] macOS détecté — tauri-driver n'est pas supporté par Apple WebDriver. " +
      "Le job sera skippé. Utiliser Linux ou Windows pour les tests E2E release."
  );
}

let tauriDriverProcess: ChildProcess | null = null;

/**
 * Spawn `tauri-driver --port 4444` avant la suite. Le binaire doit être
 * présent dans le PATH (`cargo install tauri-driver` au préalable).
 */
function spawnTauriDriver(): Promise<void> {
  return new Promise((resolveSpawn, rejectSpawn) => {
    if (process.env.FAKT_E2E_DRIVER_EXTERNAL === "1") {
      // CI gère elle-même le démarrage — on assume que le port 4444 est déjà ouvert.
      resolveSpawn();
      return;
    }
    tauriDriverProcess = spawn("tauri-driver", ["--port", "4444"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    tauriDriverProcess.on("error", (err: Error) => {
      rejectSpawn(
        new Error(
          `Impossible de démarrer tauri-driver — vérifier 'cargo install tauri-driver'. ${err.message}`
        )
      );
    });
    // Petit délai pour laisser tauri-driver bind le port avant de lancer wdio.
    setTimeout(resolveSpawn, 1500);
  });
}

function killTauriDriver(): void {
  if (tauriDriverProcess && !tauriDriverProcess.killed) {
    tauriDriverProcess.kill();
    tauriDriverProcess = null;
  }
}

export const config: Options.Testrunner = {
  runner: "local",
  tsConfigPath: "./tsconfig.wdio.json",

  specs: ["./apps/desktop/tests/e2e-release/**/*.spec.ts"],
  exclude: [],

  maxInstances: 1,

  capabilities: [
    {
      // tauri:options est l'objet propre à tauri-driver (pas standard W3C)
      // qui désigne le binaire à lancer. Le browserName 'wry' est requis.
      browserName: "wry",
      "tauri:options": {
        application: releaseBinaryPath(),
      },
    } as WebdriverIO.Capabilities,
  ],

  hostname: "127.0.0.1",
  port: 4444,
  // Pas de baseUrl — on ne pilote pas un serveur HTTP, on pilote l'app.
  logLevel: "info",

  bail: 0,
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },

  /**
   * Hooks lifecycle — démarrer tauri-driver avant la suite, kill à la fin.
   */
  onPrepare: async () => {
    if (platform() === "darwin") {
      // Skip toute la suite sur macOS — voir warning plus haut.
      throw new Error("tauri-driver n'est pas supporté sur macOS. Skip via FAKT_E2E_SKIP_MACOS=1.");
    }
    const binPath = releaseBinaryPath();
    if (!existsSync(binPath)) {
      throw new Error(
        `Binaire release introuvable : ${binPath}. Lancer 'bun --cwd apps/desktop tauri:build' d'abord.`
      );
    }
    await spawnTauriDriver();
  },
  onComplete: () => {
    killTauriDriver();
  },
};
