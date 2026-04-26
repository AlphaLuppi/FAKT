// signature-block.typ — Bloc signature double (Prestataire / Client).
// Utilisé sur les devis pour permettre la signature manuscrite ou l'intégration
// d'une signature image (PAdES se branche en W3 via audit_events).
//
// Attendu :
//   - workspaceName (string)
//   - clientName (string)
//   - signatureImage : optionnel, chemin relatif PNG (ex "signature.png") ou none
//   - signedAt : optionnel, string (date FR longue) ou none
//   - padesLevel : optionnel, label de niveau eIDAS (ex "AdES-B-T") ou none

#import "../base.typ": color-accent, color-dark, color-gray, size-sm, size-md

#let signature-block(
  workspaceName: "",
  clientName: "",
  signatureImage: none,
  signedAt: none,
  padesLevel: none,
) = {
  let has-signature = signatureImage != none and signatureImage != ""

  grid(
    columns: (1fr, 1fr),
    gutter: 20pt,
    // Colonne gauche — Prestataire
    [
      #text(size: size-md, fill: color-accent, weight: "bold")[Le Prestataire]
      #v(4pt)
      #text(size: size-sm, fill: color-dark)[#workspaceName]
      #v(8pt)
      #if signedAt != none and signedAt != "" [
        #text(size: size-sm, fill: color-gray)[Date : #signedAt]
      ] else [
        #text(size: size-sm, fill: color-gray)[Date :]
      ]
      #v(6pt)
      #text(size: size-sm, fill: color-gray)[Signature :]
      #v(2pt)
      #if has-signature [
        #image(signatureImage, width: 60%)
        #if padesLevel != none and padesLevel != "" [
          #v(2pt)
          #text(size: 7pt, fill: color-gray, style: "italic")[
            Signature électronique avancée — eIDAS #padesLevel
          ]
        ]
      ] else [
        #v(20pt)
      ]
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
      #text(size: size-sm, fill: color-gray)[Date :]
      #v(20pt)
      #text(size: size-sm, fill: color-gray)[Signature :]
    ],
  )
}
