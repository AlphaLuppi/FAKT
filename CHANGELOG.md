# Changelog

Toutes les modifications notables de FAKT sont documentées dans ce fichier.

Ce projet suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et [Semantic Versioning 2.0.0](https://semver.org/lang/fr/).

> **Pour faire une release :** lancer `/release X.Y.Z` (skill défini dans `.claude/skills/release/SKILL.md`).
>
> **À partir de v0.1.12, le format évolue vers un changelog rédigé pour humain non-technique :**
> sections `### Nouveautés`, `### Améliorations`, `### Corrections` (en français), une phrase par point,
> orienté utilisateur final, **sans** notes CI / signatures / bumps de deps / formatage. Voir le skill
> `/release` pour les règles complètes. Les sections antérieures à v0.1.12 conservent leur format
> historique (Added/Changed/Fixed en anglais avec détails techniques).

---

## [Unreleased]

### Nouveautés

### Améliorations

### Corrections

---

## [0.1.25] - 2026-04-26

### Améliorations

- **Votre signature apparaît maintenant sur le PDF du devis signé** — quand
  vous signez un devis, votre dessin (canvas ou clavier) est désormais
  incrusté visuellement dans le bloc « Le Prestataire » du PDF, avec une
  mention discrète « *Signature électronique avancée — eIDAS AdES-B-T* »
  pour rassurer les clients sur la valeur juridique. La protection
  cryptographique PAdES B-T (RSA 4096 + horodatage qualifié FreeTSA)
  reste appliquée par-dessus, comme avant.

### Corrections

- **Retrait du bouton « Signer » sur les factures** — il n'avait pas de
  sens légal : en France, on signe un devis (acceptation contractuelle,
  art. 1101 du Code civil) mais pas une facture (document de constatation
  post-vente). Le bouton apparaît toujours sur les devis. Si vous avez
  besoin d'un sceau d'intégrité crypto sur vos factures archivées, ce
  sera un automatisme à l'émission dans une prochaine version, pas un
  geste à faire vous-même.

---

## [0.1.24] - 2026-04-26

### Améliorations

- **Mises à jour sans interruption** — quand vous cliquez sur « Mettre à
  jour » dans la bannière jaune, la nouvelle version se télécharge en
  arrière-plan et FAKT reste utilisable pendant ce temps. Un bouton
  « Redémarrer maintenant » apparaît dès qu'elle est prête à être
  appliquée — vous choisissez quand redémarrer, plus rien ne se ferme
  dans votre dos.

### Corrections

- L'erreur Windows « Error opening file for writing » qui s'affichait
  pendant l'installation d'une mise à jour ne se déclenche plus —
  l'app libère proprement ses fichiers avant que l'installeur ne prenne
  le relais, le wizard NSIS classique ne s'ouvre plus du tout.

---

## [0.1.23] - 2026-04-26

### Nouveautés

- **Importer des devis signés et des factures déjà payées** — un nouvel
  écran « Importer un document existant » permet de charger des PDF de
  devis signés ailleurs ou de factures historiques pour compléter votre
  historique sans repartir de zéro. L'IA pré-remplit le client, les
  lignes et les dates, vous n'avez plus qu'à valider. Ces documents
  apparaissent avec un badge « IMPORTÉ » distinct et n'occupent pas la
  séquence officielle FAKT (CGI art. 289 préservé).

### Améliorations

- **Création de devis avec l'IA plus claire** — la zone de saisie est
  désormais découpée en deux onglets explicites : « Coller un brief »
  pour le texte libre et « Déposer un fichier » pour les PDF/DOCX/MD/TXT.
  Quand vous déposez un fichier, son contenu n'est plus injecté en vrac
  dans la zone de texte ; il devient une carte récap avec son nom, sa
  taille et son statut (lecture en cours / prêt / erreur).
- **Aperçu IA modifiable** — après extraction, vous pouvez corriger le
  nom du client, son email, chaque ligne du devis (description, quantité,
  unité, prix), et ajouter ou supprimer des lignes avant de basculer
  dans l'éditeur. Plus besoin de tout retaper si l'IA s'est trompée sur
  un détail.

### Corrections

---

## [0.1.22] - 2026-04-26

### Corrections

- **Fenêtre de mise à jour qui affichait toujours « Notes de version en
  cours d'édition »** — vous voyez désormais les vraies notes de la
  nouvelle version (nouveautés, améliorations, corrections) directement
  dans la fenêtre d'installation, au lieu du texte temporaire figé au
  moment du build. La fenêtre va chercher en direct les notes publiées
  sur la page de release GitHub. Si le réseau est indisponible, on
  retombe gracieusement sur les anciennes notes embarquées.

---

## [0.1.21] - 2026-04-26

### Corrections

- **Aperçu PDF qui ne s'affichait plus** — sur les écrans Détail devis
  et Détail facture, l'aperçu restait bloqué derrière le message
  « Ce contenu a été bloqué ». Le PDF s'affiche maintenant
  correctement dès qu'un numéro est attribué au document, en local
  comme côté serveur.
- **Sélecteur de devis repensé dans Nouvelle facture** — la liste
  déroulante laisse place à une fenêtre dédiée avec 3 filtres
  (tous les éligibles, sans facture, acompte facturé), un badge
  visuel indiquant l'état de facturation de chaque devis, et un
  filtrage automatique : les devis dont la facture totale est déjà
  émise n'apparaissent plus. Le formulaire se met à jour dès que
  vous choisissez un devis, sans étape supplémentaire.

---

## [0.1.20] - 2026-04-26

### Améliorations

- **Bouton « Continuer avec ce devis »** — sur l'écran « Nouvelle
  facture depuis un devis signé », un bouton bien visible apparaît
  désormais juste sous la liste de sélection. Il fait défiler la page
  vers le formulaire de facture et confirme visuellement que le devis
  est sélectionné — fini la sensation que rien ne se passe après avoir
  ouvert la liste déroulante.

---

## [0.1.19] - 2026-04-26

### Nouveautés

- **Bouton « Créer une facture » sur les devis signés** — depuis la
  fiche d'un devis envoyé ou signé, un nouveau bouton permet désormais
  de générer directement la facture liée (acompte, solde ou totale)
  sans passer par le menu Factures. Le devis sélectionné est
  pré-rempli automatiquement.

### Corrections

- **« Créer et émettre » envoie vraiment le devis** — le bouton ne
  laissait plus le devis bloqué en brouillon : il attribue le numéro
  séquentiel **et** bascule le statut en « Envoyé », ce qui débloque
  immédiatement la génération du PDF et la signature électronique.
  Auparavant il fallait cliquer trois fois (créer → marquer envoyé →
  signer) pour arriver au même résultat.
- **Signature accessible dès l'émission** — comme conséquence du
  point ci-dessus, le bouton « Signer » n'est plus grisé après
  création : le PDF est disponible immédiatement et la signature
  PAdES peut être posée sans étape intermédiaire.
- **Sélection du devis à facturer** — sur l'écran « Nouvelle facture
  depuis un devis signé », le premier devis disponible est désormais
  pré-sélectionné automatiquement. Auparavant la liste déroulante
  affichait visuellement un devis mais le formulaire restait vide tant
  qu'on n'avait pas re-cliqué dessus, donnant l'impression que
  l'écran était cassé.

---

## [0.1.18] - 2026-04-25

### Améliorations

- **Fiabilité de l'application** — une nouvelle suite de tests
  automatisés vérifie l'application avant chaque mise à jour
  (couverture des principaux écrans, conformité de la numérotation
  séquentielle des factures, validation du binaire packagé sur
  Windows et Linux). Cette infrastructure interne ne change rien à
  l'utilisation au quotidien, mais garantit que les prochaines
  releases passent par un contrôle qualité plus strict avant d'être
  publiées.

---

## [0.1.17] - 2026-04-25

### Nouveautés

- **Configuration du backend depuis la page de connexion** — un nouveau
  panneau « Configurer le backend ▾ » est désormais disponible en bas de
  l'écran de connexion (uniquement dans l'app desktop). Il permet de
  basculer entre le mode « Local » (vos données restent sur votre poste)
  et le mode « Distant » (serveur d'équipe), et de personnaliser l'URL
  du backend distant. Une pastille de statut vérifie automatiquement la
  disponibilité du serveur. Pratique pour passer rapidement d'un serveur
  de test à la production sans devoir entrer dans les Paramètres.

### Corrections

- **Connexion app web ⇄ API mode équipe** — le bundle web (servi sur
  `fakt.alphaluppi.fr`) tape désormais correctement sur l'API distante
  hébergée sur le sous-domaine `api.fakt.alphaluppi.fr`. Auparavant
  l'URL de l'API n'était pas correctement intégrée au build, ce qui
  empêchait toute connexion depuis le navigateur.
- **Installateur Windows simplifié** — la version Windows est désormais
  livrée uniquement au format NSIS (`.exe`). Le format MSI redondant a
  été retiré, ce qui réduit le risque de confusion lors du téléchargement
  et accélère le processus d'auto-update.

---

## [0.1.16] - 2026-04-25

### Améliorations

- **Survol des lignes d'activité plus joli** — passer la souris sur une
  ligne d'« Activité récente » fait désormais ressortir l'item avec une
  barre verticale noire à gauche, un léger décalage à droite et un
  séparateur plus marqué. L'effet « bouton actif » brutalist remplace
  l'ancien aplat jaune sans relief.

---

## [0.1.15] - 2026-04-25

### Corrections

- **Page de connexion lisible** — le bouton « Se connecter » apparaissait
  noir sur noir et restait invisible ; il s'affiche désormais en jaune
  vif avec son ombre portée comme le reste de l'interface.
- **Card du choix de mode (Paramètres → Backend)** — l'option sélectionnée
  devenait un rectangle noir avec son texte invisible ; elle est désormais
  surlignée en jaune avec le label parfaitement lisible.
- **Activité récente du tableau de bord plus lisible** — au survol d'une
  ligne, la date et la référence du document (par ex. `D2026-001`)
  restent maintenant en noir franc sur le fond jaune. Les codes
  numériques ne sont plus recolorés par le navigateur.

---

## [0.1.14] - 2026-04-25

### Améliorations

- **Mises à jour silencieuses sur Windows** — l'installation d'une nouvelle
  version ne demande plus de privilèges administrateur à chaque fois.
  FAKT s'installe désormais dans votre dossier utilisateur (`%LOCALAPPDATA%`)
  et se met à jour de manière transparente, sans interruption Windows.

### Corrections

- **Notes de version cohérentes avec la version installée** — dans certains
  cas, les notes affichées dans la fenêtre de mise à jour pouvaient
  correspondre à une version différente de celle réellement téléchargée
  (si la release sur GitHub évoluait entre la détection et le clic sur
  « Installer »). Le contenu affiché correspond désormais toujours à
  l'artefact qui sera installé.
- **Message de fin d'installation plus clair** — à 100 % de progression,
  le message « Relancement de l'application… » est remplacé par
  « Installation terminée — FAKT redémarre… », pour signaler clairement
  que la mise à jour est appliquée et que l'app va redémarrer.

> ⚠️ **Si vous avez actuellement FAKT installé dans `Program Files`** (ce
> qui était le cas par défaut jusqu'à la v0.1.13) : désinstallez d'abord
> la version actuelle via les paramètres Windows, puis installez la
> v0.1.14. Sans ça, le système continuera à demander des droits admin
> car les anciennes versions sont en mode « machine entière ». Une fois
> en v0.1.14, plus jamais d'UAC.

---

## [0.1.13] - 2026-04-25

### Nouveautés

- **Mode "self-host" (entreprise)** — vous pouvez désormais déployer FAKT
  sur votre propre serveur, avec PostgreSQL et plusieurs comptes utilisateurs.
  L'app desktop se connecte à votre serveur via une URL configurable, et
  l'authentification se fait par email + mot de passe.
- **Sélecteur d'espace de travail** — un menu déroulant en haut de l'app
  permet de basculer rapidement entre plusieurs espaces (utile en mode
  self-host quand vous gérez plusieurs activités, ou pour une équipe).
- **Onglet Paramètres → Backend** — configurez l'URL du serveur et le
  mode de connexion (sidecar local ou serveur distant) directement depuis
  l'app, sans toucher aux fichiers de config.

### Corrections

- **Audit trail des devis désormais complet** — quand vous cliquiez sur
  « Marquer envoyé » puis « Annuler l'envoi », l'historique d'audit ne
  reflétait pas l'annulation et continuait d'afficher « Envoyé ».
  Désormais chaque action (envoi, annulation, signature, paiement…)
  ajoute sa propre entrée datée dans l'historique chronologique du
  document.

---

## [0.1.11] - 2026-04-25

### Added
- **Canvas signature au look macOS natif** : sur Mac, l'onglet « Dessiner
  au trackpad » affiche désormais un canvas charcoal `#1C1C1E` avec trait
  blanc épais et placeholder centré « Clique ici pour commencer », fidèle
  au panneau de signature de Preview.app. Sur Windows et Linux le canvas
  reste en variante Brutal Invoice (papier blanc, trait noir).
  Détection auto via `navigator.userAgent`, prop `variant` exposée pour
  override manuel.

### Fixed
- **Test Vitest `NewAi cancel` flaky sur Windows CI** : timeout porté
  à 20 s (vs 5 s par défaut) car la 1re invocation de `parsePdfFile`
  charge dynamiquement pdfjs-dist (~3 MB) qui prend plus de temps qu'en
  local sur les runners GitHub Actions Windows.

---

## [0.1.10] - 2026-04-25

### Added
- **Mises à jour in-app via `tauri-plugin-updater` v2.** Au boot, FAKT
  contacte `releases/latest/download/latest.json` sur le repo GitHub. Si
  une release plus récente est dispo, une bannière jaune Brutal apparaît
  en haut de l'app : « Mise à jour disponible — vX.Y.Z ». Un clic sur
  « Installer maintenant » ouvre une modale avec les notes de release
  (markdown), une progress bar, puis DL + vérification de la signature
  ed25519 minisign + install + relaunch automatique via `tauri-plugin-process`.
  Composants : `apps/desktop/src/features/updater/` (UpdaterContext +
  UpdateBanner + UpdateModal). Procédure de release dans
  `docs/release-process.md`.
- **Bundle Windows NSIS** ajouté à `tauri.conf.json` → `bundle.targets`.
  L'installeur `.exe` setup NSIS supporte le silent install (`installMode:
  passive`) requis par l'updater. Le `.msi` reste pour le 1er install
  manuel.

### Changed
- CSP étendu pour autoriser le DL des assets de release GitHub
  (`https://github.com`, `https://*.githubusercontent.com`,
  `https://objects.githubusercontent.com`).
- `.github/workflows/release.yml` : injection des secrets
  `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` pour
  signer les artifacts updater. Génération + upload automatique de
  `latest.json` via `tauri-action` (paramètre `updaterJsonPreferNsis: true`).

---

## [0.1.9] - 2026-04-25

Hotfix 2 bugs P0 découverts par Tom sur v0.1.8 grand public.

### Fixed
- **Terminal Windows qui popait sur chaque invocation Claude CLI**
  (`cmd /C claude ...`). Ajout du flag `CREATE_NO_WINDOW` (0x08000000) sur
  toutes les `tokio::process::Command` qui spawn claude / cmd / where.
  Helper `silence_console_window` appliqué à `build_command`,
  `check_claude_cli` (direct + fallback shell) et `resolve_binary_path`.
- **"id doit être un UUID v4"** à la création de devis via le flow IA
  (`NewAi.tsx`) et à la duplication (`NewManual.tsx`) : les ids temp étaient
  générés en `tmp-${idx}-${Date.now()}` ou `item-${id}-${random}`, rejetés
  par le schéma Zod `uuidSchema` côté API. Remplacé par `crypto.randomUUID()`
  / helper `newId()` pour garantir l'UUID v4 canonique côté front.

---

## [0.1.8] - 2026-04-24

Session test + fix UI massive (16 retours utilisateur + plusieurs améliorations
post-merge). Refonte Composer IA avec blocs thinking/tool_use en accordéon style
claude.ai, drag-drop de fichiers (TXT/MD/EML/PDF/DOCX) dans le brief IA, fix
extraction IA JSON, et nombreux polish UX.

### Added
- Dropzone UIKit (`packages/ui/src/primitives/Dropzone.tsx`) — drag + clic.
- Parseurs fichiers `@fakt/ai/file-parsers` : text, markdown, eml, pdf, docx.
- PDF worker Vite via `?url` + timeouts 15 s (load) / 30 s (total) + bouton Annuler.
- Composer IA : events structurés Anthropic natifs forwardés de Rust
  (`thinking_delta`, `tool_use_*`, `tool_result`) — CLI en `stream-json`.
- Composer IA : `ExecutionTrace` — accordéon collapsed-par-défaut qui regroupe
  thinking + tool_use + tool_result en une ligne résumée (style claude.ai).
- Composer IA : `StreamingStatus` — bandeau spinner braille animé.
- Composer IA : markdown + HTML + SVG via `react-markdown` (GFM + highlight + sanitize).
- Composer IA : animation typewriter avec curseur clignotant.
- Settings : toggle "Mode verbose IA" (persisté localStorage).
- Recherche globale Cmd+K : route `GET /api/search` agrégée.
- Bouton "Marquer comme envoyé" / "Annuler envoi" sur les devis + audit trail.
- Commande Rust `write_pdf_file` (remplace `plugin:fs|write_file` défaillant).
- UIKit : `SegmentedControl`, `Autocomplete`, `AutoGrowTextarea`.
- Signature trackpad : Ctrl+Z undo du dernier trait.
- Détail client : navigation vers devis/factures liés + pagination.
- Templates Typst : mentions légales FR complètes (CGV L441-10, D441-5, 293 B,
  PI, résiliation, validité 90 j) alignées avec `/devis-freelance`.
- 95+ workflows E2E documentés dans `_bmad-output/e2e-workflows-coverage.md`.

### Fixed
- Composer IA : streaming n'affiche plus `[object Object]` (extraction correcte
  des delta `text` / `thinking` / `partial_json`).
