/**
 * Helpers pour le calcul + persistance du hash texte du PDF officiel d'un
 * devis émis. Utilisé par le workflow « Importer signature client ».
 *
 * Flux :
 *   1. Le devis vient d'être émis (status `sent`).
 *   2. On rend le PDF officiel (sans signature visuelle).
 *   3. On invoke la commande Rust `compute_pdf_text_hash` qui extrait le
 *      texte via pdf-extract, normalise (whitespace, line endings) et
 *      retourne SHA-256 hex.
 *   4. On POST sur `quotes/:id/original-text-hash` pour persister.
 *
 * Best-effort : un échec ici ne doit PAS bloquer l'émission du devis.
 * On log l'erreur (console) et on retourne. L'utilisateur pourra toujours
 * signer manuellement, simplement le workflow d'import retour signé sera
 * indisponible pour ce devis spécifique.
 */

import type { ClientInput, QuoteInput, WorkspaceInput } from "@fakt/core";
import { invoke } from "@tauri-apps/api/core";
import { isWeb } from "../../utils/runtime.js";
import { pdfApi } from "./pdf-api.js";
import { quotesApi } from "./quotes-api.js";

export interface PersistOriginalTextHashArgs {
  quote: QuoteInput;
  client: ClientInput;
  workspace: WorkspaceInput;
}

/**
 * Calcule le SHA-256 du texte normalisé du PDF officiel et le persiste sur
 * le devis. Best-effort — log + ignore si échec.
 *
 * **Skippé en mode web** : la commande `compute_pdf_text_hash` n'est pas
 * disponible côté serveur (pas de pdf-extract dans le sidecar Bun pour le
 * moment). En mode web, l'import retour signé sera indisponible jusqu'à
 * ce qu'un endpoint serveur équivalent soit ajouté.
 */
export async function persistQuoteOriginalTextHash(
  args: PersistOriginalTextHashArgs
): Promise<void> {
  if (isWeb()) return; // mode web pas encore supporté

  try {
    const pdfBytes = await pdfApi.renderQuote({
      quote: args.quote,
      client: args.client,
      workspace: args.workspace,
    });
    const hash = await invoke<string>("compute_pdf_text_hash", {
      pdfBytes: Array.from(pdfBytes),
    });
    await quotesApi.setOriginalTextHash(args.quote.id, hash);
  } catch (err) {
    // Best-effort : on log mais on ne propage pas. Le workflow signature
    // classique (par l'émetteur) reste fonctionnel sans ce hash.
    // eslint-disable-next-line no-console
    console.warn("[quote-text-hash] persistance hash échouée :", err);
  }
}
