// audit-trail.typ — Rapport d'audit lisible (preuve juridique).
//
// Reçoit un AuditTrailCtx via sys.inputs.ctx-path. Affiche :
//   1. Header : titre RAPPORT D'AUDIT + sous-titre document
//   2. Métadonnées document (type, n°, client, montant, dates)
//   3. Section signatures électroniques (si > 0 events)
//   4. Journal d'événements (chrono activity + signatures fusionnés)
//   5. Footer : mention vérification PAdES + horodatage génération
//
// Inspiration : DocuSeal `lib/submissions/generate_audit_trail.rb`.
// Différence : pas de champs de form-builder, pas de KBA/SMS — FAKT n'a
// que le signataire émetteur (et plus tard l'import retour client en V0.2).

#import "base.typ": (
  color-accent, color-dark, color-gray, color-bg-light, color-border,
  size-xs, size-sm, size-md, size-lg, size-title,
  page-margin, font-body,
  h1, h2, accent-rule, label-value, page-footer,
)

#let ctx = json(sys.inputs.at("ctx-path", default: "ctx.json"))

#set page(
  paper: "a4",
  margin: page-margin,
  footer: page-footer(
    [#ctx.workspace.name — SIRET #ctx.workspace.siret — #ctx.workspace.email],
  ),
)
#set text(font: font-body, size: size-sm, fill: color-dark, lang: "fr")
#set par(justify: true, leading: 0.55em)

// ─── Header ──────────────────────────────────────────────────────────────────
#align(center)[
  #text(size: size-title, weight: "bold", fill: color-accent)[RAPPORT D'AUDIT]
  #v(2pt)
  #text(size: size-md, weight: "bold", fill: color-dark)[
    #ctx.document.label — #ctx.document.number
  ]
  #v(2pt)
  #text(size: size-sm, fill: color-gray, style: "italic")[
    Preuve d'intégrité juridique — chaîne SHA-256 + signature PAdES
  ]
]

#v(4pt)
#accent-rule
#v(10pt)

// ─── Métadonnées document ────────────────────────────────────────────────────
#h1("Document")