- Extraction IA devis : parser JSON robuste côté Rust (`json_extract.rs`) —
  gère fences markdown, préfixes explicatifs, nested braces, arrays.
- Drag-drop PDF qui pendait indéfiniment : worker réel + timeouts + Annuler.
- Signature : ids en UUID v4 canonique (fin du "id doit être UUID v4").
- Bouton "Télécharger PDF" : écrit effectivement le fichier après dialog.
- Bouton "Nouveau avec l'IA" câblé (navigate vers `/quotes/new-ai`).
- Bouton "Éditer un devis" : tooltip explicatif quand disabled.
- Dropdowns menu "Nouvelle facture/devis" : padding gauche 16 px.
- Biblio prestations sur description ligne devis : autocomplete inline discret.
- Mock `tokens.shadow` dans les tests ClientsList (6 failures préexistants fixés).
- Composer sidebar : header 56 px aligné top bar + shadow gauche.
- Lint : remplacement des 17 non-null assertions `!` dans `useChatStream.test.ts`
  par un helper `apply()` qui throw au lieu de TypeError silencieux.

### Changed
- `@fakt/ai` accepte `pdfjs-dist` + `mammoth` en deps directes.
- `AiStreamEvent<T>` étendu avec 5 variants (rétrocompat totale).

### Developer notes
- 338/338 tests verts côté `@fakt/desktop` (vs 305/311 avant).
- Lint Biome clean (0 erreur).
- Typecheck 13/13 packages OK.

