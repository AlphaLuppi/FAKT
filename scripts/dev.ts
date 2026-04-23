#!/usr/bin/env bun
// @ts-nocheck
// Lance l'api-server Bun + Tauri dev en parallèle.
//
// Pourquoi pas `&` en shell : `bun run <script>` n'accepte pas les commandes
// background dans les scripts npm (erreur "Background commands & are not
// supported yet"). On utilise child_process.spawn pour contrôler les 2 process en TS.
//
// Pourquoi pas le binaire compilé du sidecar : `bun build --compile` bundle
// mal les modules natifs (better-sqlite3 → crash `bindings` au runtime). Pour
// le dev on lance donc l'api-server directement en `bun run` et on dit à Tauri
// de ne pas spawn le binaire via `FAKT_API_EXTERNAL=1`.
//
// Usage : bun run dev (depuis la racine monorepo)

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");

const token =
  process.env.FAKT_API_TOKEN ??
  `dev-token-${Date.now()}-${Math.random().toString(36).slice(2, 18).padEnd(16, "0")}`;
const port = process.env.FAKT_API_PORT ?? "3117";
const dbPath = process.env.FAKT_DB_PATH ?? resolve(homedir(), ".fakt", "db.sqlite");
const mode = process.env.FAKT_MODE ?? "1";

mkdirSync(dirname(dbPath), { recursive: true });

console.log(`[FAKT] api-server: port=${port} db=${dbPath}`);

// Variables déclarées en tête pour éviter la TDZ : si api-server crash
// immédiatement (ex : EADDRINUSE), son callback "exit" peut fire AVANT que
// `tauri` / `tauriExited` soient assignés plus bas. On init avec des valeurs
// neutres puis on les assigne après le spawn.
let api: ChildProcess | null = null;
let tauri: ChildProcess | null = null;
let apiExited = false;
let tauriExited = false;
let shuttingDown = false;

const killAll = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (api && !apiExited) {
    try {
      api.kill();
    } catch {}
  }
  if (tauri && !tauriExited) {
    try {
      tauri.kill();
    } catch {}
  }
};

const apiEnv: NodeJS.ProcessEnv = {
  ...process.env,
  FAKT_API_PORT: port,
  FAKT_API_TOKEN: token,
  FAKT_DB_PATH: dbPath,
  FAKT_MODE: mode,
};

api = spawn("bun", ["--cwd", "packages/api-server", "src/index.ts"], {
  cwd: repoRoot,
  env: apiEnv,
  stdio: "inherit",
  shell: platform() === "win32",
});

api.on("exit", (code, signal) => {
  apiExited = true;
  console.log(`[FAKT] api-server exited code=${code} signal=${signal}`);
  if (tauri && !tauriExited) {
    try {
      tauri.kill();
    } catch {}
  }
  // Si api crash avant que tauri soit lancé, on sort avec le code d'api.
  if (!tauri) {
    process.exit(code ?? 1);
  }
});

await new Promise((r) => setTimeout(r, 1000));

if (apiExited) {
  console.error("[FAKT] api-server a crashé au démarrage — abort.");
  process.exit(1);
}

console.log("[FAKT] Démarrage Tauri en mode FAKT_API_EXTERNAL=1...");

const tauriEnv: NodeJS.ProcessEnv = {
  ...process.env,
  FAKT_API_EXTERNAL: "1",
  FAKT_API_PORT: port,
  FAKT_API_TOKEN: token,
};

tauri = spawn("bun", ["run", "tauri", "dev"], {
  cwd: resolve(repoRoot, "apps/desktop"),
  env: tauriEnv,
  stdio: "inherit",
  shell: platform() === "win32",
});

tauri.on("exit", (code, signal) => {
  tauriExited = true;
  console.log(`[FAKT] tauri exited code=${code} signal=${signal}`);
  if (api && !apiExited) {
    try {
      api.kill();
    } catch {}
  }
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  console.log("[FAKT] SIGINT reçu, arrêt des process...");
  killAll();
});
process.on("SIGTERM", () => {
  console.log("[FAKT] SIGTERM reçu, arrêt des process...");
  killAll();
});
process.on("exit", killAll);
