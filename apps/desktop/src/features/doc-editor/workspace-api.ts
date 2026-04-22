/**
 * Bridge Workspace — lecture via sidecar Bun+Hono.
 * `get` renvoie `null` si le workspace n'est pas initialisé (404).
 */

import type { Workspace } from "@fakt/shared";
import { api as httpApi } from "../../api/index.js";
import { ApiError } from "../../api/client.js";

export interface WorkspaceApi {
  get(): Promise<Workspace | null>;
}

const httpWorkspaceApi: WorkspaceApi = {
  async get(): Promise<Workspace | null> {
    try {
      return await httpApi.workspace.get();
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },
};

let _impl: WorkspaceApi = httpWorkspaceApi;

export const workspaceApi: WorkspaceApi = {
  get: () => _impl.get(),
};

export function setWorkspaceApi(api: WorkspaceApi | null): void {
  _impl = api ?? httpWorkspaceApi;
}