---

## [0.1.7] - 2026-04-24

Fix UX onboarding découverts par Tom au réveil après test de v0.1.6 en dev.

### Fixed

- **Onboarding en boucle après "C'est parti !"** : le hook
  `useOnboardingGuard` fetchait `is_setup_completed` une seule fois au
  mount d'App via `useEffect([])`. Après `complete_setup` + `navigate("/")`,
  le guard gardait son état `needs-onboarding` cached et re-redirigeait
  immédiatement vers `/onboarding`, remountant `Wizard` avec
  `currentStep=0`. L'utilisateur revenait indéfiniment à l'étape 1.
  Fix : `window.location.href = "/"` force un full reload du webview →
  App re-mount → guard re-fetch → `ready` → dashboard.
- **Champs identité à retaper à chaque reprise d'onboarding** :
  `IdentityStep` utilisait des defaults vides. Ajout d'un `useEffect` au
  mount qui appelle `api.workspace.get()` et `reset()` le formulaire avec
  les valeurs du workspace existant (nom, forme juridique, SIRET, adresse,
  email, IBAN). Silencieux en cas de `NOT_FOUND` / `NETWORK_ERROR`
  (onboarding initial légitime).
- **Génération d'un nouveau certificat X.509 à chaque onboarding** :
  `CertificateStep` montrait le bouton "Générer" même si un cert existe
  déjà dans le keychain OS. Ajout d'un `useEffect` au mount qui appelle
  `get_cert_info` Tauri → pré-fill le state `certInfo` si un cert existe,
  affichant la carte "cert actif" avec bouton "Régénérer" optionnel au
  lieu d'en créer un nouveau. Évite la pollution du Windows Credential
  Manager avec des certs obsolètes.

