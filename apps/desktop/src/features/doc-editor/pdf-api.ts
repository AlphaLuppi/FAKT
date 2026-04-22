/**
 * Bridge PDF — utilise @fakt/pdf renderQuotePdf / renderInvoicePdf et la
 * save dialog Tauri.
 */

import type { ClientInput, InvoiceInput, QuoteInput, WorkspaceInput } from "@fakt/core";
import { renderInvoicePdf, renderQuotePdf } from "@fakt/pdf";
import { invoke } from "@tauri-apps/api/core";

export interface RenderQuoteArgs {
  quote: QuoteInput;
  client: ClientInput;
  workspace: WorkspaceInput;
}

export interface RenderInvoiceArgs {
  invoice: InvoiceInput;
  client: ClientInput;
  workspace: WorkspaceInput;
  quoteReference?: string | null;
  executionAt?: number | null;
}

export interface PdfApi {
  renderQuote(args: RenderQuoteArgs): Promise<Uint8Array>;
  renderInvoice(args: RenderInvoiceArgs): Promise<Uint8Array>;
  saveDialog(suggestedName: string): Promise<string | null>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
}

const tauriPdfApi: PdfApi = {
  async renderQuote(args): Promise<Uint8Array> {
    return renderQuotePdf(args);
  },
  async renderInvoice(args): Promise<Uint8Array> {
    return renderInvoicePdf(args);
  },
  async saveDialog(suggestedName): Promise<string | null> {
    // Le plugin-dialog Tauri expose la command plugin:dialog|save.
    // On utilise la forme invoke générique pour éviter une dep plugin-dialog.
    try {
      const path = await invoke<string | null>("plugin:dialog|save", {
        options: {
          defaultPath: suggestedName,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        },
      });
      return path ?? null;
    } catch {
      return null;
    }
  },
  async writeFile(path, bytes): Promise<void> {
    await invoke<void>("plugin:fs|write_file", {
      path,
      contents: Array.from(bytes),
    });
  },
};

let _impl: PdfApi = tauriPdfApi;

export const pdfApi: PdfApi = {
  renderQuote: (args) => _impl.renderQuote(args),
  renderInvoice: (args) => _impl.renderInvoice(args),
  saveDialog: (name) => _impl.saveDialog(name),
  writeFile: (path, bytes) => _impl.writeFile(path, bytes),
};

export function setPdfApi(api: PdfApi | null): void {
  _impl = api ?? tauriPdfApi;
}
