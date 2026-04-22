#!/usr/bin/env bash
# Lance l'api-server Bun + Tauri dev en parallèle.
#
# Pourquoi pas le binaire compilé du sidecar : `bun build --compile` bundle
# mal les modules natifs (better-sqlite3 → crash `bindings` au runtime). Pour
# le dev on lance donc l'api-server directement en `bun run` et on dit à Tauri
# de ne pas spawn le binaire via `FAKT_API_EXTERNAL=1`.
#
# Usage : bun run dev (depuis la racine monorepo)

set -e

cd "$(dirname "$0")/.."

# Token & port partagés entre sidecar et Tauri.
FAKT_API_TOKEN="${FAKT_API_TOKEN:-dev-token-$(date +%s)-abcdef0123456789}"
FAKT_API_PORT="${FAKT_API_PORT:-3117}"
FAKT_DB_PATH="${FAKT_DB_PATH:-$HOME/.fakt/db.sqlite}"

mkdir -p "$(dirname "$FAKT_DB_PATH")"

echo "[FAKT] api-server: port=$FAKT_API_PORT db=$FAKT_DB_PATH"

# Lance l'api-server Bun en arrière-plan.
FAKT_API_PORT="$FAKT_API_PORT" \
FAKT_API_TOKEN="$FAKT_API_TOKEN" \
FAKT_DB_PATH="$FAKT_DB_PATH" \
FAKT_MODE="${FAKT_MODE:-1}" \
  bun --cwd packages/api-server src/index.ts &

API_PID=$!

# Tue le sidecar quand le script sort (Ctrl+C, exit normal, etc.).
cleanup() {
  if kill -0 "$API_PID" 2>/dev/null; then
    echo "[FAKT] arrêt api-server (pid $API_PID)"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Attend qu'au moins le port soit bind (simple sleep, l'app-server log ready en <1s).
sleep 1

echo "[FAKT] Démarrage Tauri en mode FAKT_API_EXTERNAL=1..."
cd apps/desktop
FAKT_API_EXTERNAL=1 \
FAKT_API_PORT="$FAKT_API_PORT" \
FAKT_API_TOKEN="$FAKT_API_TOKEN" \
  bun run tauri dev