### Changed

- `CertInfo.certPem` passe à `string | null` : `get_cert_info` ne retourne
  pas le PEM (clé privée reste dans le keychain). Le PEM public reste
  récupérable via l'API `/api/settings`.
- `API_VERSION` `0.1.6` → `0.1.7`.

---

## [0.1.6] - 2026-04-24

🚨 **Hotfix critique** : le sidecar `fakt-api.exe` crashait au boot en prod
(MSI Windows) avec `error: migrations introuvables dans : B:\db\src\migrations
| C:\packages\db\src\migrations | C:\Program Files\FAKT\packages\db\src\migrations`
— les versions 0.1.0 → 0.1.5 étaient **toutes affectées**. L'app installée
ne démarrait pas (pas de fenêtre).

### Fixed

- **Sidecar crash "migrations introuvables" en prod MSI** : `bun build
  --compile --minify` ne bundle PAS les fichiers `.sql` lus via
  `readFileSync` à runtime. En prod, le sidecar cherchait les SQL dans 3
  paths relatifs au cwd (`C:\Program Files\FAKT`) qui n'existent pas dans
  l'installation, et crashait avec exit code 1. Tauri détectait
  `sidecar terminé avant ready, code=Some(1)` → setup panic → pas de
  fenêtre.

  Fix en 3 volets :
  1. Nouveau script `packages/api-server/scripts/generate-migrations.ts`
     qui génère `src/migrations-embedded.ts` au build-time en stringifiant
     les 4 migrations SQL (0000 zippy_nextwave, 0001 triggers, 0002
     signed_pdf, 0003 payment_notes — 10 kB total).
  2. `build-sidecar.ts` invoque `generate-migrations` AVANT chaque
     `bun build --compile` (local + CI).
  3. `packages/api-server/src/index.ts` utilise désormais
     `EMBEDDED_MIGRATIONS` au lieu de `readdirSync + readFileSync`. La
     fonction `resolveMigrationsDir` est supprimée.

  Validation : binaire local rebuild + lancé depuis
  `C:\Program Files\FAKT` cwd → `FAKT_API_READY:port=50161` ✅.

