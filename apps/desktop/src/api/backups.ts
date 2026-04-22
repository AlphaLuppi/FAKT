import { getApiClient } from "./client.js";

export interface BackupRecord {
  id: string;
  path: string;
  sizeBytes: number;
  createdAt: number;
}

export interface ListBackupsInput {
  limit?: number;
  offset?: number;
}

export interface InsertBackupInput {
  id: string;
  path: string;
  sizeBytes: number;
}

interface ListResponse<T> {
  items: T[];
  pagination?: { limit: number; offset: number; count: number };
}

export const backupsApi = {
  async list(input: ListBackupsInput = {}): Promise<BackupRecord[]> {
    const res = await getApiClient().get<ListResponse<BackupRecord>>("/api/backups", {
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
    return res.items;
  },
  async create(input: InsertBackupInput): Promise<BackupRecord> {
    return getApiClient().post<BackupRecord>("/api/backups", input);
  },
  async delete(id: string): Promise<void> {
    await getApiClient().delete<void>(`/api/backups/${id}`);
  },
};
