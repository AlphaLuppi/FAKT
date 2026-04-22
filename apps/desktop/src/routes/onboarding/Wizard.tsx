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

const BRUTAL_YELLOW = "#FFFF00";

function LogoMark(): ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="3" y="3" width="16" height="16" fill={BRUTAL_YELLOW} />
      <path d="M7 6h8v2.2H9.2v2.4h5v2.2h-5V16H7V6z" fill="#000" />
    </svg>
  );
}

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
            <div style={logoStyle} aria-hidden="true">
              <LogoMark />
            </div>
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
      {/* Cercles + connecteurs */}
      <div style={progressRowStyle}>
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === current;
          const isDone = i < current;
          return (
            <div key={i} style={stepCircleGroupStyle}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: isActive || isDone ? "var(--ink)" : "var(--surface)",
                  border: "2px solid var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isActive || isDone ? BRUTAL_YELLOW : "var(--ink)",
                  fontFamily: "var(--font-ui)",
                  fontWeight: 800,
                  fontSize: 13,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "✓" : String(i + 1)}
              </div>
              {i < total - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: isDone ? "var(--ink)" : "var(--line)",
                    minWidth: 12,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Labels alignés sous chaque cercle */}
      <div style={progressLabelsRowStyle}>
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === current;
          const isDone = i < current;
          const align: React.CSSProperties["textAlign"] =
            i === 0 ? "left" : i === total - 1 ? "right" : "center";
          return (
            <span
              key={i}
              style={{
                flex: 1,
                fontFamily: "var(--font-ui)",
                fontSize: 10,
                fontWeight: isActive ? 800 : 700,
                color: isActive ? "var(--ink)" : isDone ? "var(--ink)" : "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textAlign: align,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {labels[i]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const outerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--paper)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "40px 16px",
  overflowY: "auto",
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  display: "flex",
  flexDirection: "column",
  gap: 28,
  margin: "auto",
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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
  flexDirection: "column",
  gap: 10,
};

const progressRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const stepCircleGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flex: 1,
  minWidth: 0,
};

const progressLabelsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
};

const contentStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "2.5px solid var(--ink)",
  padding: "32px",
  boxShadow: "5px 5px 0 var(--ink)",
};
