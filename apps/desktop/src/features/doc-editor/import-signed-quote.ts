/**
 * Workflow « Importer signature client » — orchestrateur frontend.
 *
 * 1. Le client renvoie un PDF signé (à la main + scan, ou via Adobe/DocuSign).
 * 2. L'utilisateur sélectionne le PDF + saisit l'email/nom du signataire.
 * 3. Cet helper :
 *    a) Calcule le SHA-256 du texte normalisé du PDF importé (Rust).
 *    b) Compare au hash stocké à l'émission (`quote.originalTextHash`).
 *    c) Si mismatch et `force=false` → retourne `{ kind: "mismatch", … }`.
 *    d) Sinon : stocke le PDF, calcule `previousEventHash` via Rust,
 *       construit le signature event, l'appende au sidecar, log l'activity,
 *       et bascule le devis en `signed`.
 *
 * Toute la logique cryptographique (chain hash + extraction texte) reste
 * côté Rust pour éviter la divergence de format entre langues.
 */

import type { SignatureEvent, UUID } from "@fakt/shared";
import { invoke } from "@tauri-apps/api/core";
import { activityApi } from "../../api/activity.js";
import { quotesApi } from "./quotes-api.js";
import { signatureApi } from "./signature-api.js";

export interface VerifyPdfHashArgs {
  pdfBytes: Uint8Array;
  expectedHash: string;
}

export type VerifyPdfHashResult =
  | { kind: "match"; actualHash: string }
  | { kind: "mismatch"; actualHash: string };

/**
 * Compare le hash texte d'un PDF importé au hash attendu.
 * Pure : aucun side-effect (pas de DB, pas de stockage). Le résultat dit
 * juste si le contenu textuel correspond.
 */
export async function verifyImportedPdfHash(args: VerifyPdfHashArgs): Promise<VerifyPdfHashResult> {
  const actualHash = await invoke<string>("compute_pdf_text_hash", {
    pdfBytes: Array.from(args.pdfBytes),
  });
  return actualHash === args.expectedHash
    ? { kind: "match", actualHash }
    : { kind: "mismatch", actualHash };
}

export interface CommitImportSignedQuoteArgs {
  quoteId: UUID;
  pdfBytes: Uint8Array;
  signerName: string;
  signerEmail: string;
  expectedHash: string;
  actualHash: string;
}

export interface CommitImportSignedQuoteResult {
  signatureEvent: SignatureEvent;
  signaturePath: string;
}

function genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Finalise l'import : stocke PDF, append signature event chaîné, log
 * activity, transition `sent → signed`.
 *
 * Précondition : l'utilisateur a confirmé (soit hash match, soit explicit
 * force après avertissement). Cette fonction ne décide pas du mismatch ;
 * elle attend les deux hashes en argument et les consigne tels quels dans
 * l'audit event (`docHashBefore=expected`, `docHashAfter=actual`).
 *
 * Idempotence : pas garantie. Un double-call appendrait deux events. La
 * UI doit donc disable le bouton submit pendant l'await.
 */
export async function commitImportSignedQuote(
  args: CommitImportSignedQuoteArgs
): Promise<CommitImportSignedQuoteResult> {
  // 1. Stocke le PDF retourné dans signed_pdfs/quote/<id>.pdf
  const signaturePath = await signatureApi.storeSignedPdf("quote", args.quoteId, args.pdfBytes);

  // 2. Récupère la chaîne actuelle pour calculer previousEventHash
  const chain = await signatureApi.listEvents("quote", args.quoteId);
  const previous = chain.length > 0 ? chain[chain.length - 1] : null;
  const previousEventHash =
    previous !== null && previous !== undefined
      ? await invoke<string>("compute_signature_event_self_hash", { event: previous })
      : null;

  // 3. Construit le nouvel event et l'append
  const event: SignatureEvent = {
    id: genUuid(),
    documentType: "quote",
    documentId: args.quoteId,
    signerName: args.signerName,
    signerEmail: args.signerEmail,
    ipAddress: null,
    userAgent: null,
    timestamp: Date.now(),
    docHashBefore: args.expectedHash,
    docHashAfter: args.actualHash,
    signaturePngBase64: "", // import retour : pas de PNG signature côté FAKT
    previousEventHash,
    tsaResponse: null,
    tsaProvider: null,
  };
  await signatureApi.appendEvent(event);

  // 4. Activity log (audit timeline lisible côté UI)
  await activityApi.append({
    type: "quote_signed_by_client_imported",
    entityType: "quote",
    entityId: args.quoteId,
    payload: JSON.stringify({
      signerName: args.signerName,
      signerEmail: args.signerEmail,
      hashMatched: args.expectedHash === args.actualHash,
    }),
  });

  // 5. Transition status sent → signed
  await quotesApi.updateStatus(args.quoteId, "signed");

  return { signatureEvent: event, signaturePath };
}
