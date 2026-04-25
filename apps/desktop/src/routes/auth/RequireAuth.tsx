import type { ReactElement, ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuthStore } from "../../stores/useAuthStore.js";

/**
 * Wrapper qui exige que l'user soit authentifié pour accéder aux children.
 *
 * Comportement :
 *   - status="local"          → bypass (mode 1 sidecar, pas d'auth requise)
 *   - status="loading"        → écran de chargement
 *   - status="authenticated"  → render children
 *   - status="anonymous"      → redirect /login en gardant `from` pour retour post-login
 */
export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "local" || status === "authenticated") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <LoadingScreen />;
  }

  // anonymous → redirect /login
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function LoadingScreen(): ReactElement {
  return (
    <div
      data-testid="auth-loading"
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 800,
          fontSize: "var(--t-xl)",
          textTransform: "uppercase",
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        FAKT
      </div>
    </div>
  );
}
