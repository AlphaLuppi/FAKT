// legal-mentions.typ — Mentions légales obligatoires (factures FR-016).
//
// Pour une facture micro-entreprise, doivent apparaître SYSTÉMATIQUEMENT :
//   - Pénalités de retard L441-10 Code de commerce
//   - Indemnité forfaitaire 40 € D441-5
//   - Pas d'escompte pour paiement anticipé
//   - TVA non applicable art. 293 B du CGI
//   - Référence au devis si lié
//
// Source : packages/legal/src/mentions.ts et docs/prd.md FR-016.
//
// Usage : le bloc attend `ctx.legalMentions` déjà assemblé côté TS (snapshot DB).
// On l'affiche tel quel, formatté en paragraphes, + les dash-items standards.

#import "../base.typ": color-dark, color-gray, size-sm, h2, dash-item-bold

#let legal-mentions(mentions: "", extras: ()) = {
  h2("Mentions légales")

  // Si le snapshot de mentions est fourni, on préserve ses lignes.
  if mentions != none and mentions != "" {
    // Chaque ligne du snapshot = une ligne gris clair.
    for line in mentions.split("\n") {
      if line.trim() != "" {
        block(
          above: 0.3em,
          below: 0.3em,
          text(size: size-sm, fill: color-dark)[#line],
        )
      }
    }
  }

  // Mentions supplémentaires explicites (dash-items).
  for extra in extras {
    dash-item-bold(extra.label, extra.value)
  }
}
