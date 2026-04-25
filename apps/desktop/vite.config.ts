import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

const host = process.env.TAURI_DEV_HOST;
// Permet d'override le port quand plusieurs worktrees Vite tournent en parallèle
// (ex: `FAKT_VITE_PORT=1426 bun run dev`). Défaut 1420 pour matcher tauri.conf.json.
const devPort = process.env.FAKT_VITE_PORT ? Number.parseInt(process.env.FAKT_VITE_PORT, 10) : 1420;

// Mode dual : "tauri" (default) → app desktop ; "web" → bundle web statique
// pour mode 2 self-host AlphaLuppi (servi par Caddy alpine).
const isWebTarget = process.env.FAKT_TARGET === "web";

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

  preview: {
    port: isWebTarget ? 4173 : devPort,
    strictPort: true,
  },

  envPrefix: ["VITE_", "TAURI_ENV_*", "FAKT_"],

  build: isWebTarget
    ? {
        outDir: "dist-web",
        target: "es2020",
        minify: "esbuild",
        sourcemap: false,
        cssCodeSplit: true,
        chunkSizeWarningLimit: 800,
        rollupOptions: {
          output: {
            // Manual chunks volontairement minimaux : on isole uniquement les
            // gros vendors qu'on veut pouvoir cacher long terme. Le reste est
            // automatique pour éviter les chunks circulaires.
            manualChunks: (id: string): string | undefined => {
              if (!id.includes("node_modules")) return undefined;
              if (id.includes("/pdfjs-dist/")) return "vendor-pdfjs";
              if (id.includes("/@tanstack/")) return "vendor-tanstack";
              if (
                id.includes("/react-markdown/") ||
                id.includes("/rehype-") ||
                id.includes("/remark-") ||
                id.includes("/highlight.js/") ||
                id.includes("/mammoth/")
              ) {
                return "vendor-markdown";
              }
              return undefined;
            },
          },
        },
      }
    : {
        target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
        minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
        sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
      },
});
