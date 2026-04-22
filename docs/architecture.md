# Architecture — FAKT v0.1.0

**Date :** 2026-04-21 · _addendum 3 modes : 2026-04-22 (Track θ)_
**Auteur :** Tom Andrieu (AlphaLuppi) / Claude agent (System Architect)
**Version :** 1.1 (addendum sidecar)
**Statut :** Draft — à valider avant `/sprint-planning`
**Type de projet :** Application desktop open-source Tauri 2, pattern AlphaLuppi « outil interne »
**Niveau de projet :** 3 (Complex integration)

---

## Addendum 2026-04-22 — Architecture 3 modes (sidecar refacto)

Suite à l'audit E2E ([`docs/sprint-notes/e2e-wiring-audit.md`](./sprint-notes/e2e-wiring-audit.md))
et à la validation par Tom de l'option C (API backend sidecar), la v0.1 bascule vers une
architecture triple-mode unifiée. Cette section résume les choix ; les détails exhaustifs
sont dans [`docs/refacto-spec/architecture.md`](./refacto-spec/architecture.md).

### Vue haut-niveau des 3 modes

**Mode 1 — Solo desktop (v0.1, MVP)**

```
┌──────────────────────────────────────────────────────────────┐
│  Desktop Tauri (installer .msi / .dmg / .AppImage, ~100 Mo)  │
│                                                              │
│  ┌────────────────┐   HTTP localhost   ┌──────────────────┐  │
│  │ React webview │ ─────────────────▶ │ Bun api-server   │  │
│  │ (Vite build)  │  fetch + X-FAKT-   │ Hono REST        │  │
│  │               │    Token header    │ Drizzle SQLite   │  │
│  └────────────────┘ ◀───────────────── └──────────────────┘  │
│         │                                        │           │
│         │ Tauri invoke (signature / email /      │           │
│         │        archive / PDF Typst)            ▼           │
│         ▼                                 ~/.fakt/db.sqlite  │
│  ┌──────────────────────────────┐                            │
│  │ Rust core                    │                            │
│  │  - PAdES B-T + keychain OS   │                            │
│  │  - open_email_draft (.eml)   │                            │
│  │  - build_workspace_zip       │                            │
│  │  - render_pdf (Typst)        │                            │
│  └──────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────┘

Bind api-server : 127.0.0.1:RANDOM_PORT (jamais exposé LAN)
Token : 32 bytes crypto-random au spawn, partagé Rust ↔ webview
```

**Mode 2 — Self-host entreprise (v0.2+)**

```
┌─────────────────────┐              ┌──────────────────────────┐
│ Desktop Tauri       │    HTTPS     │ VPS Docker               │
│ (utilisateur équipe)│ ───────────▶ │ api-server (Bun)         │
│ FAKT_API_URL=https  │  JWT header  │ Drizzle Postgres 16      │
│ ://fakt.agence.com  │              │ Reverse proxy : Caddy    │
└─────────────────────┘              └──────────────────────────┘
```

Même binaire api-server (bundle Bun compile standalone). Différence runtime :
`DATABASE_URL=postgres://...`, `AUTH_MODE=jwt`, `BIND=0.0.0.0:3000`. Le Rust core reste en
desktop — signature et email OS locaux.

**Mode 3 — SaaS hébergé (v0.3+)**

```
┌──────────────────┐          ┌────────────────────────────────┐
│ Desktop Tauri    │          │ fakt.com (Cloud Run / Fly.io)  │
│ ou navigateur    │ ──HTTPS─▶│ api-server scalable            │
│ multi-tenant     │  OAuth   │ Drizzle Postgres + RLS         │
└──────────────────┘          │ Stripe · Clerk · Sentry        │
                              └────────────────────────────────┘
```

Mêmes endpoints REST. Auth : OAuth / session cookie. `workspace_id` résolu server-side
(jamais envoyé par le client), RLS policies par `workspace_id` activées sur Postgres.

### Invariant fondateur

**Les 3 modes partagent le même code `packages/api-server/` et les mêmes queries
`packages/db/`.** Seuls diffèrent l'adapter DB, la couche auth et le bind.

| Dimension             | Mode 1                   | Mode 2                 | Mode 3                      |
|-----------------------|--------------------------|------------------------|-----------------------------|
| DB adapter            | SQLite (better-sqlite3)  | Postgres (postgres-js) | Postgres + RLS              |
| Bind                  | 127.0.0.1                | 0.0.0.0                | 0.0.0.0 derrière LB         |
| Auth                  | Token 32 B local         | JWT / session cookie   | OAuth + session             |
| Workspace resolution  | Seed unique              | JWT claim              | Session → RLS               |
| Bundling              | Bun compile sidecar      | Docker image           | Docker image                |
| TLS                   | non (localhost)          | reverse-proxy Caddy    | LB managed                  |

### Sidecar startup sequence (mode 1)

1. **Rust setup** : génère token 32 bytes (`rand::random`), spawn binaire sidecar avec
   `FAKT_API_TOKEN=<token>` en env, capture `child.stdout`.
2. **Sidecar boot** : bind sur `127.0.0.1:0` (port libre), logue
   `{"event":"listening","port":NNNNN,"pid":PPP}` sur stdout.
3. **Rust port discovery** : lit stdout ligne par ligne jusqu'à matcher l'event
   `listening`. Timeout 10 s → erreur boot.
4. **Healthcheck polling** : `GET http://127.0.0.1:PORT/health` toutes 100 ms jusqu'à
   200, timeout 5 s.
5. **Injection webview** : `Window::execute_javascript()` définit
   `window.__FAKT_API_TOKEN` + `__FAKT_API_PORT` juste avant chargement React.
6. **Shutdown** : au `on_window_event::CloseRequested`, SIGTERM du child, kill -9 après 3 s.

### Data flow runtime

```
React Hook (ex. useClients)
    │
    ▼
apps/desktop/src/api/clients.ts  ── fetch ──▶ api-client.ts
                                                    │
                                 header X-FAKT-Token│
                                 baseURL 127.0.0.1:PORT/api
                                                    ▼
                            packages/api-server/src/routes/clients.ts
                                                    │
                                                    ▼
                            packages/db/src/queries/clients.ts (Drizzle)
                                                    │
                                                    ▼
                                     ~/.fakt/db.sqlite (better-sqlite3)
```

Les opérations qui nécessitent un accès système (keychain OS, file picker natif, envoi
`.eml` via le client mail, subprocess Typst) restent sur Tauri `invoke` direct vers Rust
et **ne passent pas par le sidecar**.

### Rust core — responsabilités conservées (v0.1)

- **Signature PAdES B-T** : RSA 4096 + X.509 + CMS + TSA RFC 3161 + keychain OS
  (`apps/desktop/src-tauri/src/commands/signatures.rs`).
- **Email dispatch** : `open_email_draft` ouvre un `.eml` via client mail OS, fallback
  `mailto:` (`apps/desktop/src-tauri/src/commands/email.rs`).
- **Archive ZIP** : `build_workspace_zip` (crate `zip`) avec CSV clients/prestations +
  PDFs + README compliance Art. L123-22 & Art. 286 CGI.
- **Rendu PDF Typst** : subprocess `typst compile` depuis templates embarqués.
- **Cert X.509** : génération auto-signée + stockage keychain (Windows Credential
  Manager / macOS Keychain / Linux Secret Service via crate `keyring`).

### Détails et sources complémentaires

- Spec complète sidecar : [`docs/refacto-spec/architecture.md`](./refacto-spec/architecture.md)
- Catalogue des 55 endpoints REST : [`docs/refacto-spec/api-endpoints.md`](./refacto-spec/api-endpoints.md)
- Découpage Phase 2 Build : [`docs/refacto-spec/task-breakdown.md`](./refacto-spec/task-breakdown.md)
- Stratégie de test : [`docs/refacto-spec/test-plan.md`](./refacto-spec/test-plan.md)
- Audit de câblage E2E initial : [`docs/sprint-notes/e2e-wiring-audit.md`](./sprint-notes/e2e-wiring-audit.md)
- Journal d'avancement sprint : [`docs/sprint-notes/progress.md`](./sprint-notes/progress.md)

Le reste du présent document décrit l'architecture pré-refacto (mode solo Rust + IPC
direct). Il reste utile pour les modules **conservés** côté Rust (signature, email,
archive, PDF, keychain) et pour le design system Brutal Invoice. Les sections
portant sur le CRUD métier côté IPC sont superseded par le sidecar api-server.

---

## Document Overview

Ce document décrit l'architecture technique complète de **FAKT v0.1.0**. Il tranche les 12 questions ouvertes laissées par le PRD et produit un plan directement exécutable par l'équipe dev.

**Documents liés :**
- Product Brief : [`docs/product-brief.md`](./product-brief.md)
- PRD : [`docs/prd.md`](./prd.md)
- Instructions agent : [`../CLAUDE.md`](../CLAUDE.md)
- Instructions multi-agents : [`../AGENTS.md`](../AGENTS.md)
- Design system source : `.design-ref/gestion-de-facture-et-devis/project/` (bundle local, gitignored)
- Lien web design : https://api.anthropic.com/v1/design/h/woKz9SzD-Eeei1t9yL2HPw

**Portée :** ce document couvre uniquement le mode **solo local** de v0.1.0 (desktop mono-user SQLite). Les modes self-host entreprise (v0.2) et SaaS hébergé (v0.3+) sont résumés dans la section Roadmap mais ne sont pas spécifiés en détail ici.

**Principes directeurs (rappel CLAUDE.md) :**
1. Stack non-négociable (Tauri 2, Bun, Drizzle, Typst, Claude CLI subprocess, PAdES maison, Brutal Invoice).
2. Offline-first — fonctionnalités critiques utilisables sans réseau.
3. Conformité légale FR non-négociable (CGI art. 289/293 B, archivage 10 ans).
4. Déterminisme des artefacts (PDFs bit-à-bit reproductibles, migrations idempotentes).
5. Sécurité par défaut (keychain OS, audit trail append-only, zéro secret en DB).

---

## Executive Summary Architecture

FAKT est découpé en **un monorepo Bun** contenant 11 packages TS et 1 application Tauri. Le frontend React 19 communique avec le backend Rust via trois mécanismes IPC (commands, events, channels) choisis selon la nature de l'opération. Les artefacts métier sensibles (signature PAdES, gestion certificats, subprocess Claude CLI, rendu Typst, accès SQLite) sont implémentés côté Rust pour isoler les secrets et bénéficier du sandbox Tauri.

**Pattern architectural retenu :** modular monolith côté Rust (un seul binaire Tauri) avec séparation par domaines, et couche UI React modulaire par feature. Chaque package TS expose une API stable consommée par `apps/desktop`.

**Trade-offs majeurs tranchés :**
- PAdES : DIY avec `lopdf` + `rsa` + `x509-parser` + `cms` (pas de crate clé-en-main).
- ORM : Drizzle single schema avec adapters `better-sqlite3` (v0.1) et `postgres-js` (v0.2, préparé).
- State React : **TanStack Query + Zustand** (split serveur/UI-local).
- IPC : commands par défaut, channels `Channel<T>` pour streaming Claude CLI, events pour notifs système (backup, migrations).
- CI signing : GitHub Actions + `tauri-apps/tauri-action` v2 + secrets org AlphaLuppi.

**Hors cadre v0.1 (reporté)** : Agent SDK embed, portail client, backend self-host, SaaS.

---

## 1. Vue d'ensemble système

### 1.1 Pattern

**Monolith modulaire desktop** — un seul processus Tauri qui embarque :
- un **backend Rust** (`apps/desktop/src-tauri`) pour les opérations système, crypto, I/O disque, subprocess ;
- un **frontend React** (`apps/desktop/src`) pour l'UI Brutal Invoice ;
- une **SQLite locale** (fichier dans `~/.fakt/data/fakt.db`) accédée exclusivement côté Rust via `better-sqlite3` (Node) **non** — en fait via la lib Rust `rusqlite` dans le backend + Drizzle côté TS pour le typage et les migrations (voir section 5).

### 1.2 Composants majeurs (vue logique)

