// totals.typ — Bloc totaux aligné à droite.
// Équivaut au bloc 3 colonnes (spacer / label / montant) des skills legacy.
//
// Micro-entreprise : pas de ligne TVA chiffrée (mention "Non applicable" en italique gris).
// Le total HT = total net à payer.
//
// Attendu : ctx.total (string préformatté, ex: "1 234,56 €"), ctx.tvaApplicable (bool).

#import "../base.typ": color-accent, color-dark, color-gray, color-border, color-bg-light, size-sm, size-md

#let totals-block(total: "", tvaApplicable: false) = {
  // Largeur fixe 40% bloc totaux, à droite.
  align(right)[
    #block(
      width: 50%,
      [
        #grid(
          columns: (1fr, auto),
          gutter: 0pt,
          stroke: 0.75pt + color-border,
          // Ligne Total HT
          grid.cell(
            inset: 8pt,
            align: left + horizon,
            text(size: size-sm, fill: color-dark)[Total HT],
          ),
          grid.cell(
            inset: 8pt,
            align: right + horizon,
            text(size: size-sm, fill: color-dark)[#total],
          ),
          // Ligne TVA
          grid.cell(
            inset: 8pt,
            align: left + horizon,
            text(size: size-sm, fill: color-dark)[TVA],
          ),
          grid.cell(
            inset: 8pt,
            align: right + horizon,
            if tvaApplicable {
              text(size: size-sm, fill: color-dark)[—]
            } else {
              text(size: size-sm, fill: color-gray, style: "italic")[Non applicable]
            },
          ),
          // Ligne TOTAL NET À PAYER — mise en exergue avec fond accent light.
          grid.cell(
            inset: 8pt,
            align: left + horizon,
            fill: color-bg-light,
            text(size: size-sm, fill: color-accent, weight: "bold")[TOTAL NET À PAYER],
          ),
          grid.cell(
            inset: 8pt,
            align: right + horizon,
            fill: color-bg-light,
            text(size: size-md, fill: color-accent, weight: "bold")[#total],
          ),
        )
      ],
    )
  ]
}