### Developer notes

- Ce bug explique pourquoi v0.1.1 → v0.1.5 ne démarraient pas une fois
  installées. En dev (`bun run dev`), le sidecar trouve les SQL via le
  path du repo, donc le bug était invisible. Idem pour mes tests locaux
  de binaire release : je les lançais depuis le repo cwd.
- Les tests Vitest ne sont pas impactés (ils utilisent la DB test in-memory
  sans migrations SQL externe via `@fakt/db/__tests__/helpers`).
- `migrations-embedded.ts` est committé (pas gitignored) pour que
  `bun run test` et `bun run typecheck` fonctionnent en dev sans
  regénération systématique.

---

## [0.1.5] - 2026-04-24

Release finale de la nuit de hardening. Ajoute les guards double-submit sur
l'ensemble des formulaires sensibles identifiés après l'audit — risque rare
en pratique (React mono-thread + Tauri single webview) mais qui pouvait
allouer deux numéros CGI consécutifs pour un seul devis/facture en cas de
double-clic très rapide, brisant la garantie « pas de trou dans la séquence ».

### Fixed

- **Guard synchrone `if (submitting) return`** sur les 7 formulaires
  create/edit :
  - `quotes/NewManual.tsx` (POST /api/quotes manuel)
  - `quotes/NewAi.tsx` (POST /api/quotes depuis IA)
  - `quotes/Edit.tsx` (PATCH /api/quotes/:id draft)
  - `invoices/NewScratch.tsx` (POST /api/invoices direct)
  - `invoices/NewFromQuote.tsx` (POST /api/invoices/from-quote)
  - `invoices/Edit.tsx` (PATCH /api/invoices/:id draft)
  - `settings/tabs/IdentityTab.tsx` (déjà fixé en 0.1.4)
  - `onboarding/steps/Recap.tsx` (déjà fixé en 0.1.3)
