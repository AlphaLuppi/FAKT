// header-client.typ — Bloc identification client destinataire.
// Équivaut au bloc FACTURÉ À / DEVIS POUR des skills legacy.
//
// Attendu dans `ctx.client` :
//   - name (obligatoire)
//   - legalForm, address, siret, contactName (tous optionnels → string ou none)
//   - tvaIntracom (optionnel, n° TVA intra si client assujetti)

#import "../base.typ": color-dark, color-gray, size-sm, size-md

// label : "FACTURÉ À" pour factures, "DEVIS POUR" pour devis.
#let header-client(client, label: "FACTURÉ À") = {
  set text(fill: color-dark, size: size-sm)
  [
    #text(size: size-sm, fill: color-gray, weight: "bold")[#label]
    #v(4pt)
    #text(size: size-md, weight: "bold")[#client.name]
  ]

  if client.legalForm != none and client.legalForm != "" [
    #v(2pt)
    #text(size: size-sm)[#client.legalForm]
  ]
  if client.address != none and client.address != "" [
    #v(2pt)
    #text(size: size-sm)[#client.address]
  ]
  if client.siret != none and client.siret != "" [
    #v(2pt)
    #text(size: size-sm)[SIRET : #client.siret]
  ]
  if client.at("tvaIntracom", default: none) != none and client.tvaIntracom != "" [
    #v(2pt)
    #text(size: size-sm)[TVA intracom. : #client.tvaIntracom]
  ]
  if client.contactName != none and client.contactName != "" [
    #v(2pt)
    #text(size: size-sm, fill: color-gray)[À l'attention de #client.contactName]
  ]
}
