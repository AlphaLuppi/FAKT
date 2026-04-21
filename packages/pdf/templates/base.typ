// base.typ — Constantes design + helpers partagés entre devis et facture.
//
// Charte héritée des skills legacy /devis-freelance et /facture-freelance :
// - bleu accent #2E5090
// - typographie Arial-like (remplacée par Inter cross-OS)
// - layout A4 marges 2cm
// - tirets cadratins (—) pour listes
//
// Source de vérité visuelle : .design-ref/gestion-de-facture-et-devis
// (cf. docs/architecture.md §9.5 "Fidélité charte legacy").

// ─── Couleurs ────────────────────────────────────────────────────────────────
// Accent principal — utilisé pour titres, bordures, TOTAL NET, dates d'échéance.
#let color-accent = rgb("#2E5090")
// Corps de texte principal.
#let color-dark = rgb("#1A1A1A")
// Gris secondaire pour labels, footer, descriptions.
#let color-gray = rgb("#666666")
// Fond clair utilisé pour bandeau dates et ligne TOTAL.
#let color-bg-light = rgb("#EDF2F7")
// Fond header table (même valeur que l'accent — pas un alias distinct côté legacy).
#let color-header-bg = rgb("#2E5090")
#let color-white = rgb("#FFFFFF")
// Bordure neutre pour tables.
#let color-border = rgb("#CCCCCC")

// ─── Typographie ─────────────────────────────────────────────────────────────
// On reste sur Inter pour la portabilité cross-OS (fallback sans-serif système
// si Inter n'est pas disponible à compile-time — Typst gère gracefully).
#let font-body = ("Inter", "Helvetica", "Arial", "Liberation Sans", "sans-serif")

// ─── Échelle de tailles ──────────────────────────────────────────────────────
// Calibrée pour correspondre à la hiérarchie des skills legacy (docx 17-22pt
// convertis → pt Typst).
#let size-xs = 7pt     // footer
#let size-sm = 8pt     // labels, descriptions
#let size-body = 9pt   // corps
#let size-md = 10pt    // emphasis body
#let size-lg = 11pt    // sous-titres
#let size-h2 = 12pt    // H2
#let size-h1 = 14pt    // H1 sections
#let size-title = 22pt // titre principal (FACTURE / DEVIS)

// ─── Layout A4 ───────────────────────────────────────────────────────────────
#let page-margin = (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm)

// ─── Helpers format FR ───────────────────────────────────────────────────────
// NOTE : le formatage des montants et dates est fait côté TypeScript via
// Intl.NumberFormat / Intl.DateTimeFormat AVANT injection dans Typst. Les
// templates reçoivent donc des strings déjà formatées (ex: "1 234,56 €").

// ─── Filet accent (séparateur visuel) ────────────────────────────────────────
#let accent-rule = line(length: 100%, stroke: 1.5pt + color-accent)

// ─── Heading section (style H1 skills legacy) ────────────────────────────────
#let h1(body) = block(
  spacing: 0.8em,
  above: 1.2em,
  below: 0.5em,
  text(size: size-h1, weight: "bold", fill: color-accent, body),
)

#let h2(body) = block(
  spacing: 0.6em,
  above: 0.8em,
  below: 0.4em,
  text(size: size-h2, weight: "bold", fill: color-accent, body),
)

// ─── Tiret cadratin (item liste legacy) ──────────────────────────────────────
// On utilise \u2014 (em-dash) comme dans les skills legacy.
#let dash-item(body) = block(
  above: 0.35em,
  below: 0.35em,
  pad(left: 0.6em, text(size: size-sm, fill: color-dark)[— #body]),
)

// Dash-item avec partie bold + partie normale (ex: "Pénalités : <text>").
#let dash-item-bold(bold-part, rest) = block(
  above: 0.35em,
  below: 0.35em,
  pad(
    left: 0.6em,
    text(size: size-sm, fill: color-dark)[
      — #text(weight: "bold")[#bold-part] #rest
    ],
  ),
)

// ─── Label + valeur (ex: "Stack :" <value>) ──────────────────────────────────
#let label-value(label, value) = block(
  above: 0.35em,
  below: 0.35em,
  text(size: size-sm, fill: color-dark)[
    #text(weight: "bold")[#label] #value
  ],
)

// ─── Fonction utilitaire : cellule d'en-tête table (fond accent) ─────────────
#let header-cell(body, align-x: center) = {
  set align(center + horizon)
  set text(fill: color-white, weight: "bold", size: size-sm)
  set par(justify: false)
  block(
    fill: color-header-bg,
    inset: (x: 8pt, y: 8pt),
    width: 100%,
    align(align-x, body),
  )
}

// ─── Fonction utilitaire : cellule standard table ────────────────────────────
#let body-cell(body, align-x: left, bold: false, fill: none) = {
  set align(align-x + horizon)
  set text(
    fill: color-dark,
    weight: if bold { "bold" } else { "regular" },
    size: size-sm,
  )
  block(
    fill: fill,
    inset: (x: 8pt, y: 8pt),
    width: 100%,
    body,
  )
}

// ─── Footer page (identité émetteur + pagination) ────────────────────────────
#let page-footer(workspace-line) = {
  set text(size: size-xs, fill: color-gray)
  set align(center)
  [#workspace-line]
  v(2pt)
  context [Page #counter(page).display() / #counter(page).final().first()]
}
