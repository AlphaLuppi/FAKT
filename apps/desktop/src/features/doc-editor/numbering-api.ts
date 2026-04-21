/**
 * Bridge Numérotation séquentielle CGI art. 289.
 *
 * TODO Track D — Wave 2 : cette commande doit être remplacée par une Tauri
 * command Rust atomique (BEGIN IMMEDIATE SQLite) pour garantir zéro trou
 * en accès concurrent. Le stub TS actuel (packages/db/src/queries/numbering.ts)
 * est non-atomique mais acceptable en mode solo-local mono-user v0.1.
 */

import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";

export interface NumberingResult {
  year: number;
  sequence: number;
  formatted: string;
}

export interface NumberingApi {
  peekNextQuote(): Promise<NumberingResult>;
}

const tauriNumberingApi: NumberingApi = {
  async peekNextQuote(): Promise<NumberingResult> {
    return invoke<NumberingResult>(IPC_COMMANDS.PREVIEW_NEXT_NUMBER, {
      type: "quote",
    });
  },
};

let _impl: NumberingApi = tauriNumberingApi;

export const numberingApi: NumberingApi = {
  peekNextQuote: () => _impl.peekNextQuote(),
};

export function setNumberingApi(api: NumberingApi | null): void {
  _impl = api ?? tauriNumberingApi;
}
