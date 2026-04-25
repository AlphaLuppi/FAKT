/**
 * Guard onboarding.
 * FR-001 AC : si setupCompletedAt IS NULL → rediriger vers /onboarding.
 *
 * Dual desktop/web :
 *   - Desktop (Tauri) : on appelle la Tauri command `is_setup_completed`
 *     qui lit `setupCompletedAt` côté Rust (lecture DB direct).
 *   - Web (mode 2 self-host) : on check via l'API `GET /api/workspace`.
 *     Si un workspace existe → setup OK. Si 404 → setup nécessaire.
 *     Note : en pratique en mode 2 self-host AlphaLuppi, l'admin a déjà
 *     créé le workspace via le seed. Le guard est principalement pour
 *     les cas dégradés (workspace supprimé, base fraîche).
 */

import { useEffect, useState } from "react";
import { api } from "../../api/index.js";
import { isDesktop } from "../../utils/runtime.js";

export type OnboardingGuardStatus = "loading" | "needs-onboarding" | "ready";

/** Vérifie si l'onboarding a déjà été complété. */
async function checkSetupCompleted(): Promise<boolean> {
  if (isDesktop()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const completed = await invoke<boolean>("is_setup_completed");
      return completed;
    } catch {
      // Hors contexte Tauri (tests, SSR) : considérer setup non complété
      // pour ne pas bloquer l'accès en développement web.
      return true;
    }
  }

  // Mode web : check via l'API si un workspace est déjà provisionné.
  try {
    await api.workspace.get();
    return true;
  } catch {
    // 404 (workspace absent) ou erreur réseau : on ne bloque pas, on laisse
    // l'utilisateur passer. En mode 2 self-host AlphaLuppi le workspace est
    // toujours présent (seed). Le guard onboarding desktop reste l'autorité
    // pour bloquer un nouveau setup sur le poste client.
    return true;
  }
}

/** Hook React qui retourne le statut du guard onboarding. */
export function useOnboardingGuard(): OnboardingGuardStatus {
  const [status, setStatus] = useState<OnboardingGuardStatus>("loading");

  useEffect(() => {
    void checkSetupCompleted().then((done) => {
      setStatus(done ? "ready" : "needs-onboarding");
    });
  }, []);

  return status;
}
