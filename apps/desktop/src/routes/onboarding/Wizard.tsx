import type { ReactElement } from "react";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Toaster } from "@fakt/ui";
import { fr } from "@fakt/shared";
import { IdentityStep } from "./steps/Identity.js";
import { ClaudeCliStep } from "./steps/ClaudeCli.js";
import { CertificateStep } from "./steps/Certificate.js";
import { RecapStep } from "./steps/Recap.js";
import { OnboardingContext } from "./context.js";
import type { OnboardingState, CertInfo } from "./context.js";
import type { IdentityFormValues } from "./validators.js";
import type { CliInfo } from "@fakt/ai";

const STEPS = [
  fr.onboarding.step1.title,
  fr.onboarding.step2.title,
  fr.onboarding.step3.title,
  fr.onboarding.step4.title,
] as const;

const TOTAL_STEPS = STEPS.length;

export function WizardRoute(): ReactElement {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<OnboardingState>({
    identity: null,
    cliInfo: null,
    cliSkipped: false,
    certInfo: null,
  });

  const setIdentity = useCallback((identity: IdentityFormValues) => {
    setState((prev) => ({ ...prev, identity }));
  }, []);

  const setCliInfo = useCallback((info: CliInfo, skipped: boolean) => {
    setState((prev) => ({ ...prev, cliInfo: info, cliSkipped: skipped }));
  }, []);

  const setCertInfo = useCallback((cert: CertInfo) => {
    setState((prev) => ({ ...prev, certInfo: cert }));
  }, []);

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleFinish = useCallback(() => {
    void navigate("/");
  }, [navigate]);

  return (
    <OnboardingContext.Provider value={{ state, setIdentity, setCliInfo, setCertInfo }}>
      <div style={outerStyle}>
        <div style={containerStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <div style={logoStyle}>F</div>
            <div>
              <div style={appNameStyle}>{fr.app.name}</div>
              <div style={subtitleStyle}>{fr.onboarding.subtitle}</div>
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar current={currentStep} total={TOTAL_STEPS} labels={STEPS} />

          {/* Step content */}
          <div style={contentStyle}>
            {currentStep === 0 && <IdentityStep onNext={goNext} />}
            {currentStep === 1 && <ClaudeCliStep onNext={goNext} onPrev={goPrev} />}
            {currentStep === 2 && <CertificateStep onNext={goNext} onPrev={goPrev} />}
            {currentStep === 3 && <RecapStep onPrev={goPrev} onFinish={handleFinish} />}
          </div>
        </div>
      </div>
      <Toaster position="bottom-right" />
    </OnboardingContext.Provider>
  );
}

interface ProgressBarProps {
  current: number;
  total: number;
  labels: ReadonlyArray<string>;
}

function ProgressBar({ current, total, labels }: ProgressBarProps): ReactElement {
  return (
    <div style={progressContainerStyle} role="navigation" aria-label="Étapes">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <div key={i} style={stepItemStyle}>
            <div
              style={{
                width: 28,
                height: 28,
                background: isActive ? "var(--ink)" : isDone ? "var(--ink)" : "var(--surface)",
                border: "2px solid var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isActive ? "var(--accent)" : isDone ? "var(--accent)" : "var(--ink)",
                fontFamily: "var(--font-ui)",
                fontWeight: 800,
                fontSize: 12,
                flexShrink: 0,
              }}
              aria-current={isActive ? "step" : undefined}
            >
              {isDone ? "✓" : String(i + 1)}
            </div>
            <span style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--t-xs)",
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "var(--ink)" : "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              {labels[i]}
            </span>
            {i < total - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: isDone ? "var(--ink)" : "var(--line)",
                minWidth: 20,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const outerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--paper)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  display: "flex",
  flexDirection: "column",
  gap: 32,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const logoStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  background: "var(--ink)",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-ui)",
  fontWeight: 800,
  fontSize: 20,
  flexShrink: 0,
};

const appNameStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontWeight: 800,
  fontSize: "var(--t-xl)",
  textTransform: "uppercase",
  letterSpacing: "-0.02em",
  color: "var(--ink)",
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--muted)",
  marginTop: 2,
};

const progressContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const stepItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: 1,
  minWidth: 0,
};

const contentStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "2.5px solid var(--ink)",
  padding: "32px",
  boxShadow: "5px 5px 0 var(--ink)",
};
