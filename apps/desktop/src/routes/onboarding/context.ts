import type { CliInfo } from "@fakt/ai";
import { createContext, useContext } from "react";
import type { IdentityFormValues } from "./validators.js";

export interface CertInfo {
  dn: string;
  fingerprint: string;
  notBefore: string;
  notAfter: string;
  /** Null si on a chargé un cert existant via `get_cert_info` (qui ne retourne
   * pas le PEM). Présent quand on génère via `generate_cert`. Le PEM peut
   * aussi être récupéré ultérieurement via l'API settings. */
  certPem: string | null;
  storage: "keychain" | "fallback-file";
}

export interface OnboardingState {
  identity: IdentityFormValues | null;
  cliInfo: CliInfo | null;
  cliSkipped: boolean;
  certInfo: CertInfo | null;
}

export interface OnboardingContextValue {
  state: OnboardingState;
  setIdentity: (identity: IdentityFormValues) => void;
  setCliInfo: (info: CliInfo, skipped: boolean) => void;
  setCertInfo: (cert: CertInfo) => void;
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (ctx === null) throw new Error("useOnboarding must be used inside <Wizard>");
  return ctx;
}
