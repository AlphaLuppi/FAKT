/**
 * @fakt/pdf — Wrapper TypeScript pour le rendu PDF.
 *
 * Architecture :
 *   - Les templates Typst vivent dans packages/pdf/templates/*.typ (compilés
 *     côté Rust via le crate `typst` embarqué).
 *   - Les DTOs métier (QuoteInput / InvoiceInput) sont transformés en contexte
 *     JSON via context-builder.ts, puis injectés dans Typst à compile time.
 *   - Le résultat est un Uint8Array PDF retourné à l'UI.
 *
 * IPC Tauri : la commande Rust `render_pdf` reçoit {docType, ctxJson} et
 * retourne Vec<u8>. Côté TS, on sérialise le contexte avec JSON.stringify
 * puis on appelle invoke(...).
 *
 * CONTRAT DE SWAPABILITÉ : les consommateurs doivent importer `renderPdf`
 * ou `renderQuotePdf`/`renderInvoicePdf` et NE PAS dépendre directement du
 * shape de PdfCtx — c'est un détail d'implémentation templating.
 */

import { invoke } from "@tauri-apps/api/core";

import {
  buildInvoiceContext,
  buildQuoteContext,
  type BuildInvoiceCtxArgs,
  type BuildQuoteCtxArgs,
  type InvoiceCtx,
  type PdfCtx,
  type QuoteCtx,
} from "./context-builder.ts";

// Public re-exports.
export {
  buildInvoiceContext,
  buildQuoteContext,
  formatQuantity,
  lineToItemCtx,
  workspaceToCtx,
  clientToCtx,
} from "./context-builder.ts";
export type {
  BuildInvoiceCtxArgs,
  BuildQuoteCtxArgs,
  ClientCtx,
  InvoiceCtx,
  ItemCtx,
  PdfCtx,
  QuoteCtx,
  WorkspaceCtx,
} from "./context-builder.ts";

// ─── Type de document ────────────────────────────────────────────────────────

export type DocType = "quote" | "invoice";

// ─── Appel IPC ───────────────────────────────────────────────────────────────

/**
 * Invoque la commande Tauri `render_pdf` avec un contexte JSON pré-sérialisé.
 * Retourne un Uint8Array — bytes bruts du PDF.
 *
 * En cas d'erreur Typst (template invalide, dépassement de mémoire, etc.),
 * la commande Rust remonte un String d'erreur qu'on propage tel quel.
 */
async function invokeRender(
  docType: DocType,
  ctxJson: string,
): Promise<Uint8Array> {
  const bytes = await invoke<number[]>("render_pdf", {
    docType,
    dataJson: ctxJson,
  });
  return new Uint8Array(bytes);
}

// ─── API publique : render à partir d'un contexte pré-construit ─────────────

/**
 * Rend un PDF à partir d'un contexte Typst déjà construit.
 * Préféré quand le contexte a été préparé ailleurs (ex: côté Rust ou worker).
 */
export async function renderPdf(ctx: PdfCtx): Promise<Uint8Array> {
  const json = JSON.stringify(ctx);
  return invokeRender(ctx.kind, json);
}

// ─── API publique : render directement depuis un DTO métier ──────────────────

/** Rend un devis en PDF à partir d'un QuoteInput + client + workspace. */
export async function renderQuotePdf(
  args: BuildQuoteCtxArgs,
): Promise<Uint8Array> {
  const ctx: QuoteCtx = buildQuoteContext(args);
  return renderPdf(ctx);
}

/** Rend une facture en PDF à partir d'un InvoiceInput + client + workspace. */
export async function renderInvoicePdf(
  args: BuildInvoiceCtxArgs,
): Promise<Uint8Array> {
  const ctx: InvoiceCtx = buildInvoiceContext(args);
  return renderPdf(ctx);
}
