/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FAKT_API_URL?: string;
  readonly VITE_FAKT_API_TOKEN?: string;
  readonly VITE_FAKT_DEFAULT_MODE?: "local" | "remote";
  readonly VITE_FAKT_DEFAULT_BACKEND_URL?: string;
  readonly FAKT_TARGET?: "web" | "tauri";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
