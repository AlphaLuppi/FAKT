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
    newMenu: {
      manual: "Saisie manuelle",
      ai: "Avec l'IA",
    },
    modes: {
      manual: "Manuel",
      ai: "IA",
    },
    status: {
      draft: "Brouillon",
      sent: "Envoyé",
      viewed: "Vu",
      signed: "Signé",
      refused: "Refusé",
      expired: "Expiré",
    },
    statusFilters: {
      all: "Tous",
      draft: "Brouillons",
      sent: "Envoyés",
      viewed: "Vus",
      signed: "Signés",
      refused: "Refusés",
      expired: "Expirés",
    },
    actions: {
      issue: "Émettre et attribuer un numéro",
      send: "Envoyer",
      duplicate: "Dupliquer",
      createInvoice: "Créer une facture",
      archive: "Archiver",
      cancel: "Annuler",
      edit: "Éditer",
      downloadPdf: "Télécharger le PDF",
      sign: "Signer",
      saveDraft: "Enregistrer brouillon",
      createAndIssue: "Créer et attribuer numéro",
      backToList: "Retour à la liste",
    },
    labels: {
      number: "Numéro",
      numberPending: "—",
      client: "Client",
      title: "Objet",
      totalHt: "Total HT",
      totalTtc: "Total TTC",
      issuedAt: "Émis le",
      validityDate: "Valide jusqu'au",
      signedAt: "Signé le",
      createdAt: "Créé le",
      status: "Statut",
      actions: "Actions",
      notes: "Notes",
      conditions: "Conditions",
      mode: "Mode",
    },
    form: {
      clientPlaceholder: "Choisir un client",
      clientQuickNew: "Nouveau client rapide",
      titlePlaceholder: "Objet du devis",
      issueDate: "Date d'émission",
      validityDays: "Validité (jours)",
      validityDateLabel: "Valable jusqu'au",
      addItem: "Ajouter une ligne",
      removeItem: "Supprimer",
      moveUp: "Monter",
      moveDown: "Descendre",
      description: "Description",
      quantity: "Quantité",
      unit: "Unité",
      unitPrice: "Prix unitaire HT",
      lineTotal: "Total HT",
      vatDisabled: "TVA non applicable",
      vatNote: "TVA non applicable, art. 293 B du CGI (micro-entreprise)",
      noItems: "Aucune ligne. Ajoute une première prestation.",
      prestationPicker: "Bibliothèque de prestations",
      prestationPickerHint:
        "Choisis une prestation pour remplir automatiquement la ligne.",
      notesPlaceholder: "Conditions, modalités, note interne au client…",
      notesLabel: "Notes libres affichées sur le devis",
      emptyClientList: "Aucun client trouvé.",
      quickClientName: "Nom du client",
      quickClientEmail: "Email",
      quickClientCreate: "Créer le client",
      quickClientStub:
        "La création rapide de client sera disponible avec Track G.",
    },
    search: {
      placeholder: "Rechercher un devis…",
    },
    ai: {
      briefLabel: "Colle ton brief, email ou description de la mission",
      briefPlaceholder:
        "Ex : Nouveau brief de Maison Berthe. Ils veulent un e-shop avec click & collect pour la pâtisserie. Budget évoqué : 7-8 k€. Livraison avant la fête des mères.",
      extract: "Extraire",
      extracting: "Claude analyse le brief…",
      cancel: "Annuler",
      cliMissingTitle: "Claude CLI non détecté",
      cliMissingDetail:
        "Installe Claude Code CLI pour utiliser l'IA, ou crée ton devis manuellement.",
      goSettings: "Configurer Claude",
      goManual: "Saisir manuellement",
      extractedTitle: "Informations extraites",
      extractedClient: "Client proposé",
      extractedItems: "Lignes proposées",
      extractedTotal: "Total HT estimé",
      applyAndEdit: "Utiliser cet extrait",
    },
    detail: {
      previewTitle: "Aperçu PDF",
      infosTitle: "Informations",
      noPdf:
        "Aucun PDF disponible. Émettez le devis pour attribuer un numéro.",
      noPdfDraft:
        "Ce devis est en brouillon — aucun numéro n'a été attribué.",
      signedOn: "Signé le",
      draftOnlyEdit: "Seuls les devis en brouillon peuvent être édités.",
    },
    empty: "Aucun devis pour le moment. Crée ton premier devis avec l'IA.",
    errors: {
      noItems: "Ajoute au moins une ligne au devis.",
      missingClient: "Choisis un client avant de créer le devis.",
      missingTitle: "L'objet du devis est obligatoire.",
      notFound: "Devis introuvable.",
      pdfFailed: "Impossible de générer le PDF.",
      loadFailed: "Impossible de charger le devis.",
      createFailed: "La création du devis a échoué.",
      saveFailed: "L'enregistrement du devis a échoué.",
    },
    footer: {
      signature: "Bon pour accord - signature du client",
    },
  },

  invoices: {
    title: "Factures",
    new: "Nouvelle facture",
    newMenu: {
      fromQuote: "Depuis un devis",
      fromScratch: "Facture libre",
    },
    modes: {
      fromQuote: "Depuis un devis signé",
      fromScratch: "Facture libre (sans devis)",
    },
    status: {
      draft: "Brouillon",
      sent: "Envoyée",
      paid: "Payée",
      overdue: "En retard",
      cancelled: "Annulée",
    },
    statusFilters: {
      all: "Toutes",
      draft: "Brouillons",
      sent: "Envoyées",
      paid: "Payées",
      overdue: "En retard",
      cancelled: "Annulées",
    },
    kind: {
      deposit: "Acompte",
      balance: "Solde",
      total: "Facture totale",
      independent: "Facture libre",
    },
    kindRadios: {
      deposit30: "Acompte 30 %",
      balance: "Solde restant",
      full: "Facture totale",
      deposit30Hint:
        "Génère une facture d'acompte de 30 % du montant HT du devis.",
      balanceHint:
        "Facture le solde restant après les acomptes déjà émis.",
      fullHint: "Recopie toutes les lignes du devis pour une facture totale.",
    },
    actions: {
      issue: "Émettre",
      send: "Envoyer",
      markPaid: "Marquer payée",
      archive: "Archiver",
      cancel: "Annuler",
      edit: "Éditer",
      downloadPdf: "Télécharger le PDF",
      saveDraft: "Enregistrer brouillon",
      createAndIssue: "Créer et émettre",
      backToList: "Retour à la liste",
      createCreditNote: "Créer un avoir",
      delete: "Supprimer",
    },
    labels: {
      number: "Numéro",
      numberPending: "—",
      client: "Client",
      title: "Objet",
      totalHt: "Total HT",
      totalTtc: "Total TTC",
      issuedAt: "Émise le",
      dueDate: "Échéance",
      paidAt: "Payée le",
      createdAt: "Créée le",
      status: "Statut",
      actions: "Actions",
      notes: "Notes",
      paymentMethod: "Moyen de paiement",
      kind: "Type",
      quoteLink: "Devis lié",
    },
    form: {
      selectQuote: "Choisir un devis signé",
      selectQuoteHint:
        "Seuls les devis signés peuvent être convertis en facture.",
      noSignedQuote:
        "Aucun devis signé disponible. Signez d'abord un devis.",
      chooseMode: "Mode de facturation",
      titlePlaceholder: "Objet de la facture",
      issueDate: "Date d'émission",
      dueDays: "Échéance (jours)",
      dueDateLabel: "Date d'échéance",
      paymentMethodPlaceholder: "Choisir un moyen de paiement",
      paymentMethods: {
        wire: "Virement bancaire",
        card: "Carte bancaire",
        cash: "Espèces",
        check: "Chèque",
        other: "Autre",
      },
      legalMentionsTitle: "Mentions légales obligatoires",
      legalMentionsHint:
        "Ces mentions seront automatiquement ajoutées au PDF (CGI art. 289).",
      depositLabel: (quoteNumber: string) =>
        `Acompte 30 % sur devis ${quoteNumber}`,
      balanceLabel: (quoteNumber: string) =>
        `Solde de la facturation du devis ${quoteNumber}`,
      notesPlaceholder: "Remarques pour le client, conditions particulières…",
      quickClientNew: "Nouveau client rapide",
      quickClientStub:
        "La création rapide de client sera disponible avec Track G.",
    },
    search: {
      placeholder: "Rechercher une facture…",
    },
    detail: {
      previewTitle: "Aperçu PDF",
      infosTitle: "Informations",
      noPdf:
        "Aucun PDF disponible. Émettez la facture pour attribuer un numéro.",
      noPdfDraft:
        "Cette facture est en brouillon — aucun numéro n'a été attribué.",
      draftOnlyEdit:
        "Seules les factures en brouillon peuvent être éditées.",
      issuedNotEditable:
        "Facture émise, non modifiable. Utilisez 'Créer un avoir' pour correction.",
      creditNoteTodo:
        "La création d'avoirs sera disponible en v0.2.",
      archivalLegalNotice:
        "Archivage légal obligatoire (10 ans — CGI). Utilisez 'Créer un avoir' pour corriger.",
    },
    empty: "Aucune facture pour le moment.",
    errors: {
      noItems: "Ajoute au moins une ligne à la facture.",
      missingClient: "Choisis un client avant de créer la facture.",
      missingTitle: "L'objet de la facture est obligatoire.",
      missingQuote: "Sélectionne un devis signé.",
      notFound: "Facture introuvable.",
      pdfFailed: "Impossible de générer le PDF.",
      loadFailed: "Impossible de charger la facture.",
      createFailed: "La création de la facture a échoué.",
      saveFailed: "L'enregistrement de la facture a échoué.",
      deleteIssued:
        "Les factures émises ne peuvent pas être supprimées (archivage légal 10 ans).",
      balanceZero:
        "Le solde est nul ou négatif — les acomptes couvrent déjà le total.",
    },
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

  search: {
    placeholder: "Recherche",
    hint: "Clients, prestations, devis, factures…",
    noResults: "Aucun résultat",
    categories: {
      clients: "Clients",
      prestations: "Prestations",
      devis: "Devis",
      factures: "Factures",
    },
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
    tabs: {
      identity: "Identité",
      cli: "Claude CLI",
      certificate: "Certificat",
      telemetry: "Télémétrie",
    },
    save: "Enregistrer",
    saved: "Enregistré",
    workspace: {
      title: "Votre entreprise",
      name: "Nom ou raison sociale",
      legalForm: "Forme juridique",
      siret: "SIRET",
      address: "Adresse complète",
      email: "Email de facturation",
      iban: "IBAN (pour les factures)",
      phone: "Téléphone",
    },
    cli: {
      title: "Claude Code CLI",
      description:
        "Claude Code CLI permet à FAKT de générer des devis depuis un brief textuel.",
      status: "État",
      recheck: "Vérifier à nouveau",
      openInstallPage: "Ouvrir la page d'installation",
      docLink: "Documentation Claude Code",
    },
    certificate: {
      title: "Certificat de signature",
      generate: "Générer un certificat",
      rotate: "Régénérer le certificat",
      generated: "Certificat actif",
      expiry: "Valide jusqu'au",
      dn: "Identifiant (DN)",
      fingerprint: "Empreinte SHA-256",
      validityRemaining: (years: number, months: number) =>
        `Encore ${years} an${years > 1 ? "s" : ""} et ${months} mois`,
      rotateWarningTitle: "Régénérer le certificat ?",
      rotateWarningBody:
        "Votre ancien certificat sera archivé. Les signatures émises avant restent valides via l'audit trail, mais toute nouvelle signature utilisera le nouveau certificat. Cette action est irréversible.",
      rotateConfirm: "Confirmer la régénération",
      rotateCancel: "Annuler",
    },
    telemetry: {
      title: "Télémétrie & Avancé",
      description:
        "Aide à améliorer FAKT en envoyant des statistiques d'usage anonymes. Désactivable à tout moment.",
      optIn: "Activer la télémétrie anonyme (Plausible)",
      optOut: "Désactivée",
      verboseLogs: "Afficher les logs verbeux (debug)",
      verboseLogsHint: "Active les logs détaillés dans la console Tauri.",
      appVersion: "Version de l'application",
      githubIssues: "Signaler un problème (GitHub)",
      changelog: "Journal des modifications",
    },
  },

  onboarding: {
    title: "Bienvenue dans FAKT",
    subtitle: "Configuration initiale — moins de 3 minutes",
    progress: (step: number, total: number) => `Étape ${step} sur ${total}`,
    prev: "Précédent",
    next: "Suivant",
    step1: {
      title: "Votre identité légale",
      description:
        "Ces informations apparaîtront sur tous vos documents. Elles doivent correspondre à votre SIRET.",
      fields: {
        name: "Nom ou raison sociale",
        legalForm: "Forme juridique",
        siret: "SIRET (14 chiffres)",
        address: "Adresse complète",
        email: "Email de facturation",
        iban: "IBAN (paiements)",
        phone: "Téléphone",
      },
      legalForms: {
        micro: "Micro-entreprise",
        ei: "EI",
        eurl: "EURL",
        sasu: "SASU",
        sas: "SAS",
        sarl: "SARL",
        sa: "SA",
        autre: "Autre",
      },
    },
    step2: {
      title: "Claude Code CLI",
      description:
        "FAKT peut utiliser Claude Code CLI pour générer des devis depuis un brief. C'est optionnel — vous pouvez créer des documents manuellement.",
      checking: "Vérification en cours…",
      detected: "Claude CLI détecté",
      version: "Version",
      path: "Chemin",
      missing: "Claude CLI non détecté",
      openInstallPage: "Ouvrir la page d'installation",
      recheck: "Vérifier à nouveau",
      skipLabel: "Je configurerai Claude plus tard",
      skipHint: "Vous pouvez configurer Claude CLI à tout moment dans les paramètres.",
    },
    step3: {
      title: "Certificat de signature",
      description:
        "FAKT génère un certificat X.509 auto-signé pour signer vos documents électroniquement. Il est stocké dans le trousseau de clés de votre OS.",
      generate: "Générer mon certificat",
      generating: "Génération en cours… (RSA 4096 bits, quelques secondes)",
      generated: "Certificat généré",
      dn: "Identifiant",
      fingerprint: "Empreinte SHA-256",
      validFrom: "Valide du",
      validUntil: "au",
      storedIn: "Stocké dans",
      keychain: "Trousseau OS",
      fallbackFile: "Fichier chiffré",
      retry: "Réessayer",
    },
    step4: {
      title: "Tout est prêt",
      description: "Voici un récapitulatif de votre configuration.",
      identity: "Identité",
      cli: "Claude CLI",
      certificate: "Certificat",
      cliReady: "Prêt",
      cliSkipped: "À configurer",
      certActive: "Actif",
    },
    finish: "C'est parti !",
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
