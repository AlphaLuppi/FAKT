# Fonctionnalités FAKT

**Audience :** Freelance · Investisseur · Décideur
**Résumé :** Liste exhaustive des fonctionnalités, par version et statut.
**Dernière mise à jour :** 2026-04-25

---

## v0.1 — MVP solo desktop (livré)

### Devis

- ✅ Création de devis avec numérotation séquentielle automatique (`D2026-XXX`)
- ✅ Gestion d'états : `draft` → `sent` → `viewed` → `signed` / `refused` / `expired`
- ✅ Lignes de prestations depuis bibliothèque ou saisie manuelle
- ✅ Calcul automatique HT/TVA/TTC (TVA = 0 par défaut micro-entreprise)
- ✅ Conditions de paiement, date de validité, notes
- ✅ Conversion devis signé → facture en un clic

### Factures

- ✅ Création de facture avec numérotation séquentielle automatique (`F2026-XXX`)
- ✅ Types : facture indépendante / acompte / solde / totale
- ✅ Mentions légales obligatoires automatiques (SIRET, forme juridique, adresse, échéance, pénalités retard, indemnité forfaitaire 40€, mention TVA)
- ✅ Cycle de vie : `draft` → `sent` → `paid` / `overdue` / `cancelled`
- ✅ Suivi paiement : date, méthode (virement / chèque / espèces / autre), notes
- ✅ Lien `quote_id` pour traçabilité devis → facture

### Signature électronique

- ✅ **Signature PAdES B-T** maison en Rust (eIDAS Avancée — AdES)
- ✅ RSA 4096 + SHA-256 + cert X.509 stocké dans le keychain OS
- ✅ Horodatage RFC 3161 via FreeTSA (TSA gratuite européenne)
- ✅ Audit trail SHA-256 chaîné (chaque signature lie au hash de la précédente)
- ✅ Vérification intégrée + vérifiable dans Adobe Reader / Foxit
- ✅ Capture signature manuscrite (canvas) intégrée au PDF

### IA

- ✅ Extraction de devis depuis un brief client (subprocess Claude Code CLI)
- ✅ Rédaction assistée de relances paiement
- ✅ Sessions IA stockées localement (`app_data_dir/ai-sessions.json`)
- ✅ Votre propre token Anthropic — vos données ne quittent jamais votre machine

### Email

- ✅ Brouillon `.eml` RFC 5322 avec PDF en pièce jointe
- ✅ Ouvert via le client mail de l'OS (Outlook, Apple Mail, Thunderbird)
- ✅ 4 templates FR : envoi devis, envoi facture, relance amiable, relance ferme
- ✅ Mailto: fallback si pas de client mail configuré

### Rendu PDF

- ✅ Templates Typst déterministes (fidèles aux skills Claude Code originaux)
- ✅ Header personnalisé (logo, nom, SIRET, adresse)
- ✅ Tableau lignes avec totaux HT/TVA/TTC
- ✅ Mentions légales en pied de page
- ✅ Bloc signature avec image manuscrite + métadonnées PAdES

### Archive et compliance

- ✅ Archivage 10 ans (CGI) — soft delete uniquement, jamais de hard delete
- ✅ Export ZIP workspace (clients.csv + prestations.csv + tous PDFs signés + audit.csv)
- ✅ Numérotation séquentielle atomique sans trous (CGI art. 289)
- ✅ Mentions légales paramétrables (TVA, pénalités, indemnité forfaitaire)

### Dashboard

- ✅ KPIs : devis en cours, factures émises, encaissé du mois, en attente
- ✅ Activity feed (chronologie des actions sur tous les documents)
- ✅ Recherche globale (clients, devis, factures)

### Workspace

- ✅ Configuration légale (nom, forme, SIRET, adresse, IBAN, mention TVA)
- ✅ Wizard d'onboarding (~2 min)
- ✅ Bibliothèque de prestations réutilisables (jour / heure / forfait / unité / mois / semaine)
- ✅ Gestion clients complète

### Design system

- ✅ **Brutal Invoice** : noir / papier / jaune. Space Grotesk UPPERCASE. Zéro radius. Ombres plates 3/5/8px.
- ✅ Identifie immédiatement FAKT (pas de Material / shadcn générique)

### Updater

- ✅ Auto-update Tauri (Ed25519 signed)
- ✅ Notification dans l'app quand une nouvelle version est dispo

### Plateformes

- ✅ Windows (.msi)
- ✅ macOS (Universal Intel + Apple Silicon, .dmg)
- ✅ Linux (.AppImage et .deb)

## v0.2 — Self-host entreprise (en cours)

- 🚧 Backend Postgres déployable (Docker + Caddy)
- 🚧 Auth multi-user (email + password + JWT, prep Google OAuth)
- 🚧 Web UI responsive (réutilise le bundle desktop)
- 🚧 Distribution app desktop pré-configurée AlphaLuppi
- 🚧 Migration data SQLite local → Postgres distant

Détails : [self-hosting.md](self-hosting.md), [roadmap.md](roadmap.md).

## v0.3+ — SaaS hébergé (planifié)

- 📅 Multi-tenant SaaS hébergé sur fakt.alphaluppi.fr
- 📅 OAuth (Google, GitHub) + magic links
- 📅 Stripe billing
- 📅 Workspaces multiples (holding + filiales)
- 📅 Remote signing avec HSM (signature serveur eIDAS)
- 📅 API publique pour intégrations (Indy, Tiime, EBP)

## Hors scope (jamais)

- ❌ Comptabilité complète (FAKT n'est pas un logiciel de compta — il s'intègre avec Indy / Tiime / EBP)
- ❌ Paiement en ligne (FAKT facture, vous percevez via votre banque)
- ❌ CRM avancé (FAKT a juste les clients, pas de pipeline commercial)
- ❌ Stockage cloud propriétaire (vos PDFs restent chez vous)

## Légende

- ✅ Disponible et stable
- 🚧 En cours d'implémentation
- 📅 Planifié, non commencé
- ❌ Hors scope par design
