// signature-block.typ — Bloc signature double (Prestataire / Client).
// Utilisé sur les devis pour permettre la signature manuscrite ou l'intégration
// d'une signature image (PAdES se branche en W3 via audit_events).
//
// Attendu :
//   - workspaceName (string)
//   - clientName (string)
//   - signatureImage : optionnel, string base64 data URI ou none
//   - signedAt : optionnel, string (date FR longue) ou none

#import "../base.typ": color-accent, color-dark, color-gray, size-sm, size-md

#let signature-block(
  workspaceName: "",
  clientName: "",
  signatureImage: none,
  signedAt: none,
) = {
  grid(
    columns: (1fr, 1fr),
    gutter: 20pt,
    // Colonne gauche — Prestataire
    [
      #text(size: size-md, fill: color-accent, weight: "bold")[Le Prestataire]
      #v(4pt)
      #text(size: size-sm, fill: color-dark)[#workspaceName]
      #v(20pt)
      #text(size: size-sm, fill: color-gray)[Date :]
      #v(20pt)
      #text(size: size-sm, fill: color-gray)[Signature :]
    ],
    // Colonne droite — Client
    [
      #text(size: size-md, fill: color-accent, weight: "bold")[Le Client]
      #v(4pt)
      #text(size: size-sm, fill: color-dark)[#clientName]
      #v(4pt)
      #text(size: size-sm, fill: color-dark, style: "italic")[
        « Bon pour accord »
      ]
      #v(8pt)
      #if signedAt != none and signedAt != "" [
        #text(size: size-sm, fill: color-gray)[Date : #signedAt]
      ] else [
        #text(size: size-sm, fill: color-gray)[Date :]
      ]
      #v(20pt)
      #text(size: size-sm, fill: color-gray)[Signature :]
    ],
  )
}