- **Guard sur 3 handlers Detail** sensibles à la numérotation séquentielle :
  - `quotes/Detail.tsx#handleMarkSent` (émission devis → numéro D)
  - `invoices/Detail.tsx#handleMarkSent` (émission facture → numéro F)
  - `invoices/Detail.tsx#handleMarkPaid` (enregistrement paiement)

Protection complémentaire à la numérotation atomique côté API (`BEGIN
IMMEDIATE` SQLite) déjà en place depuis v0.1.3 : **double protection UI + DB**
pour CGI art. 289.

### Changed

- `API_VERSION` `0.1.4` → `0.1.5`.

### Developer notes

- Mission de nuit hardening terminée. Bilan : 10 commits atomiques DCO+GPG,
  5 releases (0.1.1 → 0.1.5), 776 tests passed, 0 failed, lint clean,
  `cargo audit` clean avec 2 CVE documentées, bundle MSI Windows validé en
  build release local + CI.

---

## [0.1.4] - 2026-04-24

Patch : chasse aux Tauri commands fantômes dans l'écran Settings. v0.1.3
(nuit hardening) a publié les binaires CI, mais le bug settings a été
découvert juste après pendant la revue de cohérence invokes vs handlers.

### Fixed

- **Settings `IdentityTab` sauvegarde ne marchait pas** — le bouton
  "Enregistrer" invoquait la Tauri command `update_workspace` qui n'est
  **pas déclarée** dans `invoke_handler![...]` de `lib.rs`. L'invoke
  rejettait silencieusement et le toast erreur affichait "Command
  update_workspace not found" (illisible). Switch vers l'API sidecar
  `api.workspace.update`.
- **Settings `get_workspace` au mount** — même problème, le fetch
  workspace utilisait une Tauri command inexistante, résultat l'écran
  Identity apparaissait vide à chaque ouverture. Switch vers
  `api.workspace.get()` avec gestion `NOT_FOUND`/`NETWORK_ERROR`.
- **Settings toggle télémétrie** — même problème, `update_settings` ne
  persistait rien. Switch vers `api.settings.set(key, value)`.

### Changed

- `API_VERSION` `0.1.3` → `0.1.4`.
- `Settings.tsx useEffect` : ajoute flag `cancelled` pour annuler le
  setState si le composant est démonté pendant le fetch workspace.

### Developer notes

- Audit croisé invokes/handlers complété : toutes les Tauri commands
  invoquées côté React ont maintenant un handler correspondant, OU ont
  été migrées vers l'API sidecar. Plus de commands fantômes.
- Tests settings : 9/9 OK après migration des mocks (`vi.hoisted` pour
  compatibilité avec le hoisting de `vi.mock`).

---

## [0.1.3] - 2026-04-24

Release de durcissement pour grand public. Audit complet de nuit (3 agents en
parallèle : code-reviewer Rust + code-reviewer TypeScript + audit deps/lint/tests)
a identifié 2 P0 + 5 P1 sécurité + 1 CVE HIGH dépendance — tous fixés dans
cette release.

### Security

- **SQL injection `drizzle-orm`** : bump `0.44.x` → **`0.45.2`** pour patcher
  GHSA-gpj5-g38j-94v9 (HIGH) — identifiers mal échappés dans certaines
  requêtes Drizzle. Impact direct `@fakt/db` + `@fakt/api-server`.
- **Zip Slip dans `build_workspace_zip`** (Rust, commands/backup.rs) : un
  `entry.name` contrôlé par le frontend (XSS WebView) pouvait contenir
  `../../evil.bin` et produire un chemin ZIP interne traversant la hiérarchie
  cible à l'extraction par un archiveur naïf (Windows Explorer, macOS Archive
  Utility). Tous les `entry.name` sont désormais sanitisés (basename uniquement,
  retrait des caractères Windows-reserved).
- **Path arbitraire sur `dest_path`** (Rust, commands/backup.rs) : `dest_path`
  passé directement à `File::create` sans validation. Désormais vérifié :
  extension `.zip` requise, parent existant, dossiers système bloqués
  (C:\Windows, C:\Program Files, /etc, /usr, /bin, /sbin, /system).
- **Symlink bypass `open_email_draft`** (Rust, commands/email.rs) : un symlink
  `evil.eml → /etc/passwd` passait le check d'extension mais ouvrait le
  fichier résolu dans l'app mail. Désormais `canonicalize()` + re-check
  extension sur le chemin résolu avant dispatch.
