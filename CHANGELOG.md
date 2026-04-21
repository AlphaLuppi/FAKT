# Changelog

Toutes les modifications notables de FAKT sont documentées dans ce fichier.

Ce projet suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et [Semantic Versioning 2.0.0](https://semver.org/lang/fr/).

---

## [Unreleased]

---

## [0.1.0] - 2026-05-12

Première release publique de FAKT. Milestone v0.1.0 PUBLIC atteint.
Toutes les fonctionnalités core du MVP sont présentes et testées.

### Added

#### Onboarding
- Wizard premier lancement : nom workspace, régime fiscal (micro-entreprise), SIRET, adresse.
- Génération automatique du certificat X.509 auto-signé au premier lancement, stocké dans le keychain OS.
- Page paramètres workspace : édition des informations légales + gestion du certificat.

#### Gestion clients
- CRUD complet clients : nom légal, forme sociale, SIRET, adresse, contact, email, secteur.
- Liste clients triable et filtrable (nom, secteur, date création).
- Affichage détail client avec timeline des documents associés.

#### Bibliothèque de prestations
- CRUD prestations réutilisables : libellé, unité, prix unitaire TTC, catégorie.
- Sélection rapide depuis la bibliothèque lors de la création d'un devis ou d'une facture.

#### Devis
- Création de devis avec numérotation séquentielle automatique D{ANNÉE}-{SEQ:3}.
- Génération IA depuis un brief texte via Claude Code CLI en subprocess.
- Édition manuelle complète : client, lignes, remise, conditions, délai de validité.
- Rendu PDF déterministe via Typst — fidèle aux templates des skills originaux.
- Pipeline de statuts : brouillon → envoyé → signé / refusé.
- Vue détail avec split-pane : preview PDF + actions contextuelles.
- Dashboard composer IA sidebar (420px) avec historique par document.

#### Factures
- Conversion devis signé → facture en un clic, numérotation F{ANNÉE}-{SEQ:3}.
- Création manuelle directe.
- Suivi statuts : brouillé → envoyée → payée / en retard.
- Mentions légales obligatoires françaises pré-remplies (art. 289 CGI) : SIRET, forme juridique, pénalités retard, indemnité forfaitaire 40 €, mention TVA non applicable art. 293 B CGI.
- Soft delete uniquement — aucune suppression physique des factures émises (archivage 10 ans).

#### Signature PAdES avancée (eIDAS AdES-B-T)
- Signature cryptographique intégrée au PDF via lopdf + RSA 4096 + structure CMS.
- Horodatage RFC 3161 via FreeTSA (configurable vers autre TSA dans les paramètres).
- Audit trail append-only SQLite avec chaîne de hash SHA-256 (inviolable, vérifiable).
- Certificat X.509 auto-signé stocké dans le keychain OS (Windows Credential Manager / macOS Keychain / Linux Secret Service).
- PDF signé vérifiable dans Adobe Reader avec mention « Signé par {nom} ».

#### Email
- Générateur brouillon .eml RFC 5322 avec PDF en pièce jointe (base64 encodé).
- 4 templates FR : envoi devis, envoi facture, relance retard, remerciement paiement.
- Sélection de template + édition inline du sujet et du corps avant envoi.
- Ouverture via le client mail par défaut de l'OS (xdg-open / open / start /cmd).
- Fallback automatique mailto: si aucun handler .eml disponible.

#### Archive et compliance
- Route /archive avec vue des documents archivés.
- Export ZIP workspace en un clic : clients.csv + prestations.csv + PDFs devis + PDFs factures + README compliance.
- README compliance intégré au ZIP (Art. L123-22 Code Commerce + Art. 286 CGI + archivage 10 ans).
- Historique des exports dans la table backups.

#### Dashboard et UI
- Dashboard KPIs : CA signé mensuel, devis en attente, montants à encaisser, taux de signature.
- Activity feed temps réel : les dernières actions sur tous les documents.
- Filtres avancés sur listes devis et factures (statut, client, période, montant).
- Design system Brutal Invoice strict : noir/papier/jaune, Space Grotesk UPPERCASE, ombres plates, zéro radius.

#### Infra et release
- CI GitHub Actions matrix 3 OS (ubuntu + macos + windows) : lint + typecheck + test + build + cargo check.
- Workflow release tauri-action@v2 : .msi Windows, .dmg macOS, .AppImage + .deb Linux.
- Landing page statique `fakt.alphaluppi.com` avec hero, 3 features, CTA OS, badges conformité.
- Documentation Mintlify : introduction, installation, premier devis, premier facture, signature, architecture.

### Security

- Signature PAdES niveau eIDAS avancé (AdES-B-T) — **non qualifiée** (qualification impossible sans accréditation ANSSI, hors scope).
- Audit trail append-only : aucun UPDATE ni DELETE autorisé sur la table `audit_events` (trigger SQL).
- Clé privée RSA 4096 stockée exclusivement dans le keychain OS — jamais en base de données, jamais en fichier plat.
- Zéro secret hardcodé dans le code source ou les workflows CI.
- Input utilisateur validé via Zod (frontend) + guards Rust (backend) avant insertion DB.

### Known Issues

- **Windows installer non signé** : l'installeur `.msi` v0.1.0 ne porte pas de signature Authenticode.
  Windows SmartScreen affichera « Unknown Publisher » à l'installation.
  Contournement : clic droit → Exécuter quand même.
  La signature Authenticode sera ajoutée en v0.1.1.

- **Playwright E2E coverage limitée** : les tests E2E Playwright se limitent à un smoke test de démarrage
  (fenêtre visible, titre « FAKT », zéro erreur console critique).
  La couverture complète du flow devis → signer → draft email sera ajoutée en v0.1.1.

- **Composer session non persistée sur disque** : l'historique du composer IA est conservé en mémoire
  pour la session en cours mais n'est pas persisté en base de données.
  À la fermeture de l'app ou du panneau, l'historique est perdu.
  Persistance en v0.2 avec table `composer_sessions`.

- **macOS : notarisation conditionnelle** : si les secrets Apple Developer Program ne sont pas configurés
  dans GitHub Secrets au moment du tag v0.1.0, le .dmg sera créé mais non notarisé.
  Gatekeeper affichera un avertissement. Contournement : clic droit → Ouvrir.

---

[Unreleased]: https://github.com/AlphaLuppi/FAKT/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AlphaLuppi/FAKT/releases/tag/v0.1.0
