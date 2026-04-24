import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

const host = process.env.TAURI_DEV_HOST;
// Permet d'override le port quand plusieurs worktrees Vite tournent en parallèle
// (ex: `FAKT_VITE_PORT=1426 bun run dev`). Défaut 1420 pour matcher tauri.conf.json.
const devPort = process.env.FAKT_VITE_PORT
  ? Number.parseInt(process.env.FAKT_VITE_PORT, 10)
  : 1420;

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    // Exposé pour le tab Télémétrie (TelemetryTab.tsx)
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  clearScreen: false,

  server: {
    port: devPort,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: "ws", host, port: devPort + 1 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  envPrefix: ["VITE_", "TAURI_ENV_*"],

  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
