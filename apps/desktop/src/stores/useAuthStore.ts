import { create } from "zustand";
import type { AuthUser, UserWorkspaceMembership } from "../api/auth.js";

/**
 * Store Zustand pour l'état d'auth (mode 2 self-host).
 *
 * En mode 1 local sidecar, le statut est toujours `local` (bypass) et on ne touche pas
 * à `user` / `workspaces` (le sidecar a un seul workspace via API workspace.get).
 *
 * En mode 2, le store est la source de vérité côté client pour :
 *   - user courant (id, email, nom)
 *   - workspaces accessibles (n:n via user_workspaces table)
 *   - currentWorkspaceId (futur multi-workspace UI)
 *   - status loading / authenticated / anonymous
 *
 * North star multi-workspace : `currentWorkspaceId` existe dès le MVP même si une seule
 * value (pour ne pas refacto plus tard quand on ajoutera le `<WorkspaceSwitcher>`).
 */

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "local";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  workspaces: UserWorkspaceMembership[];
  currentWorkspaceId: string | null;
  /** JWT bearer en mémoire (mode 2). Cookie httpOnly est l'autorité primaire. */
  accessToken: string | null;
  /** Refresh token persisté dans Tauri Store / sessionStorage. */
  refreshToken: string | null;

  // Actions
  setLoading: () => void;
  setLocal: () => void;
  setAuthenticated: (params: {
    user: AuthUser;
    workspaces: UserWorkspaceMembership[];
    accessToken: string;
    refreshToken: string;
  }) => void;
  setAnonymous: () => void;
  setCurrentWorkspaceId: (id: string | null) => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  workspaces: [],
  currentWorkspaceId: null,
  accessToken: null,
  refreshToken: null,

  setLoading: () => set({ status: "loading" }),

  setLocal: () =>
    set({
      status: "local",
      user: null,
      workspaces: [],
      currentWorkspaceId: null,
      accessToken: null,
      refreshToken: null,
    }),

  setAuthenticated: ({ user, workspaces, accessToken, refreshToken }) =>
    set({
      status: "authenticated",
      user,
      workspaces,
      currentWorkspaceId: workspaces[0]?.workspaceId ?? null,
      accessToken,
      refreshToken,
    }),

  setAnonymous: () =>
    set({
      status: "anonymous",
      user: null,
      workspaces: [],
      currentWorkspaceId: null,
      accessToken: null,
      refreshToken: null,
    }),

  setCurrentWorkspaceId: (currentWorkspaceId) => set({ currentWorkspaceId }),

  setAccessToken: (accessToken) => set({ accessToken }),
}));
