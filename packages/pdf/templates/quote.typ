// quote.typ — Template principal DEVIS.
// Numérotation format D{YYYY}-{NNN} (ex: D2026-042).
//
// Le contexte JSON est injecté via le chemin du fichier JSON passé en input
// par le wrapper Rust. On le lit via `sys.inputs.ctx` (Typst 0.11+).

#import "base.typ": (
  color-accent, color-dark, color-gray, color-bg-light, color-border,
  size-sm, size-md, size-lg, size-title,
  page-margin, font-body,
  h1, h2, accent-rule, dash-item, label-value, page-footer,
)
#import "partials/header-workspace.typ": header-workspace
#import "partials/header-client.typ": header-client
#import "partials/items-table.typ": items-table
#import "partials/totals.typ": totals-block
#import "partials/signature-block.typ": signature-block
#import "partials/quote-legal.typ": quote-legal

// ─── Lecture du contexte JSON ────────────────────────────────────────────────
// Le wrapper Rust passe le JSON path en input `ctx-path`. Typst 0.11 lit
// via `sys.inputs`. Si non fourni, fallback sur fixture locale (tests).
#let ctx = json(sys.inputs.at("ctx-path", default: "ctx.json"))

// ─── Configuration page ──────────────────────────────────────────────────────
#set page(
  paper: "a4",
  margin: page-margin,
  footer: page-footer(
    [#ctx.workspace.name — SIRET #ctx.workspace.siret — #ctx.workspace.email],
  ),
)
#set text(font: font-body, size: size-sm, fill: color-dark, lang: "fr")
#set par(justify: true, leading: 0.55em)

// ─── En-tête (titre + numéro) ────────────────────────────────────────────────
#align(center)[
  #text(size: size-title, weight: "bold", fill: color-accent)[DEVIS]
  #v(2pt)
  #text(size: size-md, weight: "bold", fill: color-dark)[
    N°  #ctx.number
  ]
]

#v(4pt)
#accent-rule
#v(10pt)

// ─── Bloc émetteur / client (2 colonnes) ─────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 16pt,
  [#header-workspace(ctx.workspace)],
  [#header-client(ctx.client, label: "DEVIS POUR")],
)

#v(16pt)

// ─── Bandeau dates ───────────────────────────────────────────────────────────
#block(
  fill: color-bg-light,
  inset: 10pt,
  width: 100%,
  stroke: 0.75pt + color-border,
  grid(
    columns: (1fr, 1fr),
    gutter: 16pt,
    [
      #text(size: size-sm, fill: color-gray)[Date d'émission]
      #v(3pt)
      #text(size: size-md, weight: "bold", fill: color-dark)[#ctx.issuedAt]
    ],
    [
      #text(size: size-sm, fill: color-gray)[Valable jusqu'au]
      #v(3pt)
      #text(size: size-md, weight: "bold", fill: color-accent)[#ctx.validityDate]
    ],
  ),
)

#v(16pt)

// ─── Objet du devis ──────────────────────────────────────────────────────────
#block[
  #text(size: size-sm, fill: color-gray, weight: "bold")[OBJET]
  #v(3pt)
  #text(size: size-md, fill: color-dark)[#ctx.title]
]

#v(16pt)

// ─── Tableau prestations ─────────────────────────────────────────────────────
#h1("Détail de la proposition")
#items-table(ctx.items)

#v(10pt)

// ─── Totaux ──────────────────────────────────────────────────────────────────
#totals-block(total: ctx.total, tvaApplicable: false)

// ─── Modalités de paiement (information complémentaire, renvoi facture) ─────
#v(14pt)
#h2("Modalités de paiement")
#label-value("Mode :", "Virement bancaire")
#label-value("Bénéficiaire :", ctx.workspace.name)
#if ctx.workspace.at("iban", default: none) != none and ctx.workspace.iban != "" [
  #label-value("IBAN :", ctx.workspace.iban)
]

// ─── Conditions particulières (texte libre — acompte, délai spécifique…) ────
#if ctx.at("conditions", default: none) != none and ctx.conditions != "" [
  #v(14pt)
  #h1("Conditions particulières")
  #block(
    text(size: size-sm, fill: color-dark)[#ctx.conditions],
  )
]

// ─── Notes libres ────────────────────────────────────────────────────────────
#if ctx.at("notes", default: none) != none and ctx.notes != "" [
  #v(14pt)
  #h2("Notes")
  #block(
    text(size: size-sm, fill: color-gray, style: "italic")[#ctx.notes],
  )
]

// ─── Conditions générales de vente (obligatoires FR) ─────────────────────────
// Mentions non négociables : pénalités L441-10, indemnité D441-5, art. 293 B,
// PI, résiliation, confidentialité, loi applicable. Source skill /devis-freelance.
#v(14pt)
#quote-legal(
  tvaMention: ctx.workspace.tvaMention,
)

// ─── Signature ───────────────────────────────────────────────────────────────
#v(20pt)
#accent-rule
#v(10pt)
#text(size: size-sm, fill: color-dark)[
  Bon pour accord — merci de dater, signer et retourner ce devis.
]
#v(12pt)
#signature-block(
  workspaceName: ctx.workspace.name,
  clientName: ctx.client.name,
  signedAt: ctx.at("signedAt", default: none),
)
