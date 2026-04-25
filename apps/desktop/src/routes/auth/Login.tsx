import { type FormEvent, type ReactElement, useState } from "react";
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
          background: "var(--surface)",
          border: "2.5px solid var(--ink)",
          boxShadow: "8px 8px 0 var(--ink)",
          padding: "var(--s-7)",
        }}
      >
        <h1
          style={{
            font: "var(--w-black) var(--t-2xl)/1 var(--font-ui)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
            marginBottom: "var(--s-3)",
          }}
        >
          FAKT
        </h1>
        <p
          style={{
            font: "var(--w-med) var(--t-base)/1.4 var(--font-ui)",
            color: "var(--ink)",
            margin: 0,
            marginBottom: "var(--s-6)",
          }}
        >
          Connexion à votre espace équipe.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
        >
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
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
                background: "var(--surface)",
                font: "var(--w-med) var(--t-base) var(--font-ui)",
                color: "var(--ink)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                font: "var(--w-bold) var(--t-xs)/1 var(--font-ui)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
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
                background: "var(--surface)",
                font: "var(--w-med) var(--t-base) var(--font-ui)",
                color: "var(--ink)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: "var(--s-3) var(--s-4)",
                background: "var(--danger-bg)",
                border: "2px solid var(--ink)",
                font: "var(--w-bold) var(--t-sm)/1.4 var(--font-ui)",
                color: "var(--ink)",
              }}
            >
              {error}
            </div>
          )}

          <SubmitButton loading={loading} />
        </form>

        <p
          style={{
            font: "var(--w-med) var(--t-xs)/1.4 var(--font-ui)",
            color: "var(--muted)",
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

function SubmitButton({ loading }: { loading: boolean }): ReactElement {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const inverted = hover && !loading;
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        padding: "var(--s-4)",
        border: "2px solid var(--ink)",
        background: loading ? "var(--paper-2)" : inverted ? "var(--ink)" : "var(--accent-soft)",
        color: inverted ? "var(--accent-soft)" : "var(--ink)",
        font: "var(--w-black) var(--t-base)/1 var(--font-ui)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        cursor: loading ? "not-allowed" : "pointer",
        boxShadow: pressed ? "none" : "3px 3px 0 var(--ink)",
        transform: pressed ? "translate(3px, 3px)" : "none",
        marginTop: "var(--s-2)",
        transition: "background 80ms, color 80ms",
      }}
    >
      {loading ? "Connexion…" : "Se connecter"}
    </button>
  );
}
