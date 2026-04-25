/**
 * Bootstrap de la stratégie de rendu PDF selon le runtime.
 *
 * - Desktop (Tauri) : la stratégie par défaut de `@fakt/pdf` invoque la
 *   commande Rust `render_pdf` qui shell-out vers Typst CLI local.
 * - Web (navigateur) : on substitue par un appel `POST /api/render/pdf` qui
 *   shell-out vers Typst CLI côté serveur (cf. Dockerfile).
 *
 * À importer depuis `main.tsx` AVANT `createRoot().render()` pour qu'aucune
 * UI ne tente d'invoquer la commande Tauri en mode web.
 */

import { setRenderStrategy } from "@fakt/pdf";
import { renderApi } from "../api/render.js";
import { isWeb } from "./runtime.js";

let _initialized = false;

export function bootstrapRenderStrategy(): void {
  if (_initialized) return;
  _initialized = true;

  if (isWeb()) {
    setRenderStrategy(async (docType, dataJson) => {
      return renderApi.pdf({ docType, dataJson });
    });
  }
  // Sur desktop, on garde la stratégie par défaut (invoke Tauri).
}
