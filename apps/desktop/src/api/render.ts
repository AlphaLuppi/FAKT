/**
 * Bridge HTTP pour le rendu PDF en mode web.
 *
 * Le contrat correspond à la commande Tauri `render_pdf` :
 *   - input  : `{ docType: "quote" | "invoice" | "audit-trail", dataJson: string }`
 *   - output : `Uint8Array` (bytes PDF)
 *
 * Côté serveur : `POST /api/render/pdf` shell-out vers Typst CLI
 * (cf. `packages/api-server/src/routes/render.ts`). Auth requise.
 */

import { getApiClient } from "./client.js";

export interface RenderPdfInput {
  docType: "quote" | "invoice" | "audit-trail";
  dataJson: string;
}

export const renderApi = {
  async pdf(input: RenderPdfInput): Promise<Uint8Array> {
    return getApiClient().postBinary("/api/render/pdf", input);
  },
};