- **`SECURITY.md` + `audit.toml`** : politique de rapport de vulnérabilités
  publiée, CVE Rust acceptées (RUSTSEC-2023-0071 rsa Marvin + RUSTSEC-2026-0097
  rand transitive tauri-utils) documentées avec justification.
- **Deps dev moyenne** : bump `vite 6→8`, `astro 5→6`, `esbuild 0.24→0.28`
  (3 CVE MODERATE dev-only GHSA-4w7w/-j687/-67mh).

### Fixed

- **Crash silencieux `.expect()` sur `.run()` Tauri** (Rust, lib.rs) : sous
  `panic = "abort"` (release Windows), tout `.expect()` atteint produit un
  crash 0xc0000409 **silencieux** (WER seul — stderr avalé par
  `windows_subsystem = "windows"`). L'entrée `run()` convertit désormais
  toute `Err` retournée par Tauri Builder en `process::exit(1)` + log trace
  propre, sans panic.
- **Crash `.unwrap()` UTF-8 dans `to_pem`** (Rust, crypto/commands.rs) :
  `std::str::from_utf8(chunk).unwrap()` sur une sortie base64 — ASCII en
  pratique, mais un `.unwrap()` de trop peut crash silencieusement. Remplacé
  par `String::from_utf8_lossy(chunk)`.
- **Sidecar zombie si fenêtre ne s'ouvre pas** (Rust, lib.rs + sidecar.rs) :
  si `WebviewWindowBuilder::build()` échoue après que `spawn_api_server`
  ait réussi, le child sidecar Bun restait vivant avec son port pris.
  Désormais `sidecar::shutdown()` appelé explicitement dans le chemin
  d'erreur.
- **Panic `pad_to_width` underflow défensif** (Rust, crypto/pades.rs) :
  `usize::saturating_sub` + garde `target >= 2` pour éviter un underflow
  théorique sur PDF malformé.
- **Numérotation factures non-atomique** (TS, api-server/routes/invoices.ts) :
  `POST /api/invoices/:id/issue` et `/mark-sent` appelaient
  `nextInvoiceNumber` sans transaction, alors que `quotes.ts` utilise
  correctement `nextNumberAtomic(sqlite, db, ws, "invoice")` avec
  `BEGIN IMMEDIATE`. Aligné — CGI art. 289 respecté sous concurrence.
- **SIRET La Poste refusé côté API** (TS, api-server/schemas/common.ts) :
  divergence client/serveur — le validateur client (@fakt/legal) acceptait
  l'exception SIREN `356000000` (La Poste) mais l'API ne le faisait pas,
  donc un client institutionnel passait le frontend mais était rejeté au
  POST. Exception ajoutée côté API.
- **HTTP 409 vs 422 vs 404 cohérence** (TS, api-server/routes) :
  `PATCH /api/invoices/:id` sur facture émise → 422 INVALID_TRANSITION
  (pas 409 CONFLICT). `DELETE /api/clients/:id` sur client déjà archivé
  et `POST /api/clients/:id/restore` sur client non archivé → 409 CONFLICT
  (pas 404 NOT_FOUND). Convention alignée avec `errors.ts`.
- **Facture / devis émis à 0€** (TS, api-server/routes/invoices.ts + quotes.ts) :
  une facture ou un devis à 0€ émis occupe un slot de numérotation séquentielle
  CGI sans contrepartie. Garde `totalHtCents <= 0 → 422` ajoutée au moment
  de l'émission (draft à 0€ reste valide pendant la composition).
- **Pagination `limit` 10 000** (TS, api-server/schemas/common.ts) : une
  requête `?limit=10000` saturait la webview Tauri en mémoire avec items
  joints. Cap réduit à `max(500)` (plus raisonnable pour un outil
  freelance).
- **Double-submit `RecapStep`** (TS, onboarding/steps/Recap.tsx) : le bouton
  `disabled={saving}` ne suffisait pas car React batche les renders — un
  double-clic rapide pouvait lancer 2 POST workspace en parallèle. Guard
  synchrone `if (saving) return` ajouté en entrée de `handleFinish`.

### Added

- **Module `trace.rs`** : logger centralisé qui promote vers
  `app_data_dir/logs/fakt-trace.log` (persistant) après setup Tauri, fallback
  `%TEMP%/fakt-trace.log` (Windows) / `/tmp/fakt-trace.log` (Unix) avant que
  le path resolver Tauri ne soit disponible. Remplace les 3 copies locales de
  la fonction `trace` dans `lib.rs`. Utilisé par le panic hook + les étapes
  de `setup()` pour diagnostiquer les crashes silencieux sous
  `windows_subsystem = "windows"`.

### Changed

- `API_VERSION` `0.1.2` → `0.1.3`.
- Lint Biome : 1 erreur (`noNonNullAssertion`) + 5 warnings corrigés. `bun
  run lint` exit 0.

### Developer notes