#block(
  fill: color-bg-light,
  inset: 10pt,
  width: 100%,
  stroke: 0.75pt + color-border,
  [
    #grid(
      columns: (auto, 1fr),
      gutter: 8pt,
      column-gutter: 14pt,

      text(size: size-sm, fill: color-gray, weight: "bold")[Type],
      text(size: size-sm, fill: color-dark)[#ctx.document.label],

      text(size: size-sm, fill: color-gray, weight: "bold")[Numéro],
      text(size: size-sm, fill: color-dark, font: ("JetBrains Mono", "Consolas", "monospace"))[#ctx.document.number],

      text(size: size-sm, fill: color-gray, weight: "bold")[Objet],
      text(size: size-sm, fill: color-dark)[#ctx.document.title],

      text(size: size-sm, fill: color-gray, weight: "bold")[Client],
      text(size: size-sm, fill: color-dark)[#ctx.document.clientName],

      text(size: size-sm, fill: color-gray, weight: "bold")[Montant HT],
      text(size: size-sm, fill: color-dark, weight: "bold")[#ctx.document.totalHt],

      ..if ctx.document.at("issuedAt", default: none) != none {
        (
          text(size: size-sm, fill: color-gray, weight: "bold")[Émis le],
          text(size: size-sm, fill: color-dark)[#ctx.document.issuedAt],
        )
      } else { () },

      ..if ctx.document.at("signedAt", default: none) != none {
        (
          text(size: size-sm, fill: color-gray, weight: "bold")[Signé le],
          text(size: size-sm, fill: color-accent, weight: "bold")[#ctx.document.signedAt],
        )
      } else { () },
    )
  ],
)

// ─── Section signatures électroniques ────────────────────────────────────────
#if ctx.signatureEvents.len() > 0 [
  #v(14pt)
  #h1("Signatures électroniques")
  #text(size: size-xs, fill: color-gray, style: "italic")[
    Chaîne SHA-256 append-only — chaque événement référence le hash de l'événement précédent.
    Toute altération est détectable via la commande de vérification de FAKT ou un outil PAdES tiers.
  ]
  #v(8pt)

  #for (idx, event) in ctx.signatureEvents.enumerate() [
    #block(
      stroke: 0.75pt + color-border,
      inset: 10pt,
      width: 100%,
      below: 10pt,
      [
        #grid(
          columns: (auto, 1fr),
          gutter: 6pt,
          column-gutter: 14pt,

          text(size: size-sm, fill: color-accent, weight: "bold")[Événement \##{idx + 1}],
          text(size: size-sm, fill: color-dark, weight: "bold")[#event.timestamp],

          text(size: size-xs, fill: color-gray, weight: "bold")[Signataire],
          text(size: size-sm, fill: color-dark)[#event.signerName \<#event.signerEmail\>],

          ..if event.at("ipAddress", default: none) != none {
            (
              text(size: size-xs, fill: color-gray, weight: "bold")[Adresse IP],
              text(size: size-sm, fill: color-dark, font: ("JetBrains Mono", "Consolas", "monospace"))[#event.ipAddress],
            )
          } else { () },

          ..if event.at("userAgent", default: none) != none {
            (
              text(size: size-xs, fill: color-gray, weight: "bold")[Agent],
              text(size: size-xs, fill: color-dark)[#event.userAgent],
            )
          } else { () },

          ..if event.at("padesLevel", default: none) != none {
            (
              text(size: size-xs, fill: color-gray, weight: "bold")[Niveau eIDAS],
              text(size: size-sm, fill: color-dark)[Signature avancée — PAdES #event.padesLevel],
            )
          } else { () },

          ..if event.at("tsaProvider", default: none) != none {
            (
              text(size: size-xs, fill: color-gray, weight: "bold")[Horodatage TSA],
              text(size: size-sm, fill: color-dark)[#event.tsaProvider],
            )
          } else { () },

          text(size: size-xs, fill: color-gray, weight: "bold")[Hash avant],
          text(size: size-xs, fill: color-dark, font: ("JetBrains Mono", "Consolas", "monospace"))[#event.docHashBefore],

          text(size: size-xs, fill: color-gray, weight: "bold")[Hash après],
          text(size: size-xs, fill: color-dark, font: ("JetBrains Mono", "Consolas", "monospace"))[#event.docHashAfter],

          ..if event.at("previousEventHash", default: none) != none {
            (
              text(size: size-xs, fill: color-gray, weight: "bold")[Hash événement précédent],
              text(size: size-xs, fill: color-dark, font: ("JetBrains Mono", "Consolas", "monospace"))[#event.previousEventHash],
            )
          } else { () },
        )
      ],
    )
  ]
]

// ─── Journal d'événements (chronologie complète) ────────────────────────────
#v(14pt)
#h1("Journal d'événements")

#if ctx.events.len() == 0 [
  #text(size: size-sm, fill: color-gray, style: "italic")[
    Aucun événement enregistré pour ce document.
  ]
] else [
  #table(
    columns: (auto, 1fr),
    inset: 8pt,
    align: (left, left),
    stroke: 0.5pt + color-border,
    fill: (col, row) => if row == 0 { color-accent } else { none },

    text(size: size-xs, fill: rgb("#FFFFFF"), weight: "bold")[Date / heure],
    text(size: size-xs, fill: rgb("#FFFFFF"), weight: "bold")[Événement],

    ..ctx.events.map(ev => (
      text(size: size-xs, fill: color-dark, font: ("JetBrains Mono", "Consolas", "monospace"))[#ev.timestamp],
      text(size: size-sm, fill: color-dark)[#ev.label],
    )).flatten(),
  )
]

// ─── Footer vérification ────────────────────────────────────────────────────
#v(20pt)
#accent-rule
#v(8pt)

#block(
  fill: color-bg-light,
  inset: 10pt,
  width: 100%,
  [
    #text(size: size-xs, fill: color-dark, weight: "bold")[Vérification d'intégrité]
    #v(3pt)
    #text(size: size-xs, fill: color-dark)[
      Ce rapport peut être vérifié indépendamment :
    ]
    #v(2pt)
    #text(size: size-xs, fill: color-dark)[
      • Dans FAKT — onglet « Vérifier la signature » sur le document concerné.
    ]
    #text(size: size-xs, fill: color-dark)[
      • Avec un outil PAdES tiers — Adobe Reader (panneau Signatures), pyHanko (CLI), Foxit Reader.
    ]
    #text(size: size-xs, fill: color-dark)[
      • En recalculant manuellement la chaîne SHA-256 des événements ci-dessus.
    ]
    #v(6pt)
    #text(size: size-xs, fill: color-gray, style: "italic")[
      Document généré le #ctx.generatedAt par FAKT — outil open-source de gestion devis/factures.
    ]
  ],
)
