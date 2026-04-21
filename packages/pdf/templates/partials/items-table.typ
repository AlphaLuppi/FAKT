// items-table.typ — Tableau des prestations.
// Équivaut au tableau 4 colonnes des skills legacy :
//   Désignation (5600 DXA) / Qté (1000) / PU HT (1500) / Total HT (reste)
//
// Attendu dans `ctx.items` : liste d'objets {
//   description: string,
//   quantity: string (ex: "1" ou "2,5" — pré-formatté FR),
//   unitPrice: string (ex: "100,00 €"),
//   unit: string (ex: "jour", "forfait"),
//   total: string (ex: "250,00 €")
// }

#import "../base.typ": color-accent, color-dark, color-gray, color-border, color-header-bg, color-white, size-sm

#let items-table(items) = {
  // Colonnes : priorité à la description.
  let columns = (
    1fr,   // Désignation
    0.4fr, // Quantité + unité
    0.7fr, // Prix unitaire HT
    0.7fr, // Total HT
  )

  // Header row.
  let header-row = (
    table.cell(
      fill: color-header-bg,
      inset: 8pt,
      align: left + horizon,
      text(fill: color-white, weight: "bold", size: size-sm)[Désignation],
    ),
    table.cell(
      fill: color-header-bg,
      inset: 8pt,
      align: center + horizon,
      text(fill: color-white, weight: "bold", size: size-sm)[Qté],
    ),
    table.cell(
      fill: color-header-bg,
      inset: 8pt,
      align: right + horizon,
      text(fill: color-white, weight: "bold", size: size-sm)[PU HT],
    ),
    table.cell(
      fill: color-header-bg,
      inset: 8pt,
      align: right + horizon,
      text(fill: color-white, weight: "bold", size: size-sm)[Total HT],
    ),
  )

  // Body rows.
  let body-rows = items.map(item => (
    table.cell(
      inset: 8pt,
      align: left + horizon,
      text(fill: color-dark, size: size-sm, weight: "bold")[#item.description],
    ),
    table.cell(
      inset: 8pt,
      align: center + horizon,
      text(fill: color-dark, size: size-sm)[#item.quantity #item.unit],
    ),
    table.cell(
      inset: 8pt,
      align: right + horizon,
      text(fill: color-dark, size: size-sm)[#item.unitPrice],
    ),
    table.cell(
      inset: 8pt,
      align: right + horizon,
      text(fill: color-dark, size: size-sm)[#item.total],
    ),
  )).flatten()

  table(
    columns: columns,
    stroke: 0.75pt + color-border,
    ..header-row,
    ..body-rows,
  )
}
