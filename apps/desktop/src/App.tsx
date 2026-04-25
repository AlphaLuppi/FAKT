import type { ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { Shell } from "./features/shell/Shell.js";
// useAuth importé pour son side-effect (mount initial fetch /me en mode remote)
import { useAuth } from "./hooks/useAuth.js";
import { ArchiveRoute } from "./routes/archive/index.js";
import { LoginRoute } from "./routes/auth/Login.js";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { ClientsRoute } from "./routes/clients/index.js";
import { DashboardRoute } from "./routes/dashboard.js";
import { InvoicesRouter } from "./routes/invoices/index.js";
import { WizardRoute } from "./routes/onboarding/Wizard.js";
import { useOnboardingGuard } from "./routes/onboarding/guard.js";
import { QuotesRouter } from "./routes/quotes/index.js";
import { ServicesRoute } from "./routes/services/index.js";
import { SettingsRoute } from "./routes/settings/Settings.js";
import { SignaturesRouter } from "./routes/signatures/index.js";

export function App(): ReactElement {
  // useAuth side-effect : sur mount en mode remote, fetch /api/auth/me pour
  // restaurer la session via le cookie httpOnly. Bypass en mode local sidecar.
  useAuth();

  const guard = useOnboardingGuard();
  const location = useLocation();

  // La page /login est publique : skip onboarding/auth guards
  if (location.pathname === "/login") {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  if (guard === "loading") {
    return <LoadingScreen />;
  }

  const isOnboarding = location.pathname.startsWith("/onboarding");

  if (guard === "needs-onboarding" && !isOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isOnboarding) {
    return (
      <ErrorBoundary>
        <RequireAuth>
          <Routes>
            <Route path="/onboarding" element={<WizardRoute />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </Routes>
        </RequireAuth>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <RequireAuth>
        <Shell>
          <Routes>
            <Route path="/" element={<DashboardRoute />} />
            <Route path="/quotes/*" element={<QuotesRouter />} />
            <Route path="/invoices/*" element={<InvoicesRouter />} />
            <Route path="/clients/*" element={<ClientsRoute />} />
            <Route path="/services/*" element={<ServicesRoute />} />
            <Route path="/signatures/*" element={<SignaturesRouter />} />
            <Route path="/archive" element={<ArchiveRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="*" element={<Placeholder title="404 — Page introuvable" />} />
          </Routes>
        </Shell>
      </RequireAuth>
    </ErrorBoundary>
  );
}

function LoadingScreen(): ReactElement {
  return (
    <div
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

function Placeholder({ title }: { title: string }): ReactElement {
  return (
    <div
      style={{
        padding: "var(--s-7)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-4)",
      }}
    >
      <h1
        style={{
          font: "var(--w-black) var(--t-2xl)/1 var(--font-ui)",
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: "var(--ink)",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--muted)", margin: 0 }}>
        Cette section sera disponible prochainement.
      </p>
    </div>
  );
}
