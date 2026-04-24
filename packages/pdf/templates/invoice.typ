// invoice.typ — Template principal FACTURE.
// Numérotation format F{YYYY}-{NNN} (ex: F2026-042).
//
// Mentions obligatoires (FR-016) préservées dans ctx.legalMentions (snapshot DB).
// Source : packages/legal/src/mentions.ts.

#import "base.typ": (
  color-accent, color-dark, color-gray, color-bg-light, color-border,
  size-sm, size-md, size-lg, size-title,
  page-margin, font-body,
  h1, h2, accent-rule, dash-item, dash-item-bold, label-value, page-footer,
)
#import "partials/header-workspace.typ": header-workspace
#import "partials/header-client.typ": header-client
#import "partials/items-table.typ": items-table
#import "partials/totals.typ": totals-block
#import "partials/legal-mentions.typ": legal-mentions

// ─── Lecture contexte ────────────────────────────────────────────────────────
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

// ─── En-tête ─────────────────────────────────────────────────────────────────
#align(center)[
  #text(size: size-title, weight: "bold", fill: color-accent)[FACTURE]
  #v(2pt)
  #text(size: size-md, weight: "bold", fill: color-dark)[
    N°  #ctx.number
  ]
]

#v(4pt)
#accent-rule
#v(10pt)

// ─── Bloc émetteur / facturé à ───────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 16pt,
  [#header-workspace(ctx.workspace)],
  [#header-client(ctx.client, label: "FACTURÉ À")],
)

#v(16pt)

// ─── Bandeau dates (3 colonnes : émission / exécution / échéance) ────────────
#block(
  fill: color-bg-light,
  inset: 10pt,
  width: 100%,
  stroke: 0.75pt + color-border,
  grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 10pt,
    [
      #text(size: size-sm, fill: color-gray)[Date d'émission]
      #v(3pt)
      #text(size: size-md, weight: "bold", fill: color-dark)[#ctx.issuedAt]
    ],
    [
      #text(size: size-sm, fill: color-gray)[Date d'exécution]
      #v(3pt)
      #text(size: size-md, weight: "bold", fill: color-dark)[#ctx.executionDate]
    ],
    [
      #text(size: size-sm, fill: color-gray)[Échéance de paiement]
      #v(3pt)
      #text(size: size-md, weight: "bold", fill: color-accent)[#ctx.dueDate]
    ],
  ),
)

#v(16pt)

// ─── Objet ───────────────────────────────────────────────────────────────────
#block[
  #text(size: size-sm, fill: color-gray, weight: "bold")[OBJET]
  #v(3pt)
  #text(size: size-md, fill: color-dark)[#ctx.title]
]

#v(14pt)

// ─── Tableau prestations ─────────────────────────────────────────────────────
#h1("Détail de la prestation")
#items-table(ctx.items)

#v(10pt)

// ─── Totaux ──────────────────────────────────────────────────────────────────
#totals-block(total: ctx.total, tvaApplicable: false)

// ─── Modalités de paiement ───────────────────────────────────────────────────
#v(14pt)
#h1("Modalités de paiement")
#label-value("Mode :", "Virement bancaire")
#label-value("Bénéficiaire :", ctx.workspace.name)
#if ctx.workspace.at("iban", default: none) != none and ctx.workspace.iban != "" [
  #label-value("IBAN :", ctx.workspace.iban)
]
#label-value("Référence à indiquer :", [#ctx.number #ctx.client.name])
#label-value("Échéance :", ctx.dueDate)

// ─── Mentions légales (FR-016) ───────────────────────────────────────────────
// Le snapshot `legalMentions` contient déjà identité émetteur, SIRET, adresse,
// IBAN, mention TVA 293 B, délai paiement, pénalités L441-10, indemnité D441-5.
// On y ajoute systématiquement les dash-items non présents dans le snapshot.
#v(14pt)
#legal-mentions(mentions: ctx.legalMentions, extras: ())

// ─── Dash items supplémentaires garantis ─────────────────────────────────────
// Ces mentions doivent SYSTÉMATIQUEMENT apparaître sur toute facture FR :
#dash-item-bold(
  "Pas d'escompte",
  [pour paiement anticipé.],
)
#dash-item-bold(
  "Taux pénalité :",
  [BCE + 10 points (article L441-10 du Code de commerce) — dû de plein droit dès le lendemain de la date d'échéance, sans rappel préalable.],
)
#dash-item-bold(
  "Indemnité forfaitaire :",
  [40 € pour frais de recouvrement (article D441-5 du Code de commerce).],
)
#if ctx.at("quoteReference", default: none) != none and ctx.quoteReference != "" [
  #dash-item-bold(
    "Prestation réalisée",
    [conformément au devis #ctx.quoteReference accepté par le Client.],
  )
]