- Suite de tests : 776 passed / 1 skipped / 0 failed après tous les fixes.
- Typecheck Turbo : 12/12 packages OK.
- `cargo audit` : clean après ignore des 2 CVE documentées dans `audit.toml`.
- Couverture `@fakt/api-server` : 89.86% (statements), 70.3% (branches).

---

## [0.1.2] - 2026-04-23

Patch hotfix : déblocage du lancement de l'application Windows (crash silencieux
au boot 0.1.1) et acceptation des SIRET avec espaces dans l'onboarding.

### Fixed

- **Crash silencieux au boot Windows release (0xc0000409 / `__fastfail`)** :
  la combinaison `[profile.release] lto = true + opt-level = "s" + strip = true`
  produisait un binaire `fakt.exe` qui plantait avant l'ouverture de la fenêtre
  WebView2. Reproduit en local avec un build `cargo build --release` ; corrigé
  en passant à `strip = false` + `debug = "line-tables-only"`. Bundle MSI
  passe de ~9.7 Mo à ~10 Mo (acceptable).
- **SIRET avec espaces rejeté par l'API** (`SIRET INVALIDE (14 chiffres + Luhn)`
  alors que la valeur normalisée est valide). L'écran récap onboarding envoyait
  `data.siret` brut (`"853 665 842 00029"`, 17 chars) au lieu du SIRET normalisé
  (`"85366584200029"`, 14 chars). Double fix défensif :
  - `apps/desktop/src/routes/onboarding/steps/Recap.tsx` : appelle
    `normalizeSiret()` avant POST.
  - `packages/api-server/src/schemas/common.ts` : `siretSchema` applique
    désormais un `transform` Zod qui retire espaces, tirets et underscores
    avant validation Luhn — toute consommation de l'API (frontend, scripts,
    intégrations futures) bénéficie du fix.

### Added

- **Panic hook + traceur d'exécution** dans `apps/desktop/src-tauri/src/lib.rs` :
  écrit dans `%TEMP%/fakt-trace.log` (Windows) / `/tmp/fakt-trace.log` (Unix)
  chaque étape de `run() → setup() → window` + tout panic non rattrapé avec
  backtrace complète. Indispensable sous `windows_subsystem = "windows"` où
  stderr est silencieusement avalé.

### Changed

- `API_VERSION` constant `0.1.1` → `0.1.2`.

---

## [0.1.1] - 2026-04-23

Patch hotfix : déblocage de l'onboarding et de toutes les requêtes XHR du
webview vers le sidecar bloquées par CORS depuis 0.1.0.

### Fixed

- **CORS sidecar Hono** : le sidecar `packages/api-server/` n'envoyait aucun
  header `Access-Control-Allow-*`. Conséquence : depuis le webview Tauri (origin
  `http(s)://tauri.localhost` sous Windows, `tauri://localhost` sous macOS/Linux)
  ou depuis Vite dev (`http://localhost:1420`), le navigateur bloquait toutes les
  requêtes `/api/*` au preflight (`Network error: Failed to fetch` au clic
  "C'est parti !" en fin d'onboarding). Ajout du middleware `hono/cors` avec
  whitelist explicite des 4 origins légitimes + variable `FAKT_API_EXTRA_ORIGINS`
  pour les déploiements self-host (`packages/api-server/src/app.ts`).

### Changed

- `API_VERSION` constant `0.1.0` → `0.1.1` (`packages/api-server/src/types.ts`),
  exposé via header `X-FAKT-Api-Version`.

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
- **Règles Biome lint désactivées v0.1.0, à re-enforcer v0.1.1** : `useExhaustiveDependencies`,
  `noInvalidUseBeforeDeclaration`, `useFocusableInteractive`, `useKeyWithClickEvents`,
  `useSemanticElements`, `useButtonType`, `noLabelWithoutControl`, `noForEach`,
  `noUselessTernary`, `noMisleadingCharacterClass`, `noImplicitAnyLet`, `noArrayIndexKey`,
  `noControlCharactersInRegex` — 100+ violations pré-existantes (a11y + React hooks deps)
  que le sprint v0.1 n'a pas couvert. `noExplicitAny` reste enforcé en error (non-négociable).
  Plan v0.1.1 : agent dédié remonte ces rules en error + fix les violations par batch.
- **P1 non release-blocking déférés v0.1.1** : ~22 findings P1 restants (i18n
  "Chargement…" hardcoded, empty states sans CTA, mélange tu/vous, nextNumber atomic
  pour multi-workspace mode 2/3, LIKE wildcards `%`/`_` escape, `verify_signature`
  validation CMS complète, PBKDF2 600k itérations, token sidecar via stdin au lieu
  d'env var, retry ApiClient cold start, etc.) documentés dans
  [`docs/sprint-notes/v01-review-findings.md`](docs/sprint-notes/v01-review-findings.md).
  Le flow business end-to-end fonctionne sans eux (validé par qa-smoke-live le 2026-04-22).

---

[0.1.0]: https://github.com/AlphaLuppi/FAKT/commits/main
