#!/usr/bin/env bash
# Lance Vite HMR + tauri dev en parallèle.
# Usage : bun run dev (depuis la racine monorepo)
set -e

cd "$(dirname "$0")/.."

echo "[FAKT] Démarrage en mode développement..."
cd apps/desktop
bun run tauri:dev
