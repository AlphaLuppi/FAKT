# CLAUDE.md — Instructions pour l'agent Claude sur FAKT

Ce fichier est lu automatiquement par Claude Code et autres agents IA opérant sur ce repo. Il définit le contexte, les conventions et les règles non-négociables du projet.

## Contexte projet

**FAKT** est une application desktop open-source pour gérer devis et factures de freelance français. Elle remplace les skills Claude Code `/devis-freelance` et `/facture-freelance` par un outil unifié avec signature électronique avancée PAdES et draft email multi-OS.

**Langue :** toute communication avec l'utilisateur se fait en **français**. Les identifiants code restent dans leur forme originale (anglais par convention).

**Pattern agence :** FAKT suit le pattern "outil interne AlphaLuppi" établi par MnM. Triple déploiement (solo local → self-host entreprise → SaaS hébergé).

## Stack non-négociable

- **Desktop :** Tauri 2 (Rust + React webview).
- **Monorepo :** Bun workspaces.
- **DB :** SQLite (solo) + PostgreSQL (entreprise), Drizzle ORM avec dual adapters.
- **Rendu docs :** Typst (jamais Puppeteer, jamais headless Chrome).
- **IA :** subprocess Claude Code CLI (jamais SDK embarqué en MVP — le user fournit son propre token Anthropic).
- **Signature :** PAdES B-T maison en Rust (jamais appeler une API Yousign/Docusign en MVP).
- **UI :** React 19 + Vite + Tailwind v4.
- **Design system :** Brutal Invoice (non-négociable).

## Design system Brutal Invoice

Règles absolues (source : `packages/design-tokens/` à venir, originellement dans bundle design) :

- **Couleurs :** noir `#000` (encre), papier `#F5F5F0` (canvas), jaune `#FFFF00` (alerte/accent), blanc `#FFF` (cartes raised).
- **Typo :** Space Grotesk 700-800 UPPERCASE pour titres, 500 pour body. JetBrains Mono pour numériques. Pas de serif dans l'UI.
- **Bordures :** 2.5px noir sur cards, 2px sur boutons/inputs, 1.5px sur chips. Pas de gris subtils.
- **Ombres :** plates `3px 3px 0 #000`, `5px 5px 0 #000`, `8px 8px 0 #000`. Jamais de blur.
- **Radii :** 0px partout. Jamais. Seule exception tolérée : loaders circulaires.
- **Hover :** inversion (#000 ↔ #FFFF00). Press : `transform: translate(3px,3px); box-shadow: none`.
- **Interdits :** gradients, blur, border-radius > 0, drop-shadow filters, transparence (sauf scrims modal).

## Conventions code

- **TypeScript strict.** `any` interdit, `unknown` + type guards.
- **Commits conventionnels :** `feat(scope): description`, `fix`, `refactor`, `test`, `docs`, `chore`.
- **DCO obligatoire :** chaque commit `Signed-off-by: Nom <email>` (ajouter `-s` à git commit).
- **Lint zéro warning** sur la CI. Bloquant.
- **Tests :** Vitest (unit) + Playwright (E2E). Coverage >= 70% sur packages/core et packages/pdf.
- **Pas de commentaires évidents.** Un commentaire = une contrainte cachée, pas une redite du code.
- **Pas de README dans les sous-dossiers** sauf demande explicite de l'utilisateur.

## Règles légales françaises (critiques)

- **Numérotation séquentielle** sans trous (CGI art. 289). Contrainte DB UNIQUE sur (year, type, sequence, workspace_id).
- **Mentions obligatoires factures :** SIRET, forme juridique, adresse, date émission, date échéance, pénalités retard, indemnité forfaitaire 40€, mention TVA applicable ou non applicable.
- **TVA micro-entreprise :** mention exacte "TVA non applicable, art. 293 B du CGI".
- **Archivage 10 ans** des factures émises. Implication : pas de hard delete sur table `invoices`, soft delete + archive seulement.
- **Signature :** niveau eIDAS **avancée** (AdES-B-T). Pas qualifiée (impossible sans accréditation ANSSI). Ne jamais prétendre "qualifiée" dans l'UI.

## Sécurité

- **Secrets :** jamais en repo. `.env.local` gitignored. Pas de clés API hardcodées.
- **Certs X.509 utilisateur :** stockés dans le keychain OS (Windows Credential Manager / macOS Keychain / Linux Secret Service via `keyring` crate Rust).
- **Audit trail signature :** append-only, chaîne de hash. Jamais de UPDATE ou DELETE sur table `audit_events`.
- **Input user :** toujours sanitized/validated avant insertion DB (Drizzle ou Zod).
- **Dépendances :** audit `bun audit` + `cargo audit` dans la CI.

## Pattern de travail agent

1. Avant tout changement non trivial, consulter `docs/product-brief.md` et `docs/prd.md` pour vérifier que le travail est in-scope.
2. Consulter `docs/architecture.md` pour les choix d'archi avant de créer des nouveaux packages ou modifier les interfaces.
3. Écrire tests avant ou avec le code (TDD quand possible).
4. Lancer `bun run typecheck && bun run test` avant de commit.
5. Pour les changements UI, vérifier le rendu dans Tauri dev (`bun run dev`) et valider visuellement avant merge.
6. PR titles en format conventional commits.

## Releases & changelog (NON-NÉGOCIABLE)

À chaque tag `vX.Y.Z` poussé, **la release GitHub doit contenir un changelog rédigé pour un humain non-technique**, pas une compil de notes techniques internes.

**Workflow opérationnel :** lancer le skill `/release X.Y.Z` (défini dans `.claude/skills/release/SKILL.md`). Le skill orchestre tout : tri des commits user-facing, reformulation française, mise à jour de `CHANGELOG.md`, bumps de version, commit signé DCO+GPG, tag, push, et création de la release GitHub avec les notes correctes.

### Principes (résumé du skill)

- **Source de vérité : `CHANGELOG.md` à la racine.** La release GitHub recopie l'extrait correspondant. Si le fichier dépasse ~500 lignes, basculer vers un dossier `changelogs/` (un fichier par version).
- **3 catégories** : `### Nouveautés` (`feat`), `### Améliorations` (UX/refactor visible), `### Corrections` (`fix` user-facing).
- **Bannir** des release notes : `chore(release)`, `chore(format)`, `chore(deps)`, `ci(...)`, `test(...)`, `fix(test)`, `refactor` invisible, `docs` interne. Ces commits restent dans `git log`, c'est suffisant.
- **Reformuler en français orienté utilisateur final.** Pas de scope code, pas de jargon. Une phrase par point. Lien commit autorisé quand utile.
- **Jamais `gh release create --generate-notes`** (notes auto = jargon CI). Toujours `--notes-file` depuis `CHANGELOG.md`.
- **Section `## [Unreleased]` en haut du fichier** accumule au fil des merges, bascule en `## [X.Y.Z] - YYYY-MM-DD` au tag.

## Références

- Brief produit : `docs/product-brief.md`
- PRD : `docs/prd.md` (à venir)
- Architecture : `docs/architecture.md` (à venir)
- Pattern outil interne : https://github.com/AlphaLuppi/mnm
- Règles BMAD : `bmad/config.yaml`

## Contact

Mainteneur principal : Tom Andrieu (Seeyko) · contact@alphaluppi.com
