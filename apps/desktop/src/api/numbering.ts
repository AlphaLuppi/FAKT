import { getApiClient } from "./client.js";

export type NumberingType = "quote" | "invoice";

export interface NumberingResult {
  year: number;
  sequence: number;
  formatted: string;
}

export const numberingApi = {
  async peek(type: NumberingType): Promise<NumberingResult> {
    return getApiClient().get<NumberingResult>("/api/numbering/peek", { type });
  },
  async next(type: NumberingType): Promise<NumberingResult> {
    return getApiClient().post<NumberingResult>("/api/numbering/next", { type });
  },
};
