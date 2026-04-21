/**
 * Bridge Workspace — usable fallback en solo-local.
 */

import { invoke } from "@tauri-apps/api/core";
import { IPC_COMMANDS } from "@fakt/shared";
import type { Workspace } from "@fakt/shared";

export interface WorkspaceApi {
  get(): Promise<Workspace | null>;
}

const tauriWorkspaceApi: WorkspaceApi = {
  async get(): Promise<Workspace | null> {
    return invoke<Workspace | null>(IPC_COMMANDS.GET_WORKSPACE);
  },
};

let _impl: WorkspaceApi = tauriWorkspaceApi;

export const workspaceApi: WorkspaceApi = {
  get: () => _impl.get(),
};

export function setWorkspaceApi(api: WorkspaceApi | null): void {
  _impl = api ?? tauriWorkspaceApi;
}
