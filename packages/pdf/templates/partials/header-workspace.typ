// header-workspace.typ — Bloc identification émetteur (prestataire).
// Équivaut au bloc ÉMETTEUR des skills legacy.
//
// Attendu dans `ctx.workspace` :
//   - name, legalForm, siret, address, email
//   - tvaMention (ex: "TVA non applicable, art. 293 B du CGI")
//   - iban (optionnel, string ou none)
//   - apeCode (optionnel, ex "6201Z")
//   - tvaIntracom (optionnel, n° TVA intracom si assujetti)

#import "../base.typ": color-accent, color-dark, color-gray, size-sm, size-md, size-lg

#let header-workspace(ws) = {
  set text(fill: color-dark, size: size-sm)
  [
    #text(size: size-sm, fill: color-gray, weight: "bold")[ÉMETTEUR]
    #v(4pt)
    #text(size: size-md, weight: "bold")[#ws.name]
    #v(2pt)
    #text(size: size-sm)[#ws.legalForm]
    #v(2pt)
    #text(size: size-sm)[#ws.address]
    #v(2pt)
    #text(size: size-sm)[SIRET : #ws.siret]
  ]
  if ws.at("apeCode", default: none) != none and ws.apeCode != "" [
    #v(2pt)
    #text(size: size-sm)[Code APE : #ws.apeCode]
  ]
  if ws.at("tvaIntracom", default: none) != none and ws.tvaIntracom != "" [
    #v(2pt)
    #text(size: size-sm)[TVA intracom. : #ws.tvaIntracom]
  ]
  [
    #v(2pt)
    #text(size: size-sm)[#ws.tvaMention]
    #v(2pt)
    #text(size: size-sm)[#ws.email]
  ]
}