| Composant | Rôle | Localisation |
|---|---|---|
| **UI Shell** | Layout brutaliste, routing, state global | `apps/desktop/src` + `packages/ui` |
| **Data Layer** | Schema Drizzle, migrations, repositories | `packages/db` + `apps/desktop/src-tauri/src/db/` |
| **Core Domain** | Modèles métier purs TS (devis, factures, numérotation) | `packages/core` |
| **PDF Renderer** | Compile Typst → PDF | `packages/pdf` + binary Typst Rust-linked |
| **Crypto/PAdES** | Génération cert, signature, horodatage, audit | `packages/crypto` + `src-tauri/src/crypto/` |
| **AI Gateway** | Subprocess Claude CLI, prompt templates, streaming | `packages/ai` + `src-tauri/src/ai/` |
| **Email Draft** | Génération .eml + handler OS | `packages/email` + `src-tauri/src/email/` |
| **Legal Rules** | Mentions obligatoires FR, validateurs Zod | `packages/legal` |
| **Design Tokens** | Tokens Brutal Invoice (Tailwind plugin) | `packages/design-tokens` |
| **Config** | Settings workspace, keychain access | `packages/config` + `src-tauri/src/config/` |
| **Shared** | Types partagés TS↔Rust, i18n, utils | `packages/shared` |

### 1.3 Flux de données (exemple signature)

