/**
 * Guard onboarding.
 * FR-001 AC : si setupCompletedAt IS NULL → rediriger vers /onboarding.
 * En pratique (v0.1 mono-user) : pas de DB directe côté front — on appelle
 * la Tauri command get_workspace et on vérifie si le workspace existe.
 * Si aucun workspace → setup non terminé.
 */

import { useEffect, useState } from "react";

export type OnboardingGuardStatus = "loading" | "needs-onboarding" | "ready";

/** Vérifie si l'onboarding a déjà été complété. */
async function checkSetupCompleted(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const completed = await invoke<boolean>("is_setup_completed");
    return completed;
  } catch {
    // Hors contexte Tauri (tests, SSR) : considérer setup non complété
    // pour ne pas bloquer l'accès en développement web.
    // En tests, mocker ce comportement via vi.mock.
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
