import { create } from "zustand";

/**
 * Store Zustand pour le workspace courant.
 *
 * **North star multi-workspace** : ce store existe **dès le MVP** même si
 * en pratique il n'y a qu'un seul workspace AlphaLuppi. L'objectif est
 * de NE PAS refactoriser tout le frontend quand on passera à plusieurs
 * workspaces (holding + filiales, ou agence + entreprises persos par user).
 *
 * Hydratation : `useAuth.login()` réponse `{ workspaces[] }` populate
 * `setWorkspaces()`. Le `currentWorkspaceId` est aligné avec le store auth
 * (cf. `useAuthStore.currentWorkspaceId`) — ce store-ci permet la mutation
 * imperative depuis l'ApiClient (lecture du workspace pour le header
 * `X-FAKT-Workspace-Id`).
 *
 * Le composant `<WorkspaceSwitcher>` (topbar) lit ce store et affiche un
 * dropdown SI `workspaces.length > 1`. En MVP avec 1 workspace, il est
 * caché automatiquement.
 */

export interface WorkspaceSummary {
  id: string;
  name?: string;
  role: "owner" | "admin" | "member";
}

interface WorkspaceState {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string | null;
  setWorkspaces: (workspaces: WorkspaceSummary[]) => void;
  setCurrentWorkspaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  currentWorkspaceId: null,
  setWorkspaces: (workspaces) =>
    set((state) => ({
      workspaces,
      // Si pas de currentWorkspaceId ou que le current n'est plus dans la liste,
      // on prend le premier workspace de la liste.
      currentWorkspaceId:
        state.currentWorkspaceId && workspaces.some((w) => w.id === state.currentWorkspaceId)
          ? state.currentWorkspaceId
          : (workspaces[0]?.id ?? null),
    })),
  setCurrentWorkspaceId: (currentWorkspaceId) => set({ currentWorkspaceId }),
}));
