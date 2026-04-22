import { getApiClient } from "./client.js";

export interface SettingEntry {
  key: string;
  value: string;
}

interface SettingsResponse {
  settings: SettingEntry[];
}

export const settingsApi = {
  async list(): Promise<SettingEntry[]> {
    const res = await getApiClient().get<SettingsResponse>("/api/settings");
    return res.settings;
  },
  async get(key: string): Promise<SettingEntry> {
    return getApiClient().get<SettingEntry>(`/api/settings/${encodeURIComponent(key)}`);
  },
  async set(key: string, value: string): Promise<SettingEntry> {
    return getApiClient().put<SettingEntry>(`/api/settings/${encodeURIComponent(key)}`, { value });
  },
};
