// quote-legal.typ — Mentions légales / CGV obligatoires pour un devis FR.
//
// Source de vérité : skill legacy /devis-freelance (CGV obligatoires droit
// français) + docs/prd.md FR-016 + skill /facture-freelance (pénalités L441-10,
// indemnité D441-5, mention TVA 293 B).
//
// Ces mentions doivent systématiquement figurer sur tout devis pour assurer
// sa recevabilité juridique et sa valeur contractuelle une fois signé.

#import "../base.typ": (
  color-dark, color-gray, size-sm, h1, h2, dash-item-bold,
)

// Bloc CGV légales — tous les points non négociables.
// Paramètres optionnels :
//   - validityDays : durée de validité du devis (défaut 90)
//   - paymentDays  : délai de paiement (défaut 30)
//   - advancePct   : acompte en % (défaut 30)
//   - tvaMention   : mention TVA à afficher (défaut micro-entreprise 293 B)
#let quote-legal(
  validityDays: 90,
  paymentDays: 30,
  advancePct: 30,
  tvaMention: "TVA non applicable, art. 293 B du CGI",
) = {
  h1("Conditions générales de vente")

  // ── Facturation & paiement ──────────────────────────────────────────────
  h2("Facturation & paiement")
  dash-item-bold(
    "Acompte :",
    [#advancePct % à la commande, solde à la livraison.],
  )
  dash-item-bold(
    "Délai de paiement :",
    [#paymentDays jours à compter de la date d'émission de la facture.],
  )
  dash-item-bold(
    "Mode de paiement :",
    [virement bancaire sur le compte indiqué sur la facture.],
  )
  dash-item-bold(
    "Pénalités de retard :",
    [en cas de retard de paiement, application de pénalités au taux de la BCE majoré de 10 points (article L441-10 du Code de commerce).],
  )
  dash-item-bold(
    "Indemnité forfaitaire :",
    [40 € pour frais de recouvrement (article D441-5 du Code de commerce).],
  )
  dash-item-bold(
    "TVA :",
    [#tvaMention.],
  )
  dash-item-bold(
    "Pas d'escompte",
    [pour paiement anticipé.],
  )

  // ── Propriété intellectuelle ────────────────────────────────────────────
  h2("Propriété intellectuelle")
  dash-item-bold(
    "PI conservée",
    [par le Prestataire jusqu'au paiement intégral de la mission.],
  )
  dash-item-bold(
    "Cession des droits patrimoniaux",
    [au paiement complet de la facture finale.],
  )
  dash-item-bold(
    "Code source",
    [librement réutilisable par le Client après paiement intégral.],
  )

  // ── Obligation de collaboration ─────────────────────────────────────────
  h2("Collaboration du Client")
  dash-item-bold(
    "Réactivité :",
    [retour sur livrables sous 5 jours ouvrés.],
  )
  dash-item-bold(
    "Retard Client",
    [entraîne un décalage calendrier sans responsabilité du Prestataire.],
  )

  // ── Garantie & responsabilité ───────────────────────────────────────────
  h2("Garantie & responsabilité")
  dash-item-bold(
    "Garantie :",
    [30 jours post-validation sur l'environnement de recette.],
  )
  dash-item-bold(
    "Responsabilité",
    [limitée au montant HT de la mission. Dommages indirects exclus.],
  )

  // ── Résiliation ─────────────────────────────────────────────────────────
  h2("Résiliation")
  dash-item-bold(
    "Mise en demeure",
    [15 jours par lettre recommandée avec accusé de réception.],
  )
  dash-item-bold(
    "Résiliation Client :",
    [prorata temporis + acompte acquis au Prestataire.],
  )

  // ── Confidentialité ─────────────────────────────────────────────────────
  h2("Confidentialité")
  dash-item-bold(
    "Engagement réciproque",
    [de confidentialité sur la durée de la mission et 2 ans après.],
  )

  // ── Loi applicable ──────────────────────────────────────────────────────
  h2("Loi applicable")
  dash-item-bold(
    "Droit français.",
    [Tout litige relèvera de la juridiction du tribunal compétent du siège du Prestataire.],
  )

  // ── Validité ────────────────────────────────────────────────────────────
  h2("Validité")
  dash-item-bold(
    "Devis valable",
    [#validityDays jours à compter de sa date d'émission.],
  )
}
