import type { ErrorInfo, ReactNode, ReactElement } from "react";
import { Component } from "react";

interface Props {
  children: ReactNode;
  /** Optional fallback builder — reçoit l'error + un reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Garde-fou anti écran blanc : capture les throws sous l'arbre React et
 * affiche un écran Brutal Invoice avec le message d'erreur, au lieu de
 * laisser le root vidé par React.
 *
 * Utilisé au niveau racine (App.tsx) pour que l'onboarding puisse toujours
 * afficher un diagnostic plutôt qu'un écran beige silencieux.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Pas de service Sentry en v0.1 — on pousse au moins dans la console.
    // eslint-disable-next-line no-console
    console.error("[FAKT] ErrorBoundary captured:", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return <DefaultFallback error={error} onReset={this.reset} />;
  }
}

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}): ReactElement {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        padding: "48px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          background: "var(--surface)",
          border: "2.5px solid var(--ink)",
          boxShadow: "5px 5px 0 var(--ink)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              background: "var(--ink)",
              color: "#FFFF00",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            !
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-ui)",
              fontWeight: 800,
              fontSize: "var(--t-xl)",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            Une erreur est survenue
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontSize: "var(--t-sm)",
            color: "var(--muted)",
          }}
        >
          L'application a rencontré un problème inattendu. Vous pouvez réessayer ou
          recharger.
        </p>
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "var(--paper)",
            border: "1.5px solid var(--line)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-xs)",
            color: "var(--ink)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {error.message || String(error)}
        </pre>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 800,
              fontSize: "var(--t-sm)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#FFFF00",
              background: "var(--ink)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 800,
              fontSize: "var(--t-sm)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink)",
              background: "var(--surface)",
              border: "2px solid var(--ink)",
              boxShadow: "3px 3px 0 var(--ink)",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
        </div>
      </div>
    </div>
  );
}
