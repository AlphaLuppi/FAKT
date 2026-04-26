/**
 * @fakt/pdf — Wrapper TypeScript pour le rendu PDF.
 *
 * Architecture :
 *   - Les templates Typst vivent dans packages/pdf/templates/*.typ.
 *   - Les DTOs métier (QuoteInput / InvoiceInput) sont transformés en contexte
 *     JSON via context-builder.ts, puis injectés dans Typst à compile time.
 *   - Le résultat est un Uint8Array PDF retourné à l'UI.
 *
 * **Dual desktop/web** :
 *   - Sur Tauri (mode 1 sidecar et mode 2 client desktop), on `invoke("render_pdf")`
 *     vers la commande Rust qui shell-out vers Typst CLI local.
 *   - Sur le navigateur (mode 2 web AlphaLuppi), on appelle `POST /api/render/pdf`
 *     côté serveur (Typst CLI dans le Dockerfile).
 *
 * La stratégie est swappable via `setRenderStrategy()`. Le default est l'invoke
 * Tauri (lazy import pour ne pas bundler `@tauri-apps/api` dans le build web).
 *
 * CONTRAT : les consommateurs importent `renderPdf` ou `renderQuotePdf` /
 * `renderInvoicePdf` et NE PAS dépendre du shape de PdfCtx (détail templating).
 */

import {
  type BuildInvoiceCtxArgs,
  type BuildQuoteCtxArgs,
  type InvoiceCtx,
  type PdfCtx,
  type QuoteCtx,
  buildInvoiceContext,
  buildQuoteContext,
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

// ─── Strategy pattern ────────────────────────────────────────────────────────

/**
 * Options additionnelles passées au moteur de rendu.
 * `signaturePng` : bytes PNG d'une signature visuelle. Le moteur Rust les
 * écrit comme `signature.png` dans le tempdir de compilation Typst, où le
 * template les charge via `image("signature.png")`.
 */
export interface RenderOptions {
  signaturePng?: Uint8Array | null;
}

/**
 * Stratégie de rendu : prend (docType, dataJson, options) → bytes du PDF.
 * Le default fait un dynamic import de `@tauri-apps/api/core` pour invoquer
 * la commande Rust. En mode web, l'application doit appeler
 * `setRenderStrategy(httpStrategy)` au boot pour rediriger vers
 * `POST /api/render/pdf` côté serveur.
 */
export type RenderStrategy = (
  docType: DocType,
  dataJson: string,
  options?: RenderOptions,
) => Promise<Uint8Array>;

/**
 * Stratégie par défaut : `invoke("render_pdf")` Tauri.
 * Le `import` est dynamique pour qu'un build web sans Tauri ne pull pas le SDK.
 */
async function defaultStrategy(
  docType: DocType,
  dataJson: string,
  options?: RenderOptions,
): Promise<Uint8Array> {
  const { invoke } = await import("@tauri-apps/api/core");
  const signaturePng = options?.signaturePng ?? null;
  const bytes = await invoke<number[]>("render_pdf", {
    docType,
    dataJson,
    signaturePng:
      signaturePng && signaturePng.byteLength > 0 ? Array.from(signaturePng) : null,
  });
  return new Uint8Array(bytes);
}

let _strategy: RenderStrategy = defaultStrategy;

/**
 * Substitue la stratégie globale de rendu PDF.
 * - Passe `null` pour restaurer la stratégie par défaut (invoke Tauri).
 * - À appeler une fois au boot de l'application (ex: en mode web,
 *   pointer vers `POST /api/render/pdf`).
 */
export function setRenderStrategy(strategy: RenderStrategy | null): void {
  _strategy = strategy ?? defaultStrategy;
}

async function invokeRender(
  docType: DocType,
  ctxJson: string,
  options?: RenderOptions,
): Promise<Uint8Array> {
  return _strategy(docType, ctxJson, options);
}

// ─── API publique : render à partir d'un contexte pré-construit ─────────────

/**
 * Rend un PDF à partir d'un contexte Typst déjà construit.
 * Préféré quand le contexte a été préparé ailleurs (ex: côté Rust ou worker).
 */
export async function renderPdf(ctx: PdfCtx, options?: RenderOptions): Promise<Uint8Array> {
  const json = JSON.stringify(ctx);
  return invokeRender(ctx.kind, json, options);
}

// ─── API publique : render directement depuis un DTO métier ──────────────────

/** Rend un devis en PDF à partir d'un QuoteInput + client + workspace. */
export async function renderQuotePdf(args: BuildQuoteCtxArgs): Promise<Uint8Array> {
  const ctx: QuoteCtx = buildQuoteContext(args);
  return renderPdf(ctx, { signaturePng: args.signaturePng ?? null });
}

/** Rend une facture en PDF à partir d'un InvoiceInput + client + workspace. */
export async function renderInvoicePdf(args: BuildInvoiceCtxArgs): Promise<Uint8Array> {
  const ctx: InvoiceCtx = buildInvoiceContext(args);
  return renderPdf(ctx);
}
