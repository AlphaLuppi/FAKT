# Architecture FAKT — Vue d'ensemble

**Audience :** Dev contributeur · Dev intégrateur
**Résumé :** Résumé technique de FAKT. Pour les détails, voir [docs/architecture.md](../architecture.md).
**Dernière mise à jour :** 2026-04-25

---

## Triple déploiement (north star)

FAKT est conçu pour **trois modes de déploiement** qui partagent le même code serveur (`packages/api-server/`) et les mêmes queries Drizzle. Seuls **l'adapter DB**, **la couche auth** et **le bind** changent entre modes.

### Mode 1 — Solo desktop (v0.1, MVP livré)

```
┌──────────────────────────────────────────────────────────────┐
│  Desktop Tauri (installer .msi / .dmg / .AppImage, ~100 Mo)  │
│                                                              │
│  ┌───────────────┐   HTTP localhost   ┌──────────────────┐   │
│  │ React webview│ ─────────────────▶ │ Bun api-server   │   │
│  │ (Vite build) │  fetch + X-FAKT-   │ Hono REST        │   │
│  │              │    Token header    │ Drizzle SQLite   │   │
│  └───────────────┘ ◀───────────────── └──────────────────┘   │
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

### Mode 2 — Self-host entreprise (v0.2, en cours)

```
┌─────────────────────┐              ┌──────────────────────────┐
│ Desktop Tauri       │    HTTPS     │ VPS Docker (Dokploy)     │
│ (utilisateur équipe)│ ───────────▶ │ api-server (Bun)         │
│ FAKT_API_URL=https  │  JWT cookie  │ Drizzle Postgres 16      │
│ ://fakt.agence.com  │              │ Reverse proxy : Caddy    │
└─────────────────────┘              │ Web frontend (static)    │
                                     └──────────────────────────┘
```

Même code `api-server`. Différence : `DATABASE_URL=postgres://...`, `AUTH_MODE=jwt`, `BIND=0.0.0.0`. Le Rust core reste sur le poste desktop (signature et email OS locaux). Détails : [self-hosting.md](self-hosting.md).

### Mode 3 — SaaS hébergé (v0.3+, planifié)

```
┌──────────────────┐          ┌────────────────────────────────┐
│ Desktop Tauri    │          │ fakt.alphaluppi.fr (managed)   │
│ ou navigateur    │ ──HTTPS─▶│ api-server scalable            │
│ multi-tenant     │  OAuth   │ Drizzle Postgres + RLS         │
└──────────────────┘          │ Stripe · OAuth · Sentry        │
                              └────────────────────────────────┘
```

Mêmes endpoints REST. Auth = OAuth + session. `workspace_id` résolu serveur-side via RLS Postgres.

## Structure monorepo

```
fakt/
├── apps/desktop/          # Application Tauri 2 (React 19 + Rust)
├── packages/
│   ├── api-server/        # Sidecar Bun + Hono (~55 endpoints REST)
│   ├── ui/                # Design system Brutal Invoice (primitives React)
│   ├── db/                # Schéma Drizzle + migrations (SQLite + Postgres)
│   ├── core/              # Modèles métier TS (Quote, Invoice, Client)
│   ├── pdf/               # Wrapper Typst → PDF
│   ├── crypto/            # Interfaces signature PAdES (Rust en apps/desktop/src-tauri)
│   ├── ai/                # Subprocess Claude CLI
│   ├── email/             # Générateur .eml RFC 5322 + 4 templates FR
│   ├── legal/             # Validateurs mentions légales FR (CGI, TVA)
│   ├── design-tokens/     # Tokens Brutal Invoice (Tailwind plugin)
│   └── shared/            # Types partagés + i18n FR
├── landing/               # Landing page Astro (fakt.alphaluppi.com)
└── docs-site/             # Documentation Mintlify
```

## Stack technique (en 1 ligne)

**Tauri 2 · Bun · Hono · React 19 · Vite 6 · Tailwind v4 · Drizzle ORM · SQLite/Postgres · Typst · Rust · PAdES B-T · Claude Code CLI**

## Flux principal des données (mode 1)

1. **React** appelle l'API HTTP locale (sidecar Bun) via `apps/desktop/src/api/`.
2. **Hono** (sidecar) reçoit, vérifie le token shared `X-FAKT-Token`, route vers les handlers.
3. **Drizzle ORM** exécute les queries SQLite contre `~/.fakt/db.sqlite`.
4. Pour les opérations OS-spécifiques (signature, keychain, email, PDF), React invoke Rust via `@tauri-apps/api/core` :
   - `render_pdf(docType, dataJson)` — shell out vers `typst compile`
   - `sign_document(docBytes, certPem)` — RSA + CMS + lopdf, clé privée du keychain
   - `open_email_draft(emlPath)` — ouvre `.eml` dans le client mail OS
   - `build_workspace_zip(payload)` — assemble ZIP archive 10 ans
   - `generate_cert / get_cert_info / rotate_cert` — gestion keychain X.509

## Numérotation atomique (CGI art. 289)

Les numéros `D2026-XXX` (devis) et `F2026-XXX` (factures) sont **séquentiels sans trous**, exigence légale française.

Implémentation :
- Mode 1 (SQLite) : `BEGIN IMMEDIATE` transaction sur table `numbering_state` avec contrainte `UNIQUE(workspace_id, year, type)`.
- Mode 2 (Postgres) : `pg_advisory_xact_lock` au début de la transaction.

Le `last_sequence` est incrémenté atomiquement, le numéro retourné, la transaction commit.

## Signature PAdES B-T

Implémentée en Rust dans `apps/desktop/src-tauri/src/crypto/` :

- **Key generation** : RSA 4096 + cert X.509 self-signed
- **Storage** : keychain OS (Windows Credential Manager / macOS Keychain / Linux Secret Service)
- **Signing flow** :
  1. Parse PDF via `lopdf`
  2. Insert AcroForm `/Sig` field + widget annotation
  3. Compute SHA-256 sur byte ranges
  4. RSA-PKCS#1v1.5 sign avec clé du keychain
  5. Encapsule en CMS SignedData (DER)
  6. Patch PDF final avec `/ByteRange` et `/Contents`
- **Niveau** : PAdES B-T avec horodatage RFC 3161 via FreeTSA (fallback B sans timestamp si réseau KO)
- **Audit** : chaîne SHA-256 (`previous_event_hash`) en table `signature_events`

## Performance NFRs

- **Sign** : < 500 ms en release sur PDF < 1 MB
- **Render PDF** : < 800 ms (Typst CLI)
- **API roundtrip local** : < 50 ms (sidecar 127.0.0.1)
- **Cold start app** : < 3s (Tauri)

## CI / CD

- **GitHub Actions** matrix 3 OS (Windows / macOS / Ubuntu)
- **tauri-apps/tauri-action@v2** pour les builds release
- **Updater Ed25519** signed (auto-update Tauri)
- Lint Biome + tests Vitest + tests Playwright E2E

## Pour aller plus loin

- [docs/architecture.md](../architecture.md) — **architecture détaillée** (~2000 lignes)
- [docs/refacto-spec/architecture.md](../refacto-spec/architecture.md) — spec refacto sidecar
- [docs/refacto-spec/api-endpoints.md](../refacto-spec/api-endpoints.md) — catalogue REST
- [self-hosting.md](self-hosting.md) — déploiement mode 2
- [security-compliance.md](security-compliance.md) — RGPD, eIDAS, CGI
- [design-system.md](design-system.md) — Brutal Invoice
- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) — workflow contributeur
