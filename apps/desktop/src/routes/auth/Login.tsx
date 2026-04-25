import { useState, type FormEvent, type ReactElement } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../hooks/useAuth.js";

/**
 * Page de login pour le mode 2 self-host.
 *
 * Design Brutal Invoice strict : carte papier (#F5F5F0) centrée, bordure 2.5px noire,
 * ombre 5px 5px 0 #000, inputs bordure 2px, bouton primary jaune (#FFFF00) qui s'inverse
 * au hover.
 *
 * En mode local sidecar (mode 1), cette page n'est jamais atteinte (RequireAuth bypass).
 */

export function LoginRoute(): ReactElement {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Si déjà authentifié → redirect home (ou la page d'origine)
  if (status === "authenticated" || status === "local") {
    const dest = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={dest} replace />;
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const dest = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(dest, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === "UNAUTHORIZED" ? "Email ou mot de passe invalide." : err.message);
      } else {
        setError("Erreur réseau — vérifiez votre connexion.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        padding: "var(--s-5)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFF",
          border: "2.5px solid var(--ink)",
          boxShadow: "5px 5px 0 var(--ink)",
          padding: "var(--s-7)",
        }}
      >
        <h1
          style={{
            font: "var(--w-black) var(--t-3xl)/1 var(--font-ui)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
            marginBottom: "var(--s-2)",
          }}
        >
          FAKT
        </h1>
        <p
          style={{
            font: "var(--w-medium) var(--t-base)/1.4 var(--font-ui)",
            color: "var(--ink)",
            margin: 0,
            marginBottom: "var(--s-6)",
          }}
        >
          Connexion à votre espace équipe.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                font: "var(--w-bold) var(--t-sm)/1 var(--font-ui)",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                color: "var(--ink)",
                marginBottom: "var(--s-2)",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "var(--s-3) var(--s-4)",
                border: "2px solid var(--ink)",
                background: "#FFF",
                font: "var(--w-medium) var(--t-base) var(--font-ui)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                font: "var(--w-bold) var(--t-sm)/1 var(--font-ui)",
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                color: "var(--ink)",
                marginBottom: "var(--s-2)",
              }}
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "var(--s-3) var(--s-4)",
                border: "2px solid var(--ink)",
                background: "#FFF",
                font: "var(--w-medium) var(--t-base) var(--font-ui)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: "var(--s-3) var(--s-4)",
                background: "var(--accent)",
                border: "2px solid var(--ink)",
                font: "var(--w-medium) var(--t-sm)/1.4 var(--font-ui)",
                color: "var(--ink)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "var(--s-4)",
              border: "2px solid var(--ink)",
              background: loading ? "var(--paper)" : "var(--accent)",
              color: "var(--ink)",
              font: "var(--w-black) var(--t-base)/1 var(--font-ui)",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "3px 3px 0 var(--ink)",
              marginTop: "var(--s-2)",
            }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p
          style={{
            font: "var(--w-medium) var(--t-xs)/1.4 var(--font-ui)",
            color: "var(--ink)",
            opacity: 0.6,
            margin: 0,
            marginTop: "var(--s-5)",
            textAlign: "center",
          }}
        >
          Mot de passe oublié ? Contactez votre administrateur.
        </p>
      </div>
    </div>
  );
}
