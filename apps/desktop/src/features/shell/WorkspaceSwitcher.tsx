import type { ReactElement } from "react";
import { useWorkspaceStore } from "../../stores/useWorkspaceStore.js";

/**
 * Switcher de workspace dans la topbar.
 *
 * **Comportement MVP (1 workspace AlphaLuppi) :** retourne `null` — le composant
 * disparaît visuellement. Aucune impact UX.
 *
 * **Comportement multi-workspace (futur) :** dropdown brutaliste qui liste les
 * workspaces accessibles par le user. Au switch, met à jour le store, ce qui
 * déclenche le re-fetch des données via TanStack Query (les queries dépendent
 * de `currentWorkspaceId`).
 *
 * Cas d'usage anticipés :
 *   - Holding AlphaLuppi + filiales (chaque filiale = workspace)
 *   - Agence partagée + entreprise perso de chaque user
 *
 * North star : ce composant est posé dès le MVP pour éviter de refactoriser la
 * topbar plus tard. Le coût en MVP est nul (caché si 1 workspace).
 */
export function WorkspaceSwitcher(): ReactElement | null {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);

  // Caché si 1 workspace ou moins
  if (workspaces.length <= 1) return null;

  const current = workspaces.find((w) => w.id === currentWorkspaceId);
  const displayName = current?.name ?? current?.id ?? "Workspace";

  return (
    <div style={{ position: "relative" }}>
      <select
        value={currentWorkspaceId ?? ""}
        onChange={(e) => setCurrentWorkspaceId(e.target.value || null)}
        aria-label="Workspace courant"
        style={{
          appearance: "none",
          padding: "6px 28px 6px 12px",
          border: "2px solid var(--ink)",
          background: "var(--accent)",
          color: "var(--ink)",
          font: "var(--w-bold) var(--t-sm)/1 var(--font-ui)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          cursor: "pointer",
          boxShadow: "3px 3px 0 var(--ink)",
        }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name ?? w.id} ({w.role})
          </option>
        ))}
      </select>
      <span
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          font: "700 var(--t-xs) var(--font-ui)",
          color: "var(--ink)",
        }}
        aria-hidden
      >
        ▼
      </span>
      <span className="sr-only">{displayName}</span>
    </div>
  );
}
