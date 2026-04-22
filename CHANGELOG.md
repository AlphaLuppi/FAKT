# Changelog

Toutes les modifications notables de FAKT sont documentées dans ce fichier.

Ce projet suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et [Semantic Versioning 2.0.0](https://semver.org/lang/fr/).

---

## [0.1.0] - 2026-05-12

Première release publique de FAKT. Milestone v0.1.0 PUBLIC atteint.
Toutes les fonctionnalités core du MVP sont présentes et testées.

Cette release inclut le **refacto architectural sidecar** (bascule vers un binaire Bun
api-server) livré avant tag pour débloquer le câblage E2E identifié dans
[`docs/sprint-notes/e2e-wiring-audit.md`](docs/sprint-notes/e2e-wiring-audit.md). Les
entrées ci-dessous fusionnent le MVP initial et le refacto pré-tag.

### Added

#### Sidecar et architecture 3 modes

- **Sidecar Bun `packages/api-server/`** (Hono + Drizzle) exposant **55 endpoints REST**
  qui wrappent les queries existantes. Tauri spawn ce binaire au démarrage, port aléatoire,
  token 32 bytes partagé via `window.__FAKT_API_TOKEN` / `__FAKT_API_PORT`.
- **Mode 2 (self-host entreprise)** : wiring posé — même binaire api-server bundle Bun
  compile standalone, `DATABASE_URL=postgres://...` + `AUTH_MODE=jwt`. Déploiement complet
  reporté v0.2 (schema Postgres mirror + auth JWT/OAuth).
- **Architecture 3 modes documentée** : solo local SQLite, self-host VPS Postgres, SaaS
  hébergé Cloud Run. Voir [`README.md`](README.md#architecture), [`docs/architecture.md`](docs/architecture.md)
  et [`docs/refacto-spec/architecture.md`](docs/refacto-spec/architecture.md).
- **Script dev parallèle** : `bun run dev` lance désormais api-server (watch mode) +
  Tauri webview en parallèle, plus de boot manuel du sidecar (commit `b70a597`).
- **Bascule vers `bun:sqlite` + bootstrap migrations automatique** : retrait de la dep
  native `better-sqlite3` côté sidecar, le bundle Bun compiled gère nativement SQLite.
  Migrations lancées à chaque boot, idempotentes (commit `9715a90`).
- **Plugins officiels `tauri-plugin-fs` / `tauri-plugin-dialog` / `tauri-plugin-path`**
  enregistrés explicitement dans `apps/desktop/src-tauri/src/lib.rs` (commit `f32d089`).

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
- **Colonne `payment_notes`** sur la table `invoices` (migration `0003_payment_notes.sql`) :
  les notes saisies dans `MarkPaidModal` sont désormais persistées — conformité archivage 10 ans.

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
- **Activity feed temps réel** : événements métier (devis émis, facture payée, email brouillon,
  archive exportée) insérés dans la table `activity` via `POST /api/activity`.
- Filtres avancés sur listes devis et factures (statut, client, période, montant).
- Design system Brutal Invoice strict : noir/papier/jaune, Space Grotesk UPPERCASE, ombres plates, zéro radius.

#### Tests et conformité
- **Tests légaux FR obligatoires** : mentions factures (SIRET, TVA art. 293 B, pénalités
  retard, indemnité 40 €), numérotation séquentielle sans trou (BEGIN IMMEDIATE concurrence),
  refus hard-delete factures émises (trigger SQL), signature PAdES avancée non-qualifiée.

#### Infra et release
- CI GitHub Actions matrix 3 OS (ubuntu + macos + windows) : lint + typecheck + test + build + cargo check.
- Workflow release tauri-action@v2 : .msi Windows, .dmg macOS, .AppImage + .deb Linux.
- Landing page statique `fakt.alphaluppi.com` avec hero, 3 features, CTA OS, badges conformité.
- Documentation Mintlify : introduction, installation, premier devis, premier facture, signature, architecture.

### Changed

- **NFR-003 révisé : taille installer ~100 Mo** (anciennement ≤ 15 Mo). Cohérent avec les
  apps desktop modernes Slack / Discord / Obsidian (100-200 Mo). Un port Rust du sidecar
  est envisagé v0.2 pour réduire à ~20 Mo. Le critère release-blocking est fonctionnel
  (démarrage ≤ 2 s, app dogfoodable), pas la taille binaire. Voir addendum en tête de
  [`docs/architecture.md`](docs/architecture.md), [`docs/prd.md`](docs/prd.md) et
  [`docs/product-brief.md`](docs/product-brief.md).
- **~20 commandes Tauri CRUD supprimées** de `apps/desktop/src-tauri/src/lib.rs` (clients,
  prestations, quotes, invoices, workspace, numbering, activity) + stubs `cycle.rs`
  retirés. Remplacées par des endpoints REST consommés via `fetch`. Restent en Rust
  uniquement : signature PAdES, email dispatch, archive ZIP, rendu PDF Typst, gestion
  cert X.509 (accès keychain OS). Cf. commit `f32d089`.
- **Hooks React passent de `invoke` à `fetch`** via `apps/desktop/src/api/api-client.ts`
  (baseURL `http://127.0.0.1:${window.__FAKT_API_PORT}/api`, header `X-FAKT-Token`).
  Les bridges `doc-editor/*-api.ts` stubbables conservent la même interface (tests inchangés).

### Fixed

- **Hash TSA conforme RFC 3161 §2.5** : l'horodatage porte désormais sur
  `SHA256(SignerInfo.signature BIT STRING)` au lieu de `SHA256(cms_der entier)`.
  Corrige le risque de rejet Adobe Reader identifié dans `e2e-wiring-audit.md` §6.
- **Audit trail signature persistant en SQLite** (plus en RAM `Mutex<Vec>`).
  Les événements survivent au redémarrage via `POST /api/signature-events`.
- **Mismatch `CertInfo` Rust ↔ TS** résolu : Serde `rename_all = "camelCase"` côté Rust,
  TS s'aligne sur `subjectCn`, `fingerprintSha256Hex`, `notBeforeIso`. Plus de `undefined`
  dans le tab Certificat de l'onboarding.
- **Onboarding wizard : 6 bugs UI fixés** (écran blanc post-finish, checkbox régime
  fiscal non cochable, SIRET validation Luhn manquante, submit invalide bloqué, focus
  trap absent, reset step au reload). Cf. commit `0cfacaf`.
- **Chemin Windows quoté** dans `cmd /C start "" "<path>"` (fichier `email.rs`) — fix
  utilisateur avec espace dans son profil (ex: `C:\Users\Jean Dupont\`).
- **Capabilities Tauri `fs` / `dialog` / `path` correctement déclarées** dans
  `apps/desktop/src-tauri/capabilities/default.json`. Fix crashs runtime silencieux sur
  email draft (`plugin:fs|write_text_file`) et archive ZIP (`plugin:dialog|save`).

#### Phase 4 pre-tag security + legal + UX fixes (2026-04-22)

Review exhaustive Phase 3 + fixes Phase 4 sur `docs/sprint-notes/v01-review-findings.md`.
12 P0 + 11 P1 release-blocking fixés avant tag :

**Security (5 P0 · commit `1d96a43`)**
- **Audit chain hash exhaustif** : `compute_self_hash()` inclut désormais `previous_event_hash` + tous les champs métier (`document_type`, `document_id`, `signer_name`, `doc_hash_before`, `ip_address`, `user_agent`, `signature_png_base64`, `tsa_response_base64`). Tampering rétroactif détecté par `verify_chain`.
- **Command injection Windows** : `dispatch_open` utilise `rundll32.exe url.dll,FileProtocolHandler` au lieu de `cmd /C start` (fin du shell parsing `& | < >`).
- **Path traversal** : `store_signed_pdf` / `load_signed_pdf` valident `doc_id` et `doc_type` via regex `^[A-Za-z0-9_-]{1,64}$` + `canonicalize()` + `starts_with(signed_dir)`.
- **TSA URLs HTTPS** : `http://timestamp.digicert.com` et `sectigo.com` → HTTPS (élimine le MITM sur l'horodatage).
- **CSP alignée** : `connect-src` inclut les 3 TSA endpoints HTTPS (freetsa + digicert + sectigo).

**Bugs-legal (3 P0 · commit `8ab7ce8`)**
- **`from-quote balance` filtre les acomptes légalement actifs** : `WHERE status IN (sent, paid, overdue)` — les acomptes `cancelled` ou `draft` n'affectent plus le calcul du solde (correction d'une fuite d'argent freelance).
- **`deposit30` arrondi cohérent + redistribution cents** : `Math.round` sur le total 30% + redistribution de l'écart cents sur la dernière ligne. Invariant `Σ lines.totalHtCents === totalHtCents` verrouillé.
- **`/cancel` invoice refuse `sent|paid|overdue → cancelled`** : `canTransitionInvoice` appelé systématiquement, renvoie 422 `INVALID_TRANSITION` avec message FR `CGI art. 289-I-4` (avoir obligatoire pour annuler une facture émise).

**UX P1 release-blocking (5 P1 · commit `b34908d`)**
- **Enum `legalForm` workspace accepte `EI`** (Entreprise Individuelle, statut FR post-réforme 15/05/2022).
- **Archive ZIP exhaustif** : `limit=10000` sur `services.list` / `quotes.list` / `invoices.list` + `includeSoftDeleted` pour `clients.list` (archive ne tronque plus les workspaces > 50 entrées).
- **`toast.error` au lieu de `toast.success`** sur échec export ZIP (UX cohérente).
- **`ApiClient` gère 200 empty body** → `undefined` au lieu de cast string → crash appelant.
- **Escape listener** sur `ShortcutsOverlay` + `QuickClientModal` (a11y WCAG 2.1.1 clavier).

**Docs (4 P0 + 6 P1 · commit `f7e6f0b`)**
- `.github/launch-messages/` + `product-brief.md` + `prd.md` + `architecture.md` : refs `~5 Mo` / `≤ 15 Mo` → `~100 Mo` (NFR-003 révisé).
- CHANGELOG : fusion `[Unreleased]` + `[0.1.0]`, entries ajoutées pour commits `9715a90`, `b70a597`, `f32d089`, `0cfacaf`.
- `docs/refacto-spec/test-plan.md` : `X-FAKT-Token` au lieu de `Bearer`, paths `tests/` au lieu de `__tests__/`.
- `README.md` section Troubleshooting (sidecar crash-loop, port 3117, 401, logs OS).

### Security

- Signature PAdES niveau eIDAS avancé (AdES-B-T) — **non qualifiée** (qualification impossible sans accréditation ANSSI, hors scope).
- Audit trail append-only : aucun UPDATE ni DELETE autorisé sur la table `audit_events` (trigger SQL).
- Clé privée RSA 4096 stockée exclusivement dans le keychain OS — jamais en base de données, jamais en fichier plat.
- Zéro secret hardcodé dans le code source ou les workflows CI.
- Input utilisateur validé via Zod (frontend) + guards Rust (backend) avant insertion DB.

### Known Issues

- **Port Rust du sidecar api-server** prévu v0.2 pour réduire la taille installer
  de ~100 Mo à ~20 Mo. La stack Bun + Hono + Drizzle actuelle est fonctionnellement
  complète et stable ; le port Rust est purement une optimisation de taille.
- **Mode 2 / 3 auth** : le wiring code est posé mais l'authentification n'est pas
  shippée en v0.1. JWT arrive en v0.2 (mode 2 self-host), OAuth + sessions en v0.3 (mode 3 SaaS).
- **Postgres schema mirror** : v0.1 SQLite uniquement. Le dual-adapter Drizzle
  SQLite ↔ Postgres est prêt côté code mais le schema Postgres + migrations sont v0.2.
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
- **P2/P3 déférés v0.1.1** : 24 findings P2 (polish UI, cohérence copy tu/vous, tokens
  `fontSize` numériques, ghost button press state, etc.) + 12 P3 (refacto suggestions)
  documentés dans [`docs/sprint-notes/v01-review-findings.md`](docs/sprint-notes/v01-review-findings.md).
  Non release-blocking : aucun n'affecte les flows business, la conformité légale FR ou
  la sécurité de base.
- **P1 non release-blocking déférés v0.1.1** : ~22 findings P1 restants (i18n
  "Chargement…" hardcoded, empty states sans CTA, mélange tu/vous, nextNumber atomic
  pour multi-workspace mode 2/3, LIKE wildcards `%`/`_` escape, `verify_signature`
  validation CMS complète, PBKDF2 600k itérations, token sidecar via stdin au lieu
  d'env var, retry ApiClient cold start, etc.) documentés dans
  [`docs/sprint-notes/v01-review-findings.md`](docs/sprint-notes/v01-review-findings.md).
  Le flow business end-to-end fonctionne sans eux (validé par qa-smoke-live le 2026-04-22).

---

[0.1.0]: https://github.com/AlphaLuppi/FAKT/commits/main
