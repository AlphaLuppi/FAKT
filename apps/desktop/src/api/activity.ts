import { getApiClient } from "./client.js";

export type ActivityEntityType = "quote" | "invoice" | "client" | "service" | "workspace";

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  payload: string | null;
  createdAt: number;
}

export interface ListActivityInput {
  entityType?: string;
  entityId?: string;
  type?: string;
  since?: number;
  limit?: number;
  offset?: number;
}

export interface AppendActivityInput {
  /** Optionnel : sera généré côté frontend si absent (UUID v4). */
  id?: string;
  type: string;
  entityType?: ActivityEntityType | null;
  entityId?: string | null;
  payload?: string | null;
}

interface ListResponse<T> {
  items: T[];
  pagination?: { limit: number; offset: number; count: number };
}

function genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 (non-cryptographique — acceptable pour identifier client-side).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const activityApi = {
  async list(input: ListActivityInput = {}): Promise<ActivityEvent[]> {
    const res = await getApiClient().get<ListResponse<ActivityEvent>>("/api/activity", {
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.since !== undefined ? { since: input.since } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.offset !== undefined ? { offset: input.offset } : {}),
    });
    return res.items;
  },
  async append(input: AppendActivityInput): Promise<ActivityEvent> {
    const body = {
      id: input.id ?? genUuid(),
      type: input.type,
      ...(input.entityType !== undefined ? { entityType: input.entityType } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    };
    return getApiClient().post<ActivityEvent>("/api/activity", body);
  },
};
