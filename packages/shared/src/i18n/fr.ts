/**
 * Dictionnaire i18n FR — source de vérité pour toutes les chaînes UI.
 * Ne jamais écrire de chaînes UI hardcodées côté composant — toujours passer par ce fichier.
 */

export const fr = {
  app: {
    name: "FAKT",
    tagline: "Devis et factures. Signé.",
  },

  nav: {
    dashboard: "Tableau de bord",
    quotes: "Devis",
    invoices: "Factures",
    clients: "Clients",
    services: "Prestations",
    settings: "Paramètres",
    newWithAi: "Nouveau avec l'IA",
  },

  dashboard: {
    title: "Tableau de bord",
    kpi: {
      signedRevenue: "CA signé",
      pendingQuotes: "Devis en attente",
      pendingPayments: "À encaisser",
      signatureRate: "Taux signature 90j",
    },
    todo: {
      invoicesToIssue: (n: number) => `${n} facture${n > 1 ? "s" : ""} à émettre`,
      reminderToSend: (n: number) => `${n} relance${n > 1 ? "s" : ""} à envoyer`,
      quotesToFollow: (n: number) => `${n} devis à relancer`,
    },
  },

  quotes: {
    title: "Devis",
    new: "Nouveau devis",
    status: {
      draft: "Brouillon",
      sent: "Envoyé",
      viewed: "Vu",
      signed: "Signé",
      refused: "Refusé",
      expired: "Expiré",
    },
    actions: {
      issue: "Émettre",
      send: "Envoyer",
      duplicate: "Dupliquer",
      createInvoice: "Créer une facture",
      archive: "Archiver",
      cancel: "Annuler",
    },
    labels: {
      number: "Numéro",
      client: "Client",
      title: "Objet",
      totalHt: "Total HT",
      issuedAt: "Émis le",
      validityDate: "Valide jusqu'au",
      signedAt: "Signé le",
    },
    empty: "Aucun devis pour le moment. Crée ton premier devis avec l'IA.",
  },

  invoices: {
    title: "Factures",
    new: "Nouvelle facture",
    status: {
      draft: "Brouillon",
      sent: "Envoyée",
      paid: "Payée",
      overdue: "En retard",
      cancelled: "Annulée",
    },
    kind: {
      deposit: "Acompte",
      balance: "Solde",
      total: "Facture totale",
      independent: "Facture libre",
    },
    actions: {
      issue: "Émettre",
      send: "Envoyer",
      markPaid: "Marquer payée",
      archive: "Archiver",
    },
    labels: {
      number: "Numéro",
      client: "Client",
      title: "Objet",
      totalHt: "Total HT",
      issuedAt: "Émise le",
      dueDate: "Échéance",
      paidAt: "Payée le",
    },
    empty: "Aucune facture pour le moment.",
  },

  clients: {
    title: "Clients",
    new: "Nouveau client",
    labels: {
      name: "Nom ou raison sociale",
      legalForm: "Forme juridique",
      siret: "SIRET",
      address: "Adresse",
      contactName: "Contact",
      email: "Email",
      sector: "Secteur",
      note: "Note interne",
    },
    empty: "Aucun client encore. Crée ton premier client.",
    actions: {
      edit: "Modifier",
      archive: "Archiver",
    },
  },

  services: {
    title: "Prestations",
    new: "Nouvelle prestation",
    labels: {
      name: "Nom de la prestation",
      description: "Description",
      unit: "Unité",
      unitPrice: "Prix unitaire HT",
      tags: "Tags",
    },
    units: {
      forfait: "Forfait",
      jour: "Jour",
      heure: "Heure",
      unite: "Unité",
      mois: "Mois",
      semaine: "Semaine",
    },
    empty: "Aucune prestation dans la bibliothèque.",
  },

  signature: {
    title: "Signature électronique",
    draw: "Dessiner ma signature",
    type: "Saisir mon nom",
    clear: "Effacer",
    sign: "Signer le document",
    signing: "Signature en cours…",
    signed: "Document signé",
    eidas: "Signature électronique avancée eIDAS — niveau AdES-B-T",
    certInfo: "Certificat X.509 auto-signé généré par FAKT",
  },

  ai: {
    title: "Composer IA",
    placeholder: "Colle ton brief, email ou description de la mission…",
    extracting: "Claude analyse le brief…",
    extracted: "Informations extraites",
    notAvailable: "Claude CLI non détecté",
    notAvailableDetail: "Installe Claude Code CLI pour utiliser l'IA.",
    installGuide: "Guide d'installation",
    createManually: "Créer manuellement",
  },

  settings: {
    title: "Paramètres",
    workspace: {
      title: "Votre entreprise",
      name: "Nom ou raison sociale",
      legalForm: "Forme juridique",
      siret: "SIRET",
      address: "Adresse complète",
      email: "Email de facturation",
      iban: "IBAN (pour les factures)",
    },
    certificate: {
      title: "Certificat de signature",
      generate: "Générer un certificat",
      generated: "Certificat actif",
      expiry: "Valide jusqu'au",
    },
    telemetry: {
      title: "Télémétrie anonyme",
      description:
        "Aide à améliorer FAKT en envoyant des statistiques d'usage anonymes. Désactivable à tout moment.",
      optIn: "Activer la télémétrie",
      optOut: "Désactiver",
    },
  },

  onboarding: {
    title: "Bienvenue dans FAKT",
    step1: {
      title: "Votre identité légale",
      description:
        "Ces informations apparaîtront sur tous vos documents. Elles doivent correspondre à votre SIRET.",
    },
    step2: {
      title: "Certificat de signature",
      description:
        "FAKT génère un certificat X.509 auto-signé pour signer vos documents. Il est stocké dans le trousseau de votre OS.",
      generate: "Générer mon certificat",
    },
    finish: "Commencer à facturer",
  },

  errors: {
    generic: "Une erreur inattendue est survenue.",
    network: "Impossible de contacter le service distant. Vérifiez votre connexion.",
    siretInvalid: "Le numéro SIRET est invalide (14 chiffres, clé Luhn incorrecte).",
    siretFormat: "Le SIRET doit contenir 14 chiffres sans espace.",
    numberingConflict:
      "Numéro de document déjà attribué. Rechargez la page et réessayez.",
    signatureFailed:
      "La signature a échoué. Vérifiez que votre certificat est valide et réessayez.",
    pdfRenderFailed:
      "La génération du PDF a échoué. Vérifiez les données du document et réessayez.",
    claudeCliNotFound:
      "Claude CLI introuvable. Installez-le via : https://docs.claude.com/en/docs/claude-code/overview",
    keychainError: "Impossible d'accéder au trousseau de clés de l'OS.",
    tsaError:
      "L'horodatage (TSA) a échoué. La signature sera de type PAdES-B (sans horodatage).",
    invoiceArchived:
      "Cette facture est archivée et ne peut pas être modifiée.",
    invoiceHardDeleteForbidden:
      "Les factures émises ne peuvent pas être supprimées (archivage légal 10 ans).",
    signatureEventsImmutable:
      "L'audit trail de signature est en lecture seule (append-only).",
  },

  legal: {
    tvaMicroEntreprise: "TVA non applicable, art. 293 B du CGI",
    latePenaltyRate:
      "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera appliquée.",
    lumpSumIndemnity:
      "Une indemnité forfaitaire de 40 € sera due pour frais de recouvrement en cas de retard (D. n° 2012-1115).",
    paymentConditions: (days: number) =>
      `Paiement à ${days} jours date de facture.`,
    siretLabel: "SIRET :",
    legalFormLabel: "Forme juridique :",
    addressLabel: "Adresse :",
    ibanLabel: "IBAN :",
    issuedAtLabel: "Émise le :",
    dueDateLabel: "Date d'échéance :",
    quoteValidityLabel: "Devis valable jusqu'au :",
    eSignatureNotice:
      "Signature électronique avancée eIDAS — niveau AdES-B-T. Référence audit trail disponible sur demande.",
  },

  format: {
    dateLocale: "fr-FR",
    currencyLocale: "fr-FR",
    currency: "EUR",
  },
} as const;

export type FrDict = typeof fr;
