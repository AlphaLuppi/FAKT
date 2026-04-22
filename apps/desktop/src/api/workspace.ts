import type { LegalForm, Workspace } from "@fakt/shared";
import { getApiClient } from "./client.js";

export interface CreateWorkspaceInput {
  id?: string;
  name: string;
  legalForm: LegalForm;
  siret: string;
  address: string;
  email: string;
  iban?: string | null;
  tvaMention?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  legalForm?: LegalForm;
  siret?: string;
  address?: string;
  email?: string;
  iban?: string | null;
  tvaMention?: string;
}

export const workspaceApi = {
  async get(): Promise<Workspace> {
    return getApiClient().get<Workspace>("/api/workspace");
  },
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    return getApiClient().post<Workspace>("/api/workspace", input);
  },
  async update(input: UpdateWorkspaceInput): Promise<Workspace> {
    return getApiClient().patch<Workspace>("/api/workspace", input);
  },
};
