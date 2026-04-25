/**
 * Couche HTTP auth pour mode 2 self-host (JWT cookie httpOnly + bearer fallback).
 * En mode 1 local sidecar, ces routes ne sont pas exposées — useAuth bypass cette couche.
 */

import { getApiClient } from "./client.js";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface UserWorkspaceMembership {
  workspaceId: string;
  role: "owner" | "admin" | "member";
}

export interface LoginResponse {
  user: AuthUser;
  workspaces: string[];
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  workspaces: string[];
}

export interface MeResponse {
  user: AuthUser;
  workspaces: UserWorkspaceMembership[];
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return getApiClient().post<LoginResponse>("/api/auth/login", { email, password });
  },

  async logout(refreshToken?: string): Promise<{ ok: boolean }> {
    return getApiClient().post<{ ok: boolean }>(
      "/api/auth/logout",
      refreshToken ? { refreshToken } : {}
    );
  },

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    return getApiClient().post<RefreshResponse>("/api/auth/refresh", { refreshToken });
  },

  async me(): Promise<MeResponse> {
    return getApiClient().get<MeResponse>("/api/auth/me");
  },
};
