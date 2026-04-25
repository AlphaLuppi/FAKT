import { useCallback, useEffect } from "react";
import { authApi } from "../api/auth.js";
import { ApiError, getApiClient } from "../api/client.js";
import { useAuthStore } from "../stores/useAuthStore.js";
import { useWorkspaceStore } from "../stores/useWorkspaceStore.js";

/**
 * Hook React pour l'authentification mode 2 self-host (JWT).
 *
 * Comportement :
 *   - Mode local : bypass complet, status="local" (pas de login en mode 1 sidecar).
 *   - Mode remote au mount : appel /api/auth/me — si 200 → authenticated, si 401 → anonymous.
 *   - Login : POST /api/auth/login → store + injection JWT dans ApiClient.
 *   - Logout : POST /api/auth/logout → flush store + clear JWT.
 *   - Refresh : déclenché soit par interval 5min, soit par event 'fakt:auth-expired' (401).
 */

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const workspaces = useAuthStore((s) => s.workspaces);
  const currentWorkspaceId = useAuthStore((s) => s.currentWorkspaceId);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setLocal = useAuthStore((s) => s.setLocal);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setAnonymous = useAuthStore((s) => s.setAnonymous);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  /** Login email + password. Returns user + workspaces. */
  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password);
      const client = getApiClient();
      client.setJwtBearer(response.accessToken);
      const wsId = response.workspaces[0] ?? null;
      if (wsId) client.setWorkspaceId(wsId);
      // Convertit string[] en UserWorkspaceMembership[] (rôle inconnu en login response)
      setAuthenticated({
        user: response.user,
        workspaces: response.workspaces.map((id) => ({
          workspaceId: id,
          role: "member" as const,
        })),
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      // Récupère les rôles précis via /me et hydrate useWorkspaceStore
      try {
        const me = await authApi.me();
        useAuthStore.setState({ workspaces: me.workspaces });
        useWorkspaceStore.getState().setWorkspaces(
          me.workspaces.map((w) => ({ id: w.workspaceId, role: w.role }))
        );
      } catch {
        // pas critique
      }
      return response;
    },
    [setAuthenticated]
  );

  /** Logout : révoque le refresh token côté serveur + clear store. */
  const logout = useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      await authApi.logout(refreshToken ?? undefined);
    } catch {
      // logout doit toujours réussir côté client
    }
    const client = getApiClient();
    client.setJwtBearer(null);
    client.setWorkspaceId(null);
    setAnonymous();
  }, [setAnonymous]);

  /** Refresh access token avec le refresh token stocké. */
  const refresh = useCallback(async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      setAnonymous();
      return null;
    }
    try {
      const response = await authApi.refresh(refreshToken);
      const client = getApiClient();
      client.setJwtBearer(response.accessToken);
      setAccessToken(response.accessToken);
      return response;
    } catch {
      setAnonymous();
      return null;
    }
  }, [setAccessToken, setAnonymous]);

  /** Au mount : restore session (mode remote uniquement). */
  useEffect(() => {
    const client = getApiClient();
    if (client.mode === "local") {
      setLocal();
      return;
    }
    setLoading();
    authApi
      .me()
      .then((me) => {
        // /me a réussi → on est déjà authentifié via cookie httpOnly
        useAuthStore.setState({
          status: "authenticated",
          user: me.user,
          workspaces: me.workspaces,
          currentWorkspaceId: me.workspaces[0]?.workspaceId ?? null,
        });
        useWorkspaceStore.getState().setWorkspaces(
          me.workspaces.map((w) => ({ id: w.workspaceId, role: w.role }))
        );
        if (me.workspaces[0]) {
          client.setWorkspaceId(me.workspaces[0].workspaceId);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setAnonymous();
        } else {
          setAnonymous();
        }
      });
  }, [setLoading, setLocal, setAnonymous]);

  /** Listener 'fakt:auth-expired' dispatch par ApiClient sur 401. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      // Tente un refresh une fois. Si KO → anonymous (redirect /login via RequireAuth).
      void refresh();
    };
    window.addEventListener("fakt:auth-expired", handler);
    return () => window.removeEventListener("fakt:auth-expired", handler);
  }, [refresh]);

  return {
    status,
    user,
    workspaces,
    currentWorkspaceId,
    login,
    logout,
    refresh,
  };
}