1. User clique « Signer » (React) → `invoke("sign_document", { docId })`.
2. Rust backend : lit le PDF final depuis `~/.fakt/documents/…`, calcule SHA-256.
3. Rust : récupère la clé privée RSA 4096 dans le keychain OS via crate `keyring`.
4. Rust : signe le hash (crate `rsa` avec padding PKCS#1 v1.5).
5. Rust : POST HTTP à FreeTSA (crate `reqwest`) → reçoit la TimeStampResponse.
6. Rust : embarque signature + TSR dans le PDF via `lopdf` + structure CMS (`cms` crate).
7. Rust : écrit le PDF signé sur disque, insère événement dans `signature_events` (chaîne de hash).
8. Rust retourne `SignatureResult` au frontend → React met à jour le statut du document.

---

## 2. Drivers architecturaux (NFR prioritaires)

Les NFRs qui pèsent le plus sur les décisions d'architecture :

| NFR | Driver | Impact design |
|---|---|---|
| **NFR-003** Installer ≤ 15 Mo | Tauri 2 obligatoire (vs Electron) | Webview OS natif, pas de runtime Node embarqué côté frontend |
| **NFR-004** Conformité légale FR | Numérotation atomique, archivage 10 ans, mentions | Table `numbering_state` + transactions IMMEDIATE, triggers SQL anti-UPDATE/DELETE, `archived_at` nullable |
| **NFR-001** Startup ≤ 2s | Pas d'init réseau bloquante, lazy-load DB | Migrations async en background, splash minimal, DB connect en tâche détachée |
| **NFR-002** PDF render ≤ 3s | Typst natif (pas Puppeteer) | `typst-cli` linked-in ou `typst` crate embedded (décision 7.3) |
| **NFR-005** Secrets keychain | Crate `keyring` obligatoire | Fallback fichier AES-256 en dernier recours, jamais de secret en DB |
| **NFR-007** Offline-first | Pas de dépendance réseau critique | Claude CLI = graceful degradation, FreeTSA = fallback PAdES-B sans timestamp |
| **NFR-011** Cross-platform 3 OS | CI matrix + tests E2E sur 3 OS | Toute crate Rust doit compiler sur `x86_64-pc-windows-msvc`, `x86_64-apple-darwin`, `aarch64-apple-darwin`, `x86_64-unknown-linux-gnu` |
| **NFR-012** Fiabilité données | WAL mode + backup auto | `journal_mode=WAL`, `VACUUM INTO` quotidien, autosave débouncé 500ms → flush 5s |

Les autres NFRs (006 validation, 008 a11y, 009 i18n-ready, 010 coverage) influencent les conventions code mais pas la structure macro.

---

## 3. Stack technologique (arrêtée et justifiée)

### 3.1 Frontend

| Choix | Justification | Trade-off |
|---|---|---|
| **React 19** | Ecosystem mature, RSC non requis (app desktop), concurrent rendering pour UI fluide | Bundle size acceptable car webview OS |
| **Vite 6** | HMR rapide, config simple, bon support Tauri | — |
| **TypeScript strict** | `any` interdit (CLAUDE.md), `unknown` + type guards | Courbe apprentissage nouveaux contributeurs |
| **Tailwind v4** | CSS-in-JS zero-runtime, tokens faciles à porter depuis Brutal Invoice CSS | v4 encore récente, peu de plugins tiers |
| **shadcn/ui** (base only) | Composants accessibles qu'on overrride avec tokens Brutal | Certains composants shadcn inadaptés (DatePicker → on fait custom) |
| **TanStack Query v5** | Cache serveur (Tauri invoke), refetch, offline mutation queue | Boilerplate pour mutations |
| **Zustand** | State UI local (composer ouvert, sidebar collapsed, filtres listes) | Pas de devtools aussi riches que Redux |
| **React Hook Form + Zod** | Validation de formulaires type-safe | — |
| **Lucide** icons | SVG géométriques cohérents avec design brutaliste | — |
| **react-router v7** | Routing déclaratif, nested routes | — |

### 3.2 Backend Rust (Tauri)

| Choix | Justification | Trade-off |
|---|---|---|
| **Tauri 2.x** (`>= 2.1`) | Webview natif, sandbox, channels, bundler 3 OS | Écosystème plus jeune qu'Electron |
| **Rust 1.75+** | Sécurité mémoire, performance | Compile time |
| **`rusqlite` + bundled SQLite** | SQLite embed, contrôle précis transactions | Pas de pool (un connect par thread) — acceptable desktop mono-user |
| **`drizzle-orm`** côté TS + `rusqlite` côté Rust | Migrations gérées via Drizzle Kit, queries typées côté TS ; Rust exécute SQL généré | Duplication schéma — mitigé via codegen (section 5.4) |
| **`serde` + `serde_json`** | Sérialisation commande Tauri | — |
| **`tokio` 1.x** | Runtime async pour HTTP FreeTSA, subprocess Claude | Lourd mais nécessaire |
| **`reqwest`** | HTTP client (FreeTSA, update check) | — |
| **`keyring`** | Accès keychain OS cross-platform | Fallback AES-256 à coder |
| **`lopdf`** | Manip PDF bas niveau pour PAdES | API verbose |
| **`rsa`** | Signature RSA 4096 | Crate audit OK |
| **`x509-parser`** + **`x509-cert`** | Parse/génère X.509 | 2 crates complémentaires |
| **`cms`** | Encodage CMS/PKCS#7 pour signature PAdES | Écosystème Rust plus faible ici, alternative wrap OpenSSL |
| **`sha2`** | SHA-256 hash PDF + chaîne audit | — |
| **`tracing` + `tracing-subscriber`** | Logging structuré (rotation fichier via `tracing-appender`) | — |
| **`typst`** (crate) | Compile Typst → PDF in-process | Plus stable que subprocess CLI |

### 3.3 Base de données

| Choix | Version | Justification |
|---|---|---|
| **SQLite 3.45+** bundled via `rusqlite` | embed | Offline-first, zéro install, backup fichier |
| **WAL mode** | — | Crash recovery, perf lectures concurrentes |
| **PRAGMA `foreign_keys = ON`** | — | Intégrité relationnelle |
| **PRAGMA `synchronous = NORMAL`** | — | Bon compromis perf/sécurité avec WAL |
| **PostgreSQL 16** (préparé v0.2) | — | Pour self-host entreprise via adapter Drizzle |

### 3.4 Moteur documents

| Choix | Justification |
|---|---|
| **Typst 0.12+** (crate embedded) | Compile déterministe, rapide (< 500ms/doc), zéro Chrome/LaTeX |
| **Templates `.typ`** dans `packages/pdf/templates/` | Hot-reload en dev, split partials |

### 3.5 Moteur IA

| Choix | Justification |
|---|---|
| **`claude` CLI** (user fourni, version détectée ≥ 2.0) | Pas de clé Anthropic embarquée, zéro responsabilité billing pour AlphaLuppi, respect du modèle « user owns his token » |
| **Subprocess via `tokio::process::Command`** | Streaming stdout via `Channel<T>` Tauri |

### 3.6 Packaging & CI

| Choix | Justification |
|---|---|
| **Bun workspaces** 1.3+ | Pattern MnM, install rapide, bun run scripts |
| **Turborepo** 2.x | Orchestration tâches (typecheck, test, build), cache local + remote |
| **Biome** 1.9+ | Lint + format unifié TS/JSON, plus rapide qu'ESLint+Prettier |
| **Vitest** 2.x | Tests unitaires TS |
| **Playwright** + `tauri-driver` | E2E cross-OS |
| **GitHub Actions** | CI/CD, code-signing, releases |
| **`tauri-apps/tauri-action` v2** | Workflow officiel build cross-OS |

### 3.7 Services externes

| Service | Usage | Criticité | Coût |
|---|---|---|---|
| **FreeTSA.org** | Horodatage RFC 3161 PAdES-B-T | Medium (fallback PAdES-B) | Gratuit |
| **Apple Developer Program** | Notarization macOS `.dmg` | High pour UX release | 99 USD/an |
| **Windows OV Code Signing Cert** | Authenticode `.msi` Windows | High pour UX release | ~200 USD/an |
| **Plausible self-host** | Télémétrie opt-in | Low (off par défaut) | Infra AlphaLuppi |
| **Anthropic API** (via Claude CLI user) | IA devis extraction | Medium (graceful deg) | User's tab |

---

## 4. Structure monorepo (Bun workspaces)

### 4.1 Arborescence cible

```
facture-devis/                           # Racine repo AlphaLuppi/FAKT
├── apps/
│   └── desktop/                          # Application Tauri (seule app v0.1)
│       ├── src/                          # Frontend React
│       │   ├── main.tsx                  # Entry point Vite
│       │   ├── App.tsx                   # Shell + routing
│       │   ├── routes/                   # react-router v7 routes
│       │   │   ├── dashboard.tsx
│       │   │   ├── quotes/               # Liste + détail devis
│       │   │   ├── invoices/
│       │   │   ├── clients/
│       │   │   ├── services/             # Prestations
│       │   │   └── settings/
│       │   ├── features/                 # Composants feature-oriented
│       │   │   ├── composer/             # Sidebar IA
│       │   │   ├── signature/            # Modal canvas + embed
│       │   │   ├── onboarding/           # Wizard first-launch
│       │   │   └── email-draft/
│       │   ├── hooks/                    # TanStack Query hooks typés
│       │   ├── stores/                   # Zustand stores
│       │   ├── styles/
│       │   │   └── globals.css           # Import @tailwind + tokens
│       │   └── lib/
│       │       └── tauri.ts              # Wrapper typé autour de invoke/Channel
│       ├── src-tauri/                    # Backend Rust
│       │   ├── src/
│       │   │   ├── main.rs               # Entry Tauri (setup, plugins)
│       │   │   ├── lib.rs                # Re-exports modules
│       │   │   ├── commands/             # Tauri #[command] handlers
│       │   │   │   ├── mod.rs
│       │   │   │   ├── clients.rs
│       │   │   │   ├── quotes.rs
│       │   │   │   ├── invoices.rs
│       │   │   │   ├── signature.rs
│       │   │   │   ├── pdf.rs
│       │   │   │   ├── ai.rs
│       │   │   │   ├── email.rs
│       │   │   │   ├── settings.rs
│       │   │   │   └── backup.rs
│       │   │   ├── db/                   # rusqlite + queries typées
│       │   │   ├── crypto/               # PAdES, cert X.509, keychain
│       │   │   ├── ai/                   # Subprocess Claude CLI
│       │   │   ├── pdf/                  # Wrapper Typst
│       │   │   ├── email/                # Générateur .eml
│       │   │   ├── legal/                # Validateurs numérotation, SIRET
│       │   │   └── telemetry/            # Plausible opt-in
│       │   ├── tauri.conf.json           # Config Tauri (bundle, permissions)
│       │   ├── Cargo.toml
│       │   └── build.rs
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── core/                             # Domain models + business logic pur TS
│   │   ├── src/
│   │   │   ├── models/                   # Client, Prestation, Quote, Invoice, etc.
│   │   │   ├── numbering/                # Générateur D2026-XXX / F2026-XXX
│   │   │   ├── pricing/                  # Calculs HT, totaux, acompte
│   │   │   ├── status/                   # State machines quote/invoice
│   │   │   └── validation/               # Schémas Zod
│   │   └── package.json
│   ├── db/                               # Drizzle schemas + migrations
│   │   ├── src/
│   │   │   ├── schema/                   # schema.ts (sqlite) + schema-pg.ts (pg)
│   │   │   ├── migrations/               # Générées par drizzle-kit
│   │   │   ├── adapters/                 # sqlite.ts, postgres.ts
│   │   │   └── queries/                  # Queries réutilisables typées
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── pdf/                              # Wrapper Typst + templates
│   │   ├── src/
│   │   │   ├── render.ts                 # API render(template, ctx) → PDF buffer
│   │   │   ├── templates.ts              # Registry des templates
│   │   │   └── context-builder.ts        # Sérialise Quote/Invoice → JSON Typst
│   │   ├── templates/                    # Fichiers .typ
│   │   │   ├── base.typ
│   │   │   ├── quote.typ
│   │   │   ├── invoice.typ
│   │   │   └── partials/
│   │   │       ├── header.typ
│   │   │       ├── client-block.typ
│   │   │       ├── lines-table.typ
│   │   │       ├── totals.typ
│   │   │       ├── legal-mentions.typ
│   │   │       ├── signature-block.typ
│   │   │       └── footer.typ
│   │   ├── tests/
│   │   │   └── golden/                   # PDFs de référence
│   │   └── package.json
│   ├── crypto/                           # Wrapper TS autour des commands crypto Rust
│   │   ├── src/
│   │   │   ├── index.ts                  # generateCert, signPdf, verifySig
│   │   │   └── types.ts                  # SignatureResult, CertInfo
│   │   └── package.json
│   ├── ai/                               # Wrapper Claude CLI
│   │   ├── src/
│   │   │   ├── client.ts                 # Interface AiProvider (swap-ready)
│   │   │   ├── providers/
│   │   │   │   └── claude-cli.ts         # impl subprocess
│   │   │   ├── prompts/                  # Templates par action
│   │   │   │   ├── extract-quote.ts
│   │   │   │   ├── rewrite-reminder.ts
│   │   │   │   └── suggest-service.ts
│   │   │   └── streaming.ts              # Channel<T> typing
│   │   └── package.json
│   ├── email/                            # Générateur .eml
│   │   ├── src/
│   │   │   ├── build-eml.ts              # RFC 5322 builder
│   │   │   ├── templates/                # Templates markdown/texte
│   │   │   └── mailto-fallback.ts
│   │   └── package.json
│   ├── ui/                               # Composants React Brutal Invoice
│   │   ├── src/
│   │   │   ├── primitives/               # Button, Input, Chip, Modal, Card
│   │   │   ├── layout/                   # Sidebar, Topbar, PageShell
│   │   │   ├── data/                     # DataTable, FilterBar, Pagination
│   │   │   ├── feedback/                 # Toast, Banner, ProgressBar
│   │   │   └── status/                   # StatusChip, KPI, Sparkline
│   │   └── package.json
│   ├── design-tokens/                    # Tokens Brutal Invoice
│   │   ├── src/
│   │   │   ├── tokens.css                # --ink, --paper, --accent-soft, etc.
│   │   │   ├── tokens.ts                 # Objet TS typé
│   │   │   └── tailwind-plugin.ts        # Plugin Tailwind v4
│   │   └── package.json
│   ├── legal/                            # Mentions, numérotation, validateurs FR
│   │   ├── src/
│   │   │   ├── mentions.ts               # TVA non applicable, pénalités, etc.
│   │   │   ├── numbering.ts              # Validation format + séquence
│   │   │   ├── siret.ts                  # Validation Luhn + format
│   │   │   └── fr-formatters.ts          # Dates, montants, IBAN
│   │   └── package.json
│   ├── config/                           # Settings + keychain
│   │   ├── src/
│   │   │   ├── workspace.ts              # Schéma settings workspace
│   │   │   ├── keychain.ts               # Wrapper cross-OS (TS, délégué Rust)
│   │   │   └── paths.ts                  # Résolution ~/.fakt/
│   │   └── package.json
│   └── shared/                           # Types partagés + utils + i18n
│       ├── src/
│       │   ├── types/                    # Types DTO partagés front↔Rust
│       │   ├── ipc/                      # Enum IPC commands + event names
│       │   ├── i18n/
│       │   │   └── fr.ts                 # Toutes les chaînes UI en FR
│       │   └── utils/
│       └── package.json
├── tests/
│   ├── e2e/                              # Playwright tauri-driver
│   └── fixtures/                         # Données + PDFs tests
├── docs/
│   ├── product-brief.md
│   ├── prd.md
│   ├── architecture.md                   # (ce document)
│   ├── bmm-workflow-status.yaml
│   └── stories/
├── _bmad-output/                         # Outputs BMAD (pattern MnM)
├── bmad/
│   └── config.yaml
├── .github/
│   └── workflows/
│       ├── ci.yml                        # typecheck + lint + test + cargo test
│       ├── e2e.yml                       # Playwright matrix 3 OS
│       └── release.yml                   # tauri-action + signing
├── .design-ref/                          # (gitignored, bundle design Anthropic)
├── scripts/
│   ├── dev.sh                            # Lance Vite + tauri dev en parallèle
│   ├── bootstrap.sh                      # Install toolchain (rustup, bun)
│   └── generate-ipc-types.ts             # Codegen types IPC TS depuis Rust
├── .gitignore
├── .bun-version
├── bun.lockb
├── package.json                          # Root: workspaces + scripts + devDeps partagés
├── turbo.json                            # Pipeline Turborepo
├── biome.json                            # Config Biome
├── tsconfig.base.json                    # Config TS partagée
├── README.md
├── CONTRIBUTING.md
├── CLAUDE.md
├── AGENTS.md
└── LICENSE                               # BSL 1.1
```

### 4.2 Dépendances inter-packages

```
apps/desktop
  ├── depends on: ui, design-tokens, core, legal, crypto, ai, email, pdf, config, shared, db (types)
packages/ui
  ├── depends on: design-tokens, shared (i18n)
packages/core
  ├── depends on: legal (mentions), shared (types)
packages/db
  ├── depends on: core (types), shared (types)
packages/pdf
  ├── depends on: core, legal, design-tokens (couleurs charte)
packages/crypto
  ├── depends on: shared (types)
packages/ai
  ├── depends on: shared, core (types DTO)
packages/email
  ├── depends on: core, shared
packages/legal
  ├── depends on: shared
packages/config
  ├── depends on: shared
packages/design-tokens
  └── depends on: (none — feuille)
packages/shared
  └── depends on: (none — feuille)
```

**Règle :** aucune dépendance circulaire. `shared` et `design-tokens` sont les feuilles. `core` et `legal` sont les couches basses métier.

### 4.3 Configuration Bun workspaces

Fichier `package.json` racine :

```json
{
  "name": "fakt",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run scripts/dev.sh",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "turbo run test",
    "test:e2e": "playwright test",
    "db:generate": "bun --cwd packages/db drizzle-kit generate",
    "db:migrate": "bun --cwd packages/db drizzle-kit migrate",
    "ipc:gen": "bun run scripts/generate-ipc-types.ts",
    "release": "turbo run build && bun --cwd apps/desktop tauri build"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9",
    "turbo": "^2.3",
    "typescript": "^5.6",
    "@playwright/test": "^1.49"
  }
}
```

### 4.4 Pipeline Turborepo

Fichier `turbo.json` :

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": { "outputs": [] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

---

## 5. Data model (Drizzle + SQLite)

### 5.1 Vue d'ensemble

SQLite est accédée exclusivement côté Rust via `rusqlite`. Le schéma et les migrations sont définis via **Drizzle côté TS** (meilleure DX, types partagés côté frontend via `@fakt/db`). Les migrations SQL générées par Drizzle Kit sont embarquées en tant qu'assets dans le binaire Tauri et exécutées par le backend Rust au boot (voir section 14).

**Réponse à l'open question 5** (ORM dual SQLite+PostgreSQL) : **un seul schéma source Drizzle en SQLite dialect**. Un second fichier `schema-pg.ts` dérive le schéma PG en v0.2 via une fonction de traduction (les différences portent surtout sur `integer` vs `bigint` pour les timestamps et sur `text` vs `varchar`). Les migrations sont générées séparément par dialect mais testées par un suite commun.

### 5.2 Entités principales

| Table | Description | Soft delete ? |
|---|---|---|
| `workspaces` | Identité légale (1 seul en v0.1) | Non |
| `settings` | K/V paramètres workspace (cert public, templates email, téléméètrie) | Non |
| `clients` | Clients du workspace | Oui (`archived_at`) |
| `services` | Bibliothèque prestations | Oui (`archived_at`) |
| `quotes` | Devis | Oui (archivage 10 ans) |
| `quote_items` | Lignes devis | Cascade delete via quote |
| `invoices` | Factures | Oui **obligatoire** (FR-022 archivage légal) |
| `invoice_items` | Lignes factures | Cascade delete via invoice |
| `numbering_state` | Compteur séquentiel par (workspace, type, année) | Non |
| `signature_events` | Audit trail append-only | **Never delete** (triggers) |
| `activity` | Événements UX (envoi, vue, paiement) | Non |
| `backups` | Métadonnées sauvegardes auto | Non |

### 5.3 DDL Drizzle — extrait clé

Fichier `packages/db/src/schema/index.ts` (extrait) :

```ts
import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),                              // UUID v7
  name: text("name").notNull(),
  legalForm: text("legal_form").notNull(),                  // "Micro-entreprise"
  siret: text("siret").notNull(),                           // 14 chiffres
  address: text("address").notNull(),
  email: text("email").notNull(),
  iban: text("iban"),
  tvaMention: text("tva_mention").notNull()                 // "TVA non applicable, art. 293 B du CGI"
    .default("TVA non applicable, art. 293 B du CGI"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const settings = sqliteTable("settings", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  key: text("key").notNull(),                               // "cert_public_pem", "email_templates", etc.
  value: text("value").notNull(),                           // JSON stringified
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => ({
  pk: unique().on(t.workspaceId, t.key),
}));

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  legalForm: text("legal_form"),
  siret: text("siret"),
  address: text("address"),
  contactName: text("contact_name"),
  email: text("email"),
  sector: text("sector"),
  firstCollaboration: integer("first_collab", { mode: "timestamp_ms" }),
  note: text("note"),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  emailUniq: unique("clients_email_ws_uq").on(t.workspaceId, t.email),
  nameIdx: index("clients_name_idx").on(t.name),
}));

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull(),                             // "forfait", "jour", "heure"...
  unitPriceCents: integer("unit_price_cents").notNull(),    // integer cents, pas de float
  tags: text("tags"),                                       // JSON array stringified
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const numberingState = sqliteTable("numbering_state", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  year: integer("year").notNull(),
  type: text("type", { enum: ["quote", "invoice"] }).notNull(),
  lastSequence: integer("last_sequence").notNull().default(0),
}, (t) => ({
  pk: unique("numbering_pk").on(t.workspaceId, t.year, t.type),
}));

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  number: text("number"),                                   // NULL en draft, assigné à l'émission
  year: integer("year"),
  sequence: integer("sequence"),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["draft", "sent", "viewed", "signed", "refused", "expired"]
  }).notNull().default("draft"),
  totalHtCents: integer("total_ht_cents").notNull().default(0),
  conditions: text("conditions"),
  validityDate: integer("validity_date", { mode: "timestamp_ms" }),
  notes: text("notes"),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }),
  signedAt: integer("signed_at", { mode: "timestamp_ms" }),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  numberUniq: unique("quotes_number_uq").on(t.workspaceId, t.year, t.type ?? sql`'quote'`, t.sequence),
  statusIdx: index("quotes_status_idx").on(t.status),
  clientIdx: index("quotes_client_idx").on(t.clientId),
}));

export const quoteItems = sqliteTable("quote_items", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),                  // ordre d'affichage
  description: text("description").notNull(),
  quantity: integer("quantity_milli").notNull(),            // quantité × 1000 (ex: 1.5 = 1500)
  unitPriceCents: integer("unit_price_cents").notNull(),
  unit: text("unit").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
  serviceId: text("service_id").references(() => services.id),  // NULL si saisie libre
}, (t) => ({
  posIdx: index("quote_items_pos_idx").on(t.quoteId, t.position),
}));

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  quoteId: text("quote_id").references(() => quotes.id),   // NULL si facture indépendante
  number: text("number"),
  year: integer("year"),
  sequence: integer("sequence"),
  kind: text("kind", { enum: ["deposit", "balance", "total", "independent"] }).notNull(),
  depositPercent: integer("deposit_percent"),               // si kind = deposit
  title: text("title").notNull(),
  status: text("status", {
    enum: ["draft", "sent", "paid", "overdue", "cancelled"]
  }).notNull().default("draft"),
  totalHtCents: integer("total_ht_cents").notNull().default(0),
  dueDate: integer("due_date", { mode: "timestamp_ms" }),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  paymentMethod: text("payment_method"),                    // "wire", "check", "cash", "other"
  legalMentions: text("legal_mentions").notNull(),          // snapshot des mentions au moment de l'émission
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  numberUniq: unique("invoices_number_uq").on(t.workspaceId, t.year, t.sequence),
  statusIdx: index("invoices_status_idx").on(t.status),
  dueIdx: index("invoices_due_idx").on(t.dueDate),
}));

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity_milli").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  unit: text("unit").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
  serviceId: text("service_id").references(() => services.id),
});

export const signatureEvents = sqliteTable("signature_events", {
  id: text("id").primaryKey(),
  documentType: text("document_type", { enum: ["quote", "invoice"] }).notNull(),
  documentId: text("document_id").notNull(),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  docHashBefore: text("doc_hash_before").notNull(),         // SHA-256 du PDF non signé
  docHashAfter: text("doc_hash_after").notNull(),           // SHA-256 du PDF signé PAdES
  signaturePngBase64: text("signature_png_base64").notNull(),
  previousEventHash: text("previous_event_hash"),           // NULL pour l'event #1
  tsaResponse: text("tsa_response"),                        // TSR base64, NULL si mode PAdES-B
  tsaProvider: text("tsa_provider"),                        // "freetsa.org", fallback, ou NULL
}, (t) => ({
  docIdx: index("sigevents_doc_idx").on(t.documentType, t.documentId),
  chainIdx: index("sigevents_prev_idx").on(t.previousEventHash),
}));

export const activity = sqliteTable("activity", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  type: text("type").notNull(),                             // "quote_sent", "invoice_paid", etc.
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  payload: text("payload"),                                 // JSON
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => ({
  createdIdx: index("activity_created_idx").on(t.createdAt),
}));

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});
```

### 5.4 Contraintes SQL critiques (triggers)

Certaines contraintes dépassent ce que Drizzle exprime ; elles sont injectées via SQL brut dans les migrations manuelles (fichier `packages/db/src/migrations/0001_triggers.sql`) :

```sql
-- Append-only enforcement sur signature_events
CREATE TRIGGER signature_events_no_update
  BEFORE UPDATE ON signature_events
  BEGIN
    SELECT RAISE(ABORT, 'signature_events is append-only');
  END;

CREATE TRIGGER signature_events_no_delete
  BEFORE DELETE ON signature_events
  BEGIN
    SELECT RAISE(ABORT, 'signature_events is append-only');
  END;

-- Interdit le hard-delete d'une facture émise (conformité 10 ans)
CREATE TRIGGER invoices_no_hard_delete_issued
  BEFORE DELETE ON invoices
  WHEN OLD.status != 'draft'
  BEGIN
    SELECT RAISE(ABORT, 'cannot hard-delete issued invoice; use archive');
  END;

-- Numérotation : une fois number/year/sequence attribués, ils sont immuables
CREATE TRIGGER quotes_immutable_number
  BEFORE UPDATE ON quotes
  WHEN OLD.number IS NOT NULL AND (NEW.number != OLD.number OR NEW.year != OLD.year OR NEW.sequence != OLD.sequence)
  BEGIN
    SELECT RAISE(ABORT, 'quote number is immutable once assigned');
  END;

CREATE TRIGGER invoices_immutable_number
  BEFORE UPDATE ON invoices
  WHEN OLD.number IS NOT NULL AND (NEW.number != OLD.number OR NEW.year != OLD.year OR NEW.sequence != OLD.sequence)
  BEGIN
    SELECT RAISE(ABORT, 'invoice number is immutable once assigned');
  END;
```

### 5.5 Numérotation atomique (implémentation FR-010)

Fichier `apps/desktop/src-tauri/src/db/numbering.rs` :

```rust
pub fn next_number(conn: &mut Connection, workspace_id: &str, doc_type: &str) -> Result<(i32, i32), Error> {
    let year = chrono::Utc::now().year();
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;

    // Upsert-and-increment atomique
    tx.execute(
        "INSERT INTO numbering_state (workspace_id, year, type, last_sequence)
         VALUES (?1, ?2, ?3, 1)
         ON CONFLICT(workspace_id, year, type)
         DO UPDATE SET last_sequence = last_sequence + 1",
        params![workspace_id, year, doc_type],
    )?;

    let sequence: i32 = tx.query_row(
        "SELECT last_sequence FROM numbering_state
         WHERE workspace_id = ?1 AND year = ?2 AND type = ?3",
        params![workspace_id, year, doc_type],
        |r| r.get(0),
    )?;

    tx.commit()?;
    Ok((year, sequence))
}
```

`BEGIN IMMEDIATE` garantit qu'aucune autre écriture SQLite ne peut intercaler entre l'incrément et le commit.

### 5.6 Chemin DB

- **Windows** : `%APPDATA%\FAKT\fakt.db`
- **macOS** : `~/Library/Application Support/FAKT/fakt.db`
- **Linux** : `~/.local/share/FAKT/fakt.db`

Résolu via `dirs::data_dir()` en Rust + constante `APP_NAME = "FAKT"`.

---

## 6. IPC Tauri frontend ↔ backend Rust

**Réponse à l'open question 3 :** trois mécanismes utilisés selon la nature de l'échange.

### 6.1 Règle d'usage

| Mécanisme | Quand l'utiliser | Exemple |
|---|---|---|
| **`invoke()` command** | Opération request/response synchrone ou async courte (< 3s) | `list_clients`, `create_quote`, `render_pdf` |
| **`emit/listen` event** | Notification multi-consumer, événements système globaux | `backup_completed`, `migration_started`, `claude_cli_detected` |
| **`Channel<T>` stream** | Stream long unidirectionnel Rust → Front (tokens LLM, progress) | `ai_extract_quote_stream`, `export_backup_progress` |

### 6.2 Commands exposés (catalogue)

Commandes principales groupées par domaine. Chaque commande côté Rust est annotée `#[tauri::command]` et type-checkée via `serde`. Le frontend les appelle via wrapper typé `packages/shared/src/ipc/`.

**Workspace & Settings**
- `get_workspace()` → `Workspace`
- `update_workspace(patch: WorkspacePatch)` → `Workspace`
- `get_settings()` → `Settings`
- `update_settings(patch: SettingsPatch)` → `Settings`
- `check_claude_cli()` → `ClaudeCliStatus` (version, path, ready?)

**Onboarding**
- `onboarding_run(input: OnboardingInput)` → `OnboardingResult` (crée workspace + cert + DB)
- `generate_user_certificate()` → `CertInfo` (retourne public PEM, stocke privé en keychain)

**Clients**
- `list_clients(filter: ClientFilter)` → `Client[]`
- `get_client(id: string)` → `Client | null`
- `create_client(input: CreateClientInput)` → `Client`
- `update_client(id: string, patch: ClientPatch)` → `Client`
- `archive_client(id: string)` → void

**Prestations (services)**
- `list_services(filter)` / `create_service` / `update_service` / `archive_service`

**Quotes**
- `list_quotes(filter)` / `get_quote(id)` / `create_quote(input)` / `update_quote(id, patch)` / `issue_quote(id)` / `expire_quote(id)` / `cancel_quote(id)` / `duplicate_quote(id)`

**Invoices**
- `list_invoices(filter)` / `get_invoice(id)` / `create_invoice_from_quote(quoteId, kind, percent?)` / `create_invoice_independent(input)` / `mark_invoice_paid(id, paidAt, method, note?)` / `archive_invoice(id)`

**Numérotation**
- `preview_next_number(type: "quote" | "invoice")` → `"D2026-015"` (lecture seule, pas d'incrémentation)

**PDF**
- `render_quote_pdf(quoteId, variant: "draft" | "final")` → `PdfRenderResult { path, size, hash }`
- `render_invoice_pdf(invoiceId)` → `PdfRenderResult`
- `get_pdf_path(docType, docId)` → `string`

**Signature**
- `sign_document(input: SignInput)` → `SignatureResult` ; `input` inclut docType, docId, signatureImageBase64, mode (`draw` | `type`)
- `get_signature_events(docType, docId)` → `SignatureEvent[]`
- `verify_audit_chain(fromEventId?: string)` → `AuditVerification`

**AI (mix command + channel)**
- `ai_is_available()` → `bool`
- `ai_extract_quote_from_brief(briefText: string)` → `ExtractedQuote` (command courte, retourne le JSON structuré final)
- `ai_extract_quote_stream(briefText: string, channel: Channel<AiStreamEvent>)` → void (stream tokens pour UX « Claude réfléchit »)
- `ai_generate_email_reminder(invoiceId: string)` → `DraftEmail`
- `ai_suggest_service(description: string)` → `ServiceSuggestion`

**Email**
- `prepare_email_draft(input: DraftInput)` → `DraftResult { emlPath }`
- `open_email_draft(emlPath: string)` → void (délègue à l'OS handler)

**Backup & Export**
- `trigger_backup_now()` → `BackupResult`
- `list_backups()` → `Backup[]`
- `export_workspace_zip(channel: Channel<ExportProgress>)` → `ExportResult { zipPath }`
- `export_document_pdf(docType, docId, destPath)` → void

**Télémétrie**
- `telemetry_opt_in(optedIn: bool)` → void
- `telemetry_track(event: string, props?)` → void (no-op si opt-out)

### 6.3 Events système (emit → listen)

Events broadcasté par Rust, consommés par React (TanStack Query invalidation, toasts).

| Event | Payload | Consumers |
|---|---|---|
| `workspace-updated` | `Workspace` | Invalidation cache TanStack |
| `migration-progress` | `{ step, totalSteps, message }` | Splash screen onboarding |
| `backup-completed` | `Backup` | Toast + refresh list backups |
| `claude-cli-status-changed` | `ClaudeCliStatus` | Composer IA, settings |
| `document-status-changed` | `{ docType, docId, newStatus }` | Listes + détail |
| `invoice-overdue-detected` | `Invoice[]` | Dashboard refresh |
| `signature-embed-done` | `SignatureResult` | Modal success + refresh |

### 6.4 Channels — streaming Claude CLI

Exemple typé TS (côté React) + Rust :

```ts
// packages/ai/src/providers/claude-cli.ts
import { Channel, invoke } from "@tauri-apps/api/core";

export type AiStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_call"; name: string; args: unknown }
  | { type: "done"; result: ExtractedQuote }
  | { type: "error"; message: string };

export async function extractQuoteStream(
  briefText: string,
  onEvent: (e: AiStreamEvent) => void
): Promise<ExtractedQuote> {
  const channel = new Channel<AiStreamEvent>();
  channel.onmessage = onEvent;
  return invoke("ai_extract_quote_stream", { briefText, channel });
}
```

```rust
// apps/desktop/src-tauri/src/commands/ai.rs
use tauri::ipc::Channel;

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiStreamEvent {
    Token { text: String },
    ToolCall { name: String, args: serde_json::Value },
    Done { result: ExtractedQuote },
    Error { message: String },
}

#[tauri::command]
pub async fn ai_extract_quote_stream(
    brief_text: String,
    channel: Channel<AiStreamEvent>,
) -> Result<ExtractedQuote, String> {
    let mut child = spawn_claude(&build_prompt(&brief_text)).await
        .map_err(|e| e.to_string())?;

    let mut stdout = child.stdout.take().ok_or("no stdout")?;
    let mut buf = String::new();
    let mut reader = BufReader::new(stdout);
    loop {
        let n = reader.read_line(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 { break; }
        if let Some(event) = parse_stream_line(&buf) {
            let _ = channel.send(event);
        }
        buf.clear();
    }

    // ... parse final JSON, validate, return
}
```

### 6.5 Codegen types partagés

Fichier `scripts/generate-ipc-types.ts` lit les structures Rust annotées `#[derive(Serialize, Deserialize, TS)]` (crate `ts-rs`) et émet `packages/shared/src/ipc/generated.ts`. Lancé en pre-commit hook et en CI pour éviter la dérive des types.

### 6.6 Sécurité IPC

- **Liste blanche des commands** déclarée dans `tauri.conf.json` sous `security.capabilities`.
- **CSP strict** : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://freetsa.org`.
- **Pas d'endpoint HTTP local exposé** (pas de `tauri-plugin-shell` en mode open).
- **Sanitization Rust** : chaque input reçu est validé par `serde` avec types stricts (pas de `serde_json::Value` dans les signatures command).

---

## 7. Module crypto — PAdES B-T maison

**Réponse à l'open question 1 (crate Rust PAdES) :** **DIY avec `lopdf` + `rsa` + `x509-cert` + `cms` + `sha2`**, pas de crate clé-en-main.

### 7.1 Justification du choix DIY

Les alternatives évaluées :

| Option | Pro | Contra | Verdict |
|---|---|---|---|
| `sign-pdf-rs` | API haut niveau | Maintenance incertaine (< 50 stars), pas de PAdES-B-T, pas d'audit crypto public | Rejeté |
| `openssl` wrapper | Robuste | Binding C/OpenSSL complique cross-OS (Windows MSVC), augmente taille binaire, nécessite libssl installée | Rejeté (NFR-003 installer ≤ 15 Mo) |
| **`lopdf` + `rsa` + `cms`** (retenu) | Pure Rust, audité, contrôle fin, pas de dépendance C, petit overhead taille | Plus de code à écrire pour le CMS/PKCS#7 | **Retenu** |

**Rationale complémentaire :** la signature PAdES est un actif différenciant (« sans Yousign »). En contrôler le code 100 % = flexibilité pour évoluer vers PAdES-LT en v0.2+ (archivage long terme), et crédibilité en cas d'audit communauté.

### 7.2 Architecture du module

Crate Rust `apps/desktop/src-tauri/src/crypto/` organisé en sous-modules :

```
crypto/
├── mod.rs              # Re-exports publics
├── cert.rs             # Génération X.509 auto-signé RSA 4096
├── keychain.rs         # Wrapper autour du crate `keyring`, fallback AES-256
├── pades/
│   ├── mod.rs
│   ├── pdf_prep.rs     # lopdf : prépare ByteRange placeholder
│   ├── cms_builder.rs  # Construit SignedData CMS/PKCS#7
│   ├── signature.rs    # Orchestration embed (placeholder → hash → sign → CMS → embed)
│   └── verify.rs       # (v0.2) validation d'une signature embed
├── timestamp.rs        # Client RFC 3161 FreeTSA + fallbacks
├── audit.rs            # Chaîne de hash append-only signature_events
└── error.rs
```

### 7.3 Flow signature complet

```
1. Lire PDF original depuis ~/.fakt/documents/{year}/{type}/{num}.pdf
2. Via lopdf: ajouter un champ AcroForm /Sig avec placeholder ByteRange
3. Calculer SHA-256 sur le PDF avec placeholder
4. Récupérer clé privée RSA dans keychain OS via `keyring`
5. Signer le hash SHA-256 avec RSA-PKCS1v15 + padding SHA-256
6. POST HTTP à https://freetsa.org/tsr avec le hash signature (content-type application/timestamp-query)
   → reçoit TimeStampResponse DER
   → si timeout/erreur: essayer fallbacks (DigiCert, Sectigo si configurés)
   → si tous échouent: mode PAdES-B sans timestamp (warning affiché)
7. Construire SignedData CMS/PKCS#7 incluant:
   - digest SHA-256 du PDF
   - certificat X.509 public du user
   - signature RSA
   - UnsignedAttribute signature-time-stamp-token (RFC 3161 TSR) pour PAdES-B-T
8. Encoder CMS en DER, encoder en hex
9. Injecter dans le placeholder ByteRange du PDF (lopdf)
10. Écrire PDF signé → ~/.fakt/documents/{year}/{type}/{num}.signed.pdf
11. Calculer hash_after = SHA-256 du PDF signé final
12. Insérer événement dans signature_events (avec previous_event_hash chaîné)
13. Retourner SignatureResult au frontend
```

### 7.4 Génération certificat (FR-002)

Fichier `cert.rs` :

```rust
use rsa::{RsaPrivateKey, RsaPublicKey, pkcs8::EncodePrivateKey};
use x509_cert::{builder::{Builder, CertificateBuilder, Profile}, name::Name, time::Validity};

pub fn generate_self_signed_cert(
    common_name: &str,
    email: &str,
    organization: &str,
) -> Result<(RsaPrivateKey, Vec<u8>, Vec<u8>), CryptoError> {
    let mut rng = rand::thread_rng();
    let priv_key = RsaPrivateKey::new(&mut rng, 4096)?;
    let pub_key = RsaPublicKey::from(&priv_key);

    let subject = Name::from_str(&format!(
        "CN={},emailAddress={},O={}",
        common_name, email, organization
    ))?;

    let validity = Validity::from_now(Duration::from_secs(60 * 60 * 24 * 365 * 10))?;

    let cert = CertificateBuilder::new(
        Profile::Root,
        SerialNumber::generate(),
        validity,
        subject,
        SpkiOwned::try_from(&pub_key)?,
        &priv_key,
    )?
    .build::<rsa::pkcs1v15::SigningKey<sha2::Sha256>>()?;

    let cert_der = cert.to_der()?;
    let priv_pkcs8 = priv_key.to_pkcs8_der()?.as_bytes().to_vec();

    Ok((priv_key, priv_pkcs8, cert_der))
}
```

### 7.5 Keychain OS (NFR-005)

Fichier `keychain.rs` — wrapper sur `keyring` crate :

```rust
use keyring::Entry;
const SERVICE: &str = "fakt.alphaluppi.com";

pub fn store_private_key(workspace_id: &str, pkcs8_der: &[u8]) -> Result<(), CryptoError> {
    let entry = Entry::new(SERVICE, workspace_id)?;
    let b64 = base64::encode(pkcs8_der);
    entry.set_password(&b64)?;
    Ok(())
}

pub fn load_private_key(workspace_id: &str) -> Result<Vec<u8>, CryptoError> {
    let entry = Entry::new(SERVICE, workspace_id)?;
    match entry.get_password() {
        Ok(b64) => Ok(base64::decode(&b64)?),
        Err(keyring::Error::NoEntry) => Err(CryptoError::KeyNotFound),
        Err(e) => {
            // Fallback fichier AES-256 chiffré
            load_key_from_encrypted_file(workspace_id)
        }
    }
}
```

Fallback : fichier `~/.fakt/keys/{workspace_id}.key.enc` chiffré AES-256-GCM avec une clé dérivée de la machine (`machine_uid` + constante). Avertissement affiché à l'utilisateur si ce chemin est emprunté.

### 7.6 Horodatage RFC 3161

Fichier `timestamp.rs` :

```rust
pub struct TsaClient {
    primary_url: String,       // https://freetsa.org/tsr
    fallback_urls: Vec<String>,
    timeout: Duration,         // 10s
}

impl TsaClient {
    pub async fn request_timestamp(&self, message_digest: &[u8]) -> Result<TimestampResponse, TsaError> {
        let tsq = build_tsr_request(message_digest, HashAlgo::Sha256)?;

        for url in std::iter::once(&self.primary_url).chain(self.fallback_urls.iter()) {
            match self.post_tsr(url, &tsq).await {
                Ok(r) if r.is_granted() => return Ok(r),
                _ => continue,
            }
        }
        Err(TsaError::AllProvidersFailed)
    }
}
```

### 7.7 Audit trail chaîné (FR-018)

Chaque insertion dans `signature_events` :

```rust
pub fn append_audit_event(tx: &Transaction, event: AuditEvent) -> Result<(), CryptoError> {
    // Récupère le hash du dernier event (ou None)
    let prev_hash: Option<String> = tx.query_row(
        "SELECT printf('%s|%s|%s', id, timestamp, doc_hash_after)
         FROM signature_events ORDER BY timestamp DESC LIMIT 1",
        [], |r| r.get(0)
    ).optional()?;

    let prev_hash_sha = prev_hash.as_ref().map(|s| hex::encode(sha256(s.as_bytes())));

    tx.execute(
        "INSERT INTO signature_events (id, document_type, document_id, signer_name, signer_email,
             ip_address, user_agent, timestamp, doc_hash_before, doc_hash_after,
             signature_png_base64, previous_event_hash, tsa_response, tsa_provider)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            event.id, event.document_type, event.document_id, event.signer_name,
            event.signer_email, event.ip_address, event.user_agent, event.timestamp,
            event.doc_hash_before, event.doc_hash_after, event.signature_png_base64,
            prev_hash_sha, event.tsa_response, event.tsa_provider,
        ],
    )?;
    Ok(())
}
```

Vérification d'intégrité (commande `verify_audit_chain`) : rejoue la chaîne, recalcule chaque `previous_event_hash`, retourne les inconsistances.

---

## 8. Moteur IA — subprocess Claude CLI

**Réponse à l'open question 12 :** `packages/ai` expose une interface `AiProvider` implémentée par `ClaudeCliProvider` en v0.1. En v0.2, un `ClaudeAgentSdkProvider` peut être ajouté sans toucher aux consumers.

### 8.1 Interface AiProvider

Fichier `packages/ai/src/client.ts` :

```ts
export interface AiProvider {
  isAvailable(): Promise<boolean>;
  extractQuote(brief: string): Promise<ExtractedQuote>;
  extractQuoteStream(brief: string, onEvent: (e: AiStreamEvent) => void): Promise<ExtractedQuote>;
  generateEmailReminder(invoice: InvoiceDTO): Promise<DraftEmail>;
  suggestService(description: string): Promise<ServiceSuggestion>;
}

let _provider: AiProvider | null = null;
export function getAi(): AiProvider {
  if (!_provider) _provider = new ClaudeCliProvider();
  return _provider;
}
export function setAi(provider: AiProvider): void { _provider = provider; }
```

### 8.2 Subprocess Claude CLI

Côté Rust (`src-tauri/src/ai/subprocess.rs`) :

```rust
pub async fn spawn_claude(prompt: &str) -> Result<Child, AiError> {
    let mut cmd = Command::new("claude");
    cmd.arg("-p")
       .arg(prompt)
       .arg("--output-format=stream-json")
       .stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .kill_on_drop(true);

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    cmd.spawn().map_err(AiError::from)
}
```

### 8.3 Templates de prompts

Fichier `packages/ai/src/prompts/extract-quote.ts` :

```ts
export function buildExtractQuotePrompt(brief: string, workspace: Workspace): string {
  return `
Tu es un assistant spécialisé pour ${workspace.name} (micro-entreprise française).
À partir du brief ci-dessous, extrais les informations structurées pour générer un devis.

Retourne STRICTEMENT un JSON valide au schéma suivant (pas de prose):
{
  "client": { "name": string, "email": string|null, "siret": string|null, "address": string|null },
  "title": string,
  "lines": [ { "description": string, "quantity": number, "unit": "forfait"|"jour"|"heure"|..., "unitPriceCents": integer } ],
  "conditions": string|null,
  "validityDays": integer
}

BRIEF:
${brief}
`;
}
```

Schéma JSON strict côté Rust (serde) — si la validation échoue, message d'erreur explicite au user.

### 8.4 Streaming & Channel

Le subprocess est lancé avec `--output-format=stream-json` ; chaque ligne JSON est parsée et émise dans le `Channel<AiStreamEvent>`. L'UI affiche les tokens au fil de l'eau (UX « Claude réfléchit »).

### 8.5 Graceful degradation

Si `claude --version` échoue (FR-003) : le composer IA affiche un banner brutalist orange jaune avec :
- Message « Claude CLI non détecté — création manuelle disponible »
- Bouton « Guide d'installation » ouvrant `https://docs.claude.com/en/docs/claude-code/overview`
- Bouton « Créer manuellement » ouvrant le formulaire FR-008

Toute autre feature reste fonctionnelle.

### 8.6 Préparation v0.2 (Agent SDK)

Quand l'Agent SDK Anthropic sera stable, on ajoute un second impl :

```ts
export class ClaudeAgentSdkProvider implements AiProvider { /* ... */ }
// Dans settings, toggle "Utiliser Claude CLI" vs "SDK embedded"
```

Les consumers (`apps/desktop`) appellent `getAi().extractQuote(...)` sans conscience du provider sous-jacent.

---

## 9. Rendu PDF — Typst

**Réponse à l'open question 2 :** **templates fichiers séparés** (`quote.typ`, `invoice.typ`) avec **partials dans `partials/`**.

### 9.1 Pourquoi Typst (rappel)

- Compile déterministe (même input = même output bit-à-bit, utile pour hash PDF).
- 10× plus rapide que LaTeX, 50× plus rapide que Puppeteer.
- Pure Rust (crate `typst` embeddable).
- Syntaxe moderne, facile à lire.

### 9.2 Structure des templates

```
packages/pdf/templates/
├── base.typ                    # Variables globales, fonts, colors
├── quote.typ                   # Template devis (importe partials + base)
├── invoice.typ                 # Template facture
└── partials/
    ├── header.typ              # Logo + identité émetteur + numéro
    ├── client-block.typ        # Bloc « FACTURÉ À / DEVIS POUR »
    ├── lines-table.typ         # Table lignes avec prix
    ├── totals.typ              # Totaux HT (+ TVA si applicable post-v0.1)
    ├── legal-mentions.typ      # Mentions obligatoires FR
    ├── signature-block.typ     # Zone signature (vide si non signé, image si signé)
    └── footer.typ              # IBAN + pagination
```

### 9.3 Contexte injecté

```ts
// packages/pdf/src/context-builder.ts
export function buildQuoteContext(quote: Quote, client: Client, workspace: Workspace): QuoteContext {
  return {
    workspace: { ...workspace, tvaMention: workspace.tvaMention },
    client,
    number: quote.number ?? "BROUILLON",
    title: quote.title,
    issuedAt: quote.issuedAt ? formatFrDate(quote.issuedAt) : "—",
    validityDate: quote.validityDate ? formatFrDate(quote.validityDate) : "—",
    lines: quote.items.map(lineToTypst),
    totalHt: formatFrMoney(quote.totalHtCents),
    conditions: quote.conditions,
    notes: quote.notes,
    signatureImage: quote.signatureImage ?? null,
  };
}
```

### 9.4 API de rendu

```ts
export async function renderQuote(ctx: QuoteContext): Promise<Buffer> {
  // Sérialise ctx en JSON → passe à Rust via invoke("render_quote_pdf_internal", { ctx })
  // Rust compile templates/quote.typ avec le contexte, retourne PDF bytes
  return invoke<Uint8Array>("render_quote_pdf_internal", { ctx }).then(Buffer.from);
}
```

Côté Rust, le crate `typst` est utilisé :

```rust
use typst::prelude::*;

pub fn render(template_path: &str, context: &serde_json::Value) -> Result<Vec<u8>, PdfError> {
    let world = FaktWorld::new(template_path, context)?;
    let document = typst::compile(&world)?;
    let pdf = typst_pdf::pdf(&document, &PdfOptions::default())?;
    Ok(pdf)
}
```

### 9.5 Fidélité charte legacy

Le template FAKT reprend la charte des skills `.docx` d'origine (source `.design-ref/.../uploads/*.skill`) :
- Couleur primaire : bleu `#2E5090`
- Police : Arial-like (substituée par Inter ou Noto Sans pour fidélité cross-OS en Typst)
- Layout global conservé
- Marges, taille de texte, ordres des sections respectés

**Freedom :** améliorations typographiques (hiérarchie, spacing, ligne-hauteur) tolérées tant que la charte reste reconnaissable.

### 9.6 Golden PDFs

Fichier `packages/pdf/tests/golden/` contient des PDFs de référence générés avec des contextes fixes. Le test suite compare bit-à-bit chaque nouveau rendu au golden correspondant. Toute différence force une revue manuelle + update du golden.

---

## 10. UI React — state management et conventions

**Réponse à l'open question 4 :** **TanStack Query pour l'état serveur (commands Tauri) + Zustand pour l'état UI local**.

### 10.1 Répartition des responsabilités

| Type d'état | Outil | Exemples |
|---|---|---|
| **Données persistées** (clients, devis, factures, settings) | TanStack Query v5 | `useClients()`, `useQuote(id)`, `useSettings()` |
| **UI éphémère locale** | Zustand | Composer ouvert, sidebar collapsed, modal active, wizard step |
| **Formulaires** | React Hook Form + Zod | Tous les formulaires CRUD |
| **Préférences utilisateur persistées** | Zustand + middleware Tauri Store | Langue (future), theme si ajouté post-v0.1 |

### 10.2 Hooks TanStack typés

```ts
// apps/desktop/src/hooks/quotes.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export function useQuotes(filter?: QuoteFilter) {
  return useQuery({
    queryKey: ["quotes", filter],
    queryFn: () => invoke<Quote[]>("list_quotes", { filter }),
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuoteInput) => invoke<Quote>("create_quote", { input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}
```

### 10.3 Zustand stores

```ts
// apps/desktop/src/stores/ui.ts
import { create } from "zustand";

type UiState = {
  composerOpen: boolean;
  composerContext: { docType: "quote" | "invoice"; docId: string } | null;
  sidebarCollapsed: boolean;
  toggleComposer: () => void;
  openComposerFor: (ctx: UiState["composerContext"]) => void;
};

export const useUi = create<UiState>((set) => ({
  composerOpen: false,
  composerContext: null,
  sidebarCollapsed: false,
  toggleComposer: () => set((s) => ({ composerOpen: !s.composerOpen })),
  openComposerFor: (ctx) => set({ composerOpen: true, composerContext: ctx }),
}));
```

### 10.4 Offline-first avec TanStack Query

- **Cache persist** via `@tanstack/query-sync-storage-persister` → `localStorage` (backed par webview).
- **Mutations queue** : si une mutation échoue réseau (seul cas : IA subprocess), le message d'erreur propose « Réessayer plus tard ».
- **Stale time** généreux (5 min) car la source de vérité est la DB locale ; les events Rust invalident aux moments clés.

### 10.5 Design tokens et composants

Fichier `packages/design-tokens/src/tokens.css` :

```css
:root {
  --ink: #000000;
  --paper: #F5F5F0;
  --paper-2: #EDEDE5;
  --surface: #FFFFFF;
  --accent-soft: #FFFF00;
  --success-bg: #B9F5B0;
  --danger-bg: #FF6B6B;
  --warn-bg: #FFFF00;
  --info-bg: #CCE5FF;
  --shadow-sm: 3px 3px 0 var(--ink);
  --shadow: 5px 5px 0 var(--ink);
  --shadow-lg: 8px 8px 0 var(--ink);
  --shadow-xl: 12px 12px 0 var(--ink);
  --border-card: 2.5px solid var(--ink);
  --border-btn: 2px solid var(--ink);
  --border-chip: 1.5px solid var(--ink);
  --radius: 0px;
}
```

Plugin Tailwind v4 `packages/design-tokens/src/tailwind-plugin.ts` expose ces tokens en classes utilitaires (`bg-ink`, `text-paper`, `shadow-brutal`, `border-card`).

### 10.6 Composants shadcn override

Les primitives shadcn (Button, Input, Dialog) sont forkées dans `packages/ui/src/primitives/` et adaptées aux tokens Brutal Invoice :
- `border-radius: 0`
- `box-shadow: var(--shadow-sm)` au lieu de `shadow-md`
- Hover state = inversion (`#000 ↔ #FFFF00`)
- Press state = `transform: translate(3px, 3px); box-shadow: none`

### 10.7 Routing

react-router v7 en mode « data router » :

```ts
// apps/desktop/src/router.tsx
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "quotes", children: [...] },
      { path: "invoices", children: [...] },
      { path: "clients", children: [...] },
      { path: "services", children: [...] },
      { path: "settings", element: <Settings /> },
      { path: "onboarding", element: <Onboarding /> },
    ],
  },
]);
```

Le shell inclut sidebar (320px), topbar (72px), slot principal, et composer IA overlay (420px).

---

## 11. Installation & packaging

### 11.1 Bundler Tauri

Fichier `apps/desktop/src-tauri/tauri.conf.json` (extrait) :

```json
{
  "productName": "FAKT",
  "identifier": "com.alphaluppi.fakt",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "dmg", "appimage"],
    "publisher": "AlphaLuppi",
    "category": "Business",
    "copyright": "Copyright 2026 AlphaLuppi. Licensed under BSL 1.1.",
    "macOS": {
      "minimumSystemVersion": "12.0",
      "entitlements": "entitlements.plist",
      "signingIdentity": null
    },
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "wix": { "language": "fr-FR" }
    },
    "linux": {
      "deb": { "depends": ["webkit2gtk-4.1", "libssl3"] }
    }
  },
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://freetsa.org https://plausible.alphaluppi.com"
  }
}
```

### 11.2 Installers par OS

- **Windows** : `.msi` via WiX (bundled Tauri). Signé Authenticode OV (~200 €/an). Installé dans `C:\Program Files\FAKT`.
- **macOS** : `.dmg` universel (Intel x64 + Apple Silicon via build matrix). Signé Apple Developer ID + notarizé. `~/Applications/FAKT.app`.
- **Linux** : `.AppImage` (portable, pas besoin de root). `.deb` optionnel post-v0.1 pour Ubuntu Software.

### 11.3 Auto-update (v0.2)

`tauri-plugin-updater` + flux JSON hébergé sur `https://fakt.alphaluppi.com/updates/{platform}/latest.json`. Non inclus en v0.1 (release manuelle via GitHub Releases acceptable).

### 11.4 Code-signing (processus)

| OS | Étape | Coût | Mise en œuvre |
|---|---|---|---|
| macOS | Apple Developer Program | 99 USD/an | Inscription org AlphaLuppi, création Developer ID Application + Installer |
| macOS | Notarization | 0 | `xcrun notarytool` en CI |
| Windows | OV Code Signing Cert | ~200 USD/an | Achat SSL.com ou Sectigo, stockage HSM Azure Key Vault, reference dans GitHub secret |
| Linux | — | 0 | `.AppImage` non signé (acceptable) ; GPG signature du fichier en bonus |

---

## 12. CI/CD GitHub Actions

**Réponse à l'open question 9.**

### 12.1 Workflows

Trois workflows dans `.github/workflows/` :

**`ci.yml`** — déclenché sur PR + push main
- Matrix 3 OS : `windows-latest`, `macos-14` (ARM), `ubuntu-22.04`
- Steps : install Bun + Rust → `bun install` → `turbo run typecheck` → `biome check .` → `turbo run test` → `cargo test` → upload coverage

**`e2e.yml`** — déclenché sur push main + nightly
- Matrix 3 OS
- Install Playwright + tauri-driver
- `bun run build` → `cargo build --release` → `playwright test`
- Upload artefacts captures d'écran en cas d'échec

**`release.yml`** — déclenché sur tag `v*.*.*`
- Job `build-and-sign` matrix 3 OS :
  - Setup secrets (`APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`)
  - Utilise `tauri-apps/tauri-action@v2` qui handle build + sign + notarize
- Job `release` : crée GitHub Release avec installers attachés + changelog généré

### 12.2 Exemple workflow release (extrait)

```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-14'      # ARM
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-14'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: dtolnay/rust-toolchain@stable
      - name: Install deps (linux)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libssl-dev
      - run: bun install --frozen-lockfile
      - uses: tauri-apps/tauri-action@v2
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
          WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'FAKT ${{ github.ref_name }}'
          releaseBody: 'Voir le CHANGELOG pour les détails.'
          releaseDraft: true
          args: ${{ matrix.args }}
```

### 12.3 Dev experience — orchestration Vite + Tauri

**Réponse à l'open question 7 :** **Turborepo tasks + `tauri dev`** orchestrés par un script custom `scripts/dev.sh`.

```bash
#!/usr/bin/env bash
# scripts/dev.sh
set -e

# 1. Lance Turborepo watch mode pour packages (build outputs → dist/)
turbo watch build --filter='./packages/*' &
TURBO_PID=$!

# 2. Lance Vite + Tauri dev (tauri dev attend que Vite soit ready)
cd apps/desktop && bun tauri dev

# Cleanup
kill $TURBO_PID 2>/dev/null || true
```

Alternative Windows (`scripts/dev.ps1`) fournie.

### 12.4 Linting + formatting

- **Biome 1.9+** pour TS/JSON (config `biome.json` racine).
- **rustfmt** pour Rust (config `rustfmt.toml` avec `edition = "2021"`, `max_width = 100`).
- **clippy** en mode `cargo clippy -- -D warnings` (warnings = erreurs en CI).

---

## 13. Sécurité

### 13.1 Secrets

- **Clé privée X.509** : keychain OS exclusivement (fallback AES-256-GCM si keychain indispo).
- **Token Anthropic** : jamais stocké par FAKT — l'utilisateur configure `claude` CLI lui-même via `ANTHROPIC_API_KEY` ou `claude login`.
- **Secrets GitHub Actions** : organisationnels sur AlphaLuppi, scope repo `FAKT` uniquement.

### 13.2 Validation d'entrées

- **Côté front** : React Hook Form + Zod schemas par formulaire.
- **Côté Rust** : `serde` strict (pas de `Value`), validations métier supplémentaires (SIRET Luhn, montants positifs, dates cohérentes).
- **Protection injection SQL** : queries via `rusqlite` prepared statements, pas de concat string. Drizzle côté TS idem.

### 13.3 CSP Tauri

CSP stricte configurée (`tauri.conf.json`) :
- `default-src 'self'`
- `script-src 'self'` (aucun `unsafe-eval`, aucun `unsafe-inline`)
- `style-src 'self' 'unsafe-inline'` (Tailwind inline styles tolérés)
- `connect-src 'self' https://freetsa.org https://plausible.alphaluppi.com`
- `img-src 'self' data: blob:`

### 13.4 Audit de dépendances

- `bun audit` en CI (bloquant si vuln HIGH/CRITICAL).
- `cargo audit` en CI (via `cargo-audit` action).
- `cargo deny` avec liste de crates interdits (ex: `openssl-sys` direct) et licences acceptées (MIT, Apache-2.0, BSD-3).
- Renovate Bot actif sur le repo pour PR de mises à jour.

### 13.5 Sécurité application

- **App sandboxing macOS** : entitlements minimaux (`com.apple.security.network.client` pour FreeTSA uniquement).
- **Windows ACL** : fichiers `~/.fakt/` protégés user-only.
- **SQLite WAL** : fichier DB permissions 0600 (macOS/Linux), inheritance restreinte (Windows).
- **Pas de protocole custom** : FAKT n'enregistre pas de scheme `fakt://` en v0.1 (v0.2 pour deep-links).

### 13.6 Chaîne de hash audit trail

`signature_events.previous_event_hash` = SHA-256 du triplet `id|timestamp|doc_hash_after` du précédent event. Commande CLI `fakt audit verify` (post-v0.1) rejoue la chaîne, alerte si brisée.

---

## 14. Migrations et backups

**Réponses aux open questions 6 et 10.**

### 14.1 Stratégie migrations

- **Source de vérité** : Drizzle schema TS.
- **Génération** : `bun run db:generate` crée des fichiers SQL versionnés dans `packages/db/src/migrations/NNNN_<name>.sql`.
- **Exécution côté Rust** : les fichiers SQL sont embarqués via `include_str!` dans le binaire Tauri. Au boot, Rust lit la table `__drizzle_migrations` (créée si absente), détermine les migrations à appliquer, les exécute en transaction.

### 14.2 Boot — stratégie de migration

**Réponse open question 10 :** **auto-run silencieux** pour les migrations mineures (ajout colonne, index), **prompt utilisateur** pour les migrations destructives ou longues (> 2 secondes estimées ou altérations de colonnes).

```rust
pub async fn run_migrations_at_boot(conn: &mut Connection, window: &Window) -> Result<(), DbError> {
    let pending = get_pending_migrations(conn)?;
    if pending.is_empty() { return Ok(()); }

    let has_destructive = pending.iter().any(|m| m.is_destructive());

    if has_destructive {
        window.emit("migration-prompt-required", &pending)?;
        let response = wait_for_user_confirmation(window).await?;
        if !response.confirmed { return Err(DbError::UserCancelled); }
    }

    window.emit("migration-started", pending.len())?;
    // Backup auto AVANT toute migration
    create_backup(conn)?;

    for m in pending {
        window.emit("migration-progress", json!({ "name": m.name }))?;
        conn.execute_batch(&m.sql)?;
        mark_applied(conn, &m.name)?;
    }
    window.emit("migration-completed", ())?;
    Ok(())
}
```

Un fichier de backup est créé automatiquement avant chaque migration, même silencieuse. Restauration via UI settings si besoin.

### 14.3 Backup automatique (NFR-012)

**Réponse open question 6 :** **`VACUUM INTO`** (copie déduplliquée compacte de la DB).

- Job tokio scheduled : toutes les 24h, exécute `VACUUM INTO '~/.fakt/backups/fakt-YYYYMMDD.db'`.
- Rotation : les 7 derniers backups journaliers + les 4 dimanches derniers (total ≤ 11 fichiers).
- Taille moyenne attendue : < 5 Mo par backup après 1 an d'usage normal.
- Command manuelle `trigger_backup_now()` depuis Settings.

### 14.4 Restore

UI Settings → « Restaurer depuis un backup » :
1. File dialog pour choisir un `.db` backup.
2. Confirmation modale (WARNING : écrase les données actuelles).
3. Rust : copie le fichier backup vers `fakt.db` (après avoir fermé la connexion + pris un backup du current).
4. Redémarre l'app.

### 14.5 Export ZIP complet (FR-021)

Commande `export_workspace_zip` :
1. Crée un ZIP temporaire.
2. Injecte tous les PDFs signés/originaux de `~/.fakt/documents/`.
3. Sérialise toutes les tables DB en JSON → `metadata.json`.
4. Sérialise `signature_events` en JSON → `audit_trail.json`.
5. Ajoute un `README.txt` explicatif.
6. Compresse.
7. File dialog pour choisir l'emplacement de sauvegarde.

Progress streamé via `Channel<ExportProgress>`.

---

## 15. Testing strategy

**Réponse à l'open question 8.**

### 15.1 Pyramide de tests

| Niveau | Outil | Cible | Coverage |
|---|---|---|---|
| **Unit TS** | Vitest 2.x | Logic métier `core`, `legal`, `pdf` context-builder | ≥ 70 % sur `core` + `pdf` |
| **Unit Rust** | `cargo test` | Crypto, PAdES, numérotation, migrations | ≥ 70 % sur crypto |
| **Integration** | Vitest + fixtures SQLite in-memory | DB queries, pipeline rendu Typst | Couverture des happy paths |
| **E2E** | Playwright + `tauri-driver` | Flows critiques bout-en-bout 3 OS | Flows PRD user flows 1/2/3 |
| **Visual regression** | Playwright screenshots | UI Brutal Invoice composants clés | Sans lock strict initialement |

### 15.2 Mock Claude CLI

Pour les tests E2E déterministes sans token Anthropic, un binaire stub `claude-mock` est utilisé :
- Installé au début du job CI, mis en tête du `PATH`.
- Lit un fichier `tests/fixtures/ai-responses/{test_id}.jsonl`, émet les lignes sur stdout avec un délai configurable.
- Utilisé également en dev local via `FAKT_AI_PROVIDER=mock` pour itérer sans consommer son quota.

### 15.3 Golden PDF tests

`packages/pdf/tests/render.test.ts` :
- Génère PDF pour un contexte fixture.
- Compare bit-à-bit avec `tests/fixtures/golden/{case}.pdf`.
- Échec → diff PDF affiché (via `pdftotext`) pour revue.

### 15.4 Tests PAdES

`apps/desktop/src-tauri/src/crypto/pades/tests.rs` :
- Test « round trip » : génère cert, signe PDF fixture, réouvre PDF, valide signature avec `pyHanko` (dependency dev Python dans CI).
- Test « chain audit » : simule 10 signatures, recalcule la chaîne, vérifie l'intégrité.
- Test « TSA fallback » : mock HTTP server simulant FreeTSA down → vérifie que le fallback (PAdES-B) fonctionne.

### 15.5 CI pipeline tests

```yaml
# .github/workflows/ci.yml (extrait)
jobs:
  test:
    strategy:
      matrix: { os: [ubuntu-22.04, macos-14, windows-latest] }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: dtolnay/rust-toolchain@stable
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test --coverage
      - run: cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
      - uses: codecov/codecov-action@v4
```

---

## 16. Performance budgets

| Métrique | Budget v0.1 | Mesure |
|---|---|---|
| Installer Windows `.msi` | ≤ 15 Mo (objectif 8 Mo) | CI artifact size check |
| Installer macOS `.dmg` | ≤ 15 Mo (objectif 8 Mo) | CI |
| Installer Linux `.AppImage` | ≤ 25 Mo (webview bundlé) | CI |
| Startup cold | p95 ≤ 2 s | Benchmark CI (hardware standard) |
| Startup warm | p95 ≤ 800 ms | Benchmark |
| PDF render (20 lignes) | p95 ≤ 3 s | Vitest benchmark `packages/pdf` |
| SQLite query CRUD standard | p95 ≤ 50 ms | Rust bench |
| Signature PAdES embed (hors FreeTSA) | p95 ≤ 500 ms | Rust bench |
| Signature complète avec FreeTSA | p95 ≤ 5 s (dépend réseau) | Test E2E |
| Memory at idle | ≤ 150 Mo | CI smoke test |

---

## 17. Observabilité

**Réponse à l'open question 11 : Plausible self-host hébergé sur Dokploy AlphaLuppi** (infra maison déjà utilisée pour MnM).

### 17.1 Télémétrie

- **Opt-in strict** en Settings, désactivé par défaut (NFR-006 + RGPD).
- Endpoint configuré `https://plausible.alphaluppi.com/api/event`.
- Domaine « fakt.desktop » utilisé comme identifier.
- Events trackés (si opt-in) : `app_launched`, `quote_created`, `invoice_signed`, `backup_triggered`. Pas de PII, pas de contenu, juste des counts.

### 17.2 Logs locaux

- Écrit par `tracing-subscriber` dans `~/.fakt/logs/fakt-YYYYMMDD.log`.
- Rotation journalière (via `tracing-appender`).
- Conservation 30 jours (rotation supprime au-delà).
- Niveau par défaut `INFO`, passable à `DEBUG` via env `FAKT_LOG=debug`.

### 17.3 Crash reports

Non inclus v0.1. Post-v0.1 : intégration optionnelle `sentry-rust` (self-host) toggleable dans Settings.

### 17.4 Dashboards AlphaLuppi

Plausible instance fournit un dashboard agrégé (org AlphaLuppi) sur les events FAKT. Réservé mainteneurs.

---

## 18. Roadmap post-v0.1

### 18.1 v0.2 — Self-host entreprise (~Q3 2026)

- Ajout `apps/server/` : backend Hono + PostgreSQL + auth JWT multi-user.
- `packages/db` : adapter PG activé, migrations parallèles.
- Desktop gagne un mode « connecté » : sync `apps/desktop` ↔ `apps/server` via WebSocket + conflict resolution (CRDT ou last-write-wins).
- Multi-user : rôles admin / membre, consolidation CA par membre.
- UI English (i18n déjà préparée).
- Portail client signature : route `/sign/:token` (dans `apps/server`) permettant à un client de signer un devis reçu par email.
- Swap possible vers `ClaudeAgentSdkProvider` (si Agent SDK stable).

### 18.2 v0.3 — SaaS hébergé (~Q4 2026)

- Multi-tenant strict sur `apps/server` + billing Stripe (tier 12 €/mois).
- Domaine `fakt.app` ou `app.fakt.alphaluppi.com`.
- Accès web sans installation (PWA frontend hébergée sur Vercel).
- Intégration paiement (Stripe Connect) pour suivi automatique.
- Scheduler de relances automatiques.
- Intégration comptable (export FEC, Indy, Tiime).
- Signature qualifiée eIDAS via Yousign API (option payante supplémentaire).

### 18.3 v0.4+ — Mobile (roadmap distante)

- `apps/mobile/` en Expo (iOS + Android).
- Lecture/consultation only initialement.
- Notifications push (rappels retard).

---

## 19. Trade-offs majeurs — synthèse

| Décision | Gain | Perte | Rationale |
|---|---|---|---|
| PAdES DIY (`lopdf` + `rsa` + `cms`) | Contrôle total, portabilité, petit binaire | ~2 semaines dev + audit | Différenciation produit, pas de dette tierce critique |
| TanStack Query + Zustand | Caching robuste + UI local simple | Deux libs à apprendre | Meilleur ratio qu'une seule lib universelle (React Context lourd, Redux overkill) |
| Drizzle single-schema SQLite-first | DX excellente, migrations unifiées | Traduction PG manuelle en v0.2 | SQLite est la cible v0.1, PG préparé mais non bloquant |
| Typst crate embedded | Déterminisme + rapidité | Dépendance Rust tauri-side plus lourde | Critère non-négociable (NFR-002) |
| Claude CLI subprocess | Pas de token Anthropic à gérer | Dépendance externe à installer | Respect user ownership, pas de liability |
| Signature eIDAS avancée maison (pas qualifiée) | Indépendance + gratuité | Pas d'accréditation ANSSI | v0.3+ offrira Yousign en option payante |
| Bun + Turborepo + Biome | Toolchain rapide, pattern MnM | Toolchain moins mainstream que npm/pnpm+ESLint | Aligné sur stack AlphaLuppi, DX excellente |
| Tauri vs Electron | Installer 5 Mo vs 150 Mo | Écosystème plus jeune | NFR-003 imposé |

---

## 20. FR ↔ composants (traceability)

| FR | Composants / modules | Notes |
|---|---|---|
| FR-001 Assistant | `apps/desktop/src/features/onboarding` + commands Rust `onboarding_run` | Wizard 4 étapes |
| FR-002 Cert X.509 | `crypto/cert.rs` + `crypto/keychain.rs` + `packages/crypto` | RSA 4096, 10y |
| FR-003 Claude CLI check | `src-tauri/src/ai/subprocess.rs` + `check_claude_cli` command | Timeout 5s |
| FR-004 Settings workspace | `features/settings` + `commands/settings.rs` + `packages/config` | Persistance DB |
| FR-005 CRUD clients | `features/clients` + `commands/clients.rs` + `packages/db` | Soft delete |
| FR-006 CRUD prestations | `features/services` + `commands/services.rs` | idem |
| FR-007 Recherche Cmd+K | `apps/desktop/src/features/command-palette` | `fuse.js` côté front |
| FR-008 Création devis manuel | `features/quotes/create` + `commands/quotes.rs` | Formulaire React Hook Form |
| FR-009 Création devis IA | `features/composer` + `ai_extract_quote_stream` | Channel streaming |
| FR-010 Numérotation CGI | `packages/core/numbering` + `src-tauri/src/db/numbering.rs` | Transaction IMMEDIATE |
| FR-011 Édition devis | `features/quotes/detail` + `update_quote` | Débounce 500ms |
| FR-012 Render PDF Typst | `packages/pdf` + `render_quote_pdf` command | `typst` crate |
| FR-013 Facture depuis devis | `features/invoices/from-quote` + `create_invoice_from_quote` | Acompte 30% |
| FR-014 Facture indépendante | `features/invoices/create` + `create_invoice_independent` | — |
| FR-015 Cycle vie + paiement | `commands/invoices.rs::mark_invoice_paid` + state machine `core/status` | Job overdue scheduler |
| FR-016 UI signature | `features/signature/canvas` + `features/signature/type-tab` | 2 onglets |
| FR-017 PAdES B-T | `src-tauri/src/crypto/pades/` + `sign_document` | Lopdf + CMS + FreeTSA |
| FR-018 Audit trail | `src-tauri/src/crypto/audit.rs` + triggers SQL | Chaîne SHA-256 |
| FR-019 Email .eml | `packages/email` + `prepare_email_draft` + `open_email_draft` | RFC 5322 + OS handler |
| FR-020 Templates email | `packages/email/templates` + settings | 4 templates |
| FR-021 Export ZIP | `commands/backup.rs::export_workspace_zip` | Channel progress |
| FR-022 Archivage 10y | Triggers SQL + `archived_at` + settings | Hard delete bloqué |
| FR-023 Dashboard | `apps/desktop/src/routes/dashboard.tsx` + hooks TanStack KPIs | — |
| FR-024 Listes filtrables | `packages/ui/data/DataTable` + hooks TanStack | — |
| FR-025 Vue détail + composer | `features/document-detail` + `features/composer` | Cmd+A raccourci |

---

## 21. NFR ↔ solutions architecturales

| NFR | Solution | Validation |
|---|---|---|
| NFR-001 Startup ≤ 2s | Tauri webview natif, init DB async, splash minimal | Benchmark CI |
| NFR-002 PDF ≤ 3s | `typst` crate embedded, templates optimisés | Vitest bench |
| NFR-003 Installer ≤ 15 Mo | Tauri 2, tree-shake Vite, pas d'assets lourds | CI size gate |
| NFR-004 Conformité FR | Triggers SQL, `packages/legal`, snapshot mentions | Audit manuel + tests |
| NFR-005 Keychain secrets | `keyring` crate + fallback AES-256 | Test unit crypto |
| NFR-006 Validation inputs | Zod front + serde strict Rust + Drizzle prepared | Tests |
| NFR-007 Offline-first | SQLite locale, Typst embedded, graceful AI/TSA | Test Playwright mode offline |
| NFR-008 A11y WCAG AA | Brutal Invoice contrast 21:1, focus 2px, ARIA via shadcn | axe-core CI |
| NFR-009 i18n-ready | `packages/shared/i18n/fr.ts`, `t()` hook | Scan no-hardcoded-strings |
| NFR-010 Qualité code | Biome + tsc strict + clippy + coverage gate | CI |
| NFR-011 Cross-platform | CI matrix 3 OS, tests Playwright 3 OS | CI |
| NFR-012 Fiabilité | WAL, backups quotidiens `VACUUM INTO`, autosave 5s | Test crash recovery |

---

## 22. Risques résiduels

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Écosystème Rust CMS/PAdES insuffisant | Medium | High (blocage signature) | POC semaine 1 ; fallback wrapper OpenSSL préparé mentalement |
| Fidélité charte legacy difficile en Typst | Medium | Medium | POC rendu early ; marge de liberté typo acceptée |
| Code-signing Windows OV = goulot d'achat | Medium | Medium | Démarrer achat cert dès semaine 1 (délai livraison 5-10j) |
| `keyring` crate bugs sur Linux (Secret Service) | Medium | Medium | Fallback AES-256 dès v0.1 |
| FreeTSA downtime > 24h | Low | Low | Mode PAdES-B sans timestamp documenté comme acceptable |
| Bundle binaire > 15 Mo avec crates crypto | Medium | Low | Monitoring taille, tree-shake, compile-time feature flags |
| Claude CLI breaking changes inter-versions | Low | Medium | Pin version min ≥ 2.0, feature detection |
| Drizzle single schema vs PG adapter en v0.2 | Low | Low | Refactor deferé v0.2, tests parité au moment voulu |

---

## 23. Décisions deferred (vers sprint-planning / dev)

- **Granularité des stories de EPIC-005 (Signature)** : découpage fin à faire au sprint-planning (cert gen / canvas UI / PAdES embed / timestamp / audit chain = 5 stories proposées).
- **Palette Plausible events précise** : arbitrer avec Tom au moment du dev FR-004 (opt-in).
- **Choix `typst` crate vs `typst-cli` subprocess** : POC semaine 1 pour comparer startup + déterminisme. Default = crate embedded.
- **Contenu exact des templates email (FR-020)** : à rédiger au moment du dev EPIC-006.
- **Fallback TSAs list exacte** : à configurer (DigiCert, Sectigo) au moment du dev FR-017.
- **Liste Rust crates audit trail alternatives** (si `cms` crate insuffisant) : à lock au POC semaine 1.

---

## 24. Approval & Sign-off

### Stakeholders

- **Tom Andrieu** (AlphaLuppi) — Product Owner + Tech Lead + user #1. Décideur final.
- **Claude agent (System Architect)** — auteur. Responsable synthèse et cohérence avec PRD.

### Approval Status

- [ ] Tech Lead (Tom) — à valider
- [ ] Security review (auto-review Tom) — à valider
- [ ] Design system conformité — design tokens ok par construction

---

## 25. Revision History

| Version | Date | Auteur | Changements |
|---|---|---|---|
| 1.0 | 2026-04-21 | Claude agent + Tom Andrieu | Architecture initiale — 12 open questions PRD tranchées |

---

## 26. Next Steps

### Phase 4 : Sprint Planning

Lancer `/sprint-planning` pour :
- Décomposer les 28 user stories en tâches actionnables
- Estimer en story points (Fibonacci 1/2/3/5/8/13)
- Répartir sur 3 sprints proposés :
  - **S1 Fondations** (~1 semaine) : scaffolding monorepo, `packages/db`, `packages/core`, `packages/design-tokens`, `packages/ui` primitives, EPIC-001 onboarding, EPIC-002 clients/prestations.
  - **S2 Cœur métier** (~1 semaine) : EPIC-003 devis (manual + IA + PDF), EPIC-004 factures, EPIC-008 UI (dashboard + listes).
  - **S3 Signature + Launch** (~1 semaine) : EPIC-005 PAdES, EPIC-006 email, EPIC-007 archive, CI/CD + code-signing + release.
- Identifier blocages + dépendances critiques + parallélisation possible

### Puis `/create-story` pour EPIC-001 (Onboarding)

Démarrer par l'epic fondationnel : assistant first-launch, cert X.509, check Claude CLI, settings workspace. 4 stories (US-001 à US-004).

---

## Appendix A — Glossaire technique

- **PAdES** : PDF Advanced Electronic Signatures (standard ETSI EN 319 142)
- **PAdES-B** : baseline avec signature CMS simple
- **PAdES-B-T** : baseline avec Timestamp RFC 3161
- **PAdES-LT** : Long-Term (v0.2+)
- **RFC 3161** : Internet Timestamping Protocol
- **FreeTSA** : TSA gratuite française (freetsa.org)
- **CMS** : Cryptographic Message Syntax (PKCS#7 successor)
- **DCO** : Developer Certificate of Origin
- **BSL 1.1** : Business Source License 1.1
- **CGI art. 289** : Code Général des Impôts, obligations facturation FR
- **CGI art. 293 B** : franchise de TVA micro-entreprise
- **WAL** : Write-Ahead Logging (mode SQLite crash-safe)

---

## Appendix B — Diagramme de composants (texte)

```
  User (desktop)
       │
       ▼
  +----------------------------------+
  |   FAKT App (Tauri Window)        |
  |  +----------------------------+  |
  |  |  React 19 UI (webview)     |  |
  |  |  - Shell, routes, features |  |
  |  |  - TanStack Query + Zustand|  |
  |  |  - Brutal Invoice tokens   |  |
  |  +----------------------------+  |
  |          │ invoke/events/channel |
  |          ▼                        |
  |  +----------------------------+  |
  |  |  Rust Backend (tokio)      |  |
  |  |  - commands/ handlers      |  |
  |  |  - crypto/ (PAdES, cert)   |  |
  |  |  - db/ (rusqlite)          |  |
  |  |  - ai/ (subprocess Claude) |  |
  |  |  - pdf/ (typst crate)      |  |
  |  |  - email/ (.eml builder)   |  |
  |  +----------------------------+  |
  +----------------------------------+
       │             │           │
       ▼             ▼           ▼
  SQLite DB     Keychain OS   Claude CLI (subprocess)
  (~/.fakt/)                      │
                                  ▼
                          Anthropic API (user's token)

  External (optional, network):
  - FreeTSA.org (RFC 3161 timestamp)
  - Plausible self-host (telemetry, opt-in)
  - GitHub Releases (auto-update v0.2+)
```

---

*Document généré par le workflow BMAD `/architecture` le 2026-04-21 par Claude System Architect + Tom Andrieu.*

