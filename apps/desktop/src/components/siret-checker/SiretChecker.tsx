import { explainSiret } from "@fakt/legal";
import type { SiretExplanation } from "@fakt/legal";
import type { CSSProperties, ReactElement } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useFormState, useWatch } from "react-hook-form";

interface SiretCheckerProps {
  value: string;
  show: boolean;
}

/**
 * Version connectée à react-hook-form via `control`. S'abonne uniquement aux
 * changements du champ SIRET (via useWatch) sans forcer de re-render du form
 * parent — évite les latences de saisie sur un form avec beaucoup de champs.
 */
export function SiretCheckerField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}): ReactElement | null {
  const raw = useWatch({ control, name });
  const value = typeof raw === "string" ? raw : "";
  const { touchedFields, isSubmitted } = useFormState({ control, name });
  const show = Boolean((touchedFields as Record<string, unknown>)[name]) || isSubmitted;
  return <SiretChecker value={value} show={show} />;
}

/**
 * Panneau pédagogique affiché quand la saisie SIRET est invalide.
 *
 * Règle UX : caché tant que l'utilisateur n'a pas fini sa saisie (pas de
 * spam pendant qu'il tape). Une fois affiché, se met à jour en live pour
 * l'aider à corriger — il disparaît dès que le SIRET devient valide.
 */
export function SiretChecker({ value, show }: SiretCheckerProps): ReactElement | null {
  if (!show) return null;
  const diag = explainSiret(value);
  if (diag.isValid) return null;
  if (diag.issue === "empty") return null;

  return (
    <div role="alert" aria-live="polite" style={panelStyle} data-testid="siret-checker">
      <p style={titleStyle}>Ce SIRET n'est pas valide</p>
      <ul style={listStyle}>
        <LengthCheck diag={diag} />
        <DigitsCheck diag={diag} />
        <LuhnCheck diag={diag} />
      </ul>
      {diag.issue === "luhn-mismatch" && <LuhnExplanation diag={diag} />}
    </div>
  );
}

function LengthCheck({ diag }: { diag: SiretExplanation }): ReactElement {
  const ok = diag.hasCorrectLength;
  const label = ok
    ? "14 chiffres"
    : diag.length === 0
      ? "14 chiffres requis"
      : `14 chiffres — vous en avez ${diag.length}`;
  return <CheckLine ok={ok} label={label} />;
}

function DigitsCheck({ diag }: { diag: SiretExplanation }): ReactElement {
  const ok = diag.hasOnlyDigits;
  const label = ok ? "Que des chiffres" : "Un SIRET ne contient que des chiffres (0-9)";
  return <CheckLine ok={ok} label={label} />;
}

function LuhnCheck({ diag }: { diag: SiretExplanation }): ReactElement {
  // On ne peut juger la clé Luhn que si la longueur et les chiffres sont bons.
  const applicable = diag.hasCorrectLength && diag.hasOnlyDigits;
  const ok = applicable && (diag.isLuhnValid || diag.isLaPosteException);
  const label = applicable
    ? ok
      ? "Clé de sécurité correcte"
      : "Clé de sécurité incorrecte"
    : "Clé de sécurité (à vérifier une fois les 14 chiffres saisis)";
  return <CheckLine ok={ok} label={label} dimmed={!applicable} />;
}

function CheckLine({
  ok,
  label,
  dimmed = false,
}: {
  ok: boolean;
  label: string;
  dimmed?: boolean;
}): ReactElement {
  return (
    <li style={{ ...lineStyle, opacity: dimmed ? 0.55 : 1 }}>
      <span style={boxStyle(ok)} aria-hidden>
        {ok ? "✓" : ""}
      </span>
      <span>{label}</span>
    </li>
  );
}

function LuhnExplanation({ diag }: { diag: SiretExplanation }): ReactElement {
  return (
    <div style={luhnBoxStyle}>
      <p style={luhnHintStyle}>
        Si vos 13 premiers chiffres sont corrects, le dernier devrait être{" "}
        <strong style={expectedStyle}>{diag.expectedLastDigit}</strong>, pas{" "}
        <strong style={actualStyle}>{diag.actualLastDigit}</strong>.
      </p>
      <p style={luhnSecondaryStyle}>
        Vérifiez votre saisie chiffre par chiffre. Le plus souvent, c'est une seule touche qui a
        dérapé.
      </p>
      <details style={detailsStyle}>
        <summary style={summaryStyle}>Pourquoi ce contrôle&nbsp;?</summary>
        <p style={detailsBodyStyle}>
          Le dernier chiffre d'un SIRET est une «&nbsp;clé de sécurité&nbsp;» calculée à partir des
          13 autres (algorithme de Luhn). Son seul rôle est de détecter les fautes de frappe : si un
          chiffre change, la clé ne tombe plus juste et on sait qu'il y a une erreur quelque part
          dans la saisie.
        </p>
      </details>
    </div>
  );
}

const panelStyle: CSSProperties = {
  marginTop: 8,
  padding: "12px 16px",
  border: "var(--stroke-bold) solid var(--ink)",
  background: "var(--warn-bg)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--ink)",
  boxShadow: "3px 3px 0 var(--ink)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const lineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const boxStyle = (ok: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  border: "var(--stroke) solid var(--ink)",
  background: ok ? "var(--ink)" : "var(--surface)",
  color: ok ? "var(--accent-soft)" : "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  fontSize: 12,
  lineHeight: 1,
  flexShrink: 0,
});

const luhnBoxStyle: CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "var(--stroke-hair) solid var(--ink)",
};

const luhnHintStyle: CSSProperties = {
  margin: 0,
  marginBottom: 8,
};

const luhnSecondaryStyle: CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: "var(--t-xs)",
  color: "var(--ink-3)",
};

const expectedStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  background: "var(--ink)",
  color: "var(--accent-soft)",
  padding: "1px 6px",
};

const actualStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  textDecoration: "line-through",
  padding: "1px 6px",
};

const detailsStyle: CSSProperties = {
  marginTop: 4,
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: "var(--t-xs)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailsBodyStyle: CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  fontSize: "var(--t-xs)",
  color: "var(--ink-3)",
};
