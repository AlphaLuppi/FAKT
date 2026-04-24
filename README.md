# FAKT

**Facturez et signez en local. Open source.**

[![CI](https://github.com/AlphaLuppi/FAKT/actions/workflows/ci.yml/badge.svg)](https://github.com/AlphaLuppi/FAKT/actions/workflows/ci.yml)
[![License BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-yellow)](LICENSE)
[![Version](https://img.shields.io/github/v/release/AlphaLuppi/FAKT)](https://github.com/AlphaLuppi/FAKT/releases/latest)

FAKT est une application desktop (Windows, macOS, Linux) open-source pour freelances et
petites agences francophones. De ton brief client à un PDF signé, en 3 minutes au lieu de 30.

**Yousign + Indy + Google Drive fusionnés en une app desktop de ~100 Mo. Hors-ligne par défaut.**

---

## Qu'est-ce que FAKT ?

Les freelances français qui facturent sérieusement jonglent entre 4 à 7 outils distincts pour
un cycle simple : un éditeur pour le devis, un service de signature (Yousign, Docusign),
un tableur pour le suivi, un logiciel de compta pour la numérotation légale et l'archivage.

FAKT réunit tout ça dans un seul outil desktop :

- **Génération de devis et factures** conformes à la législation française (CGI art. 289, TVA
  micro-entreprise, mentions obligatoires, archivage 10 ans).
- **Signature PAdES avancée** maison en Rust (niveau eIDAS AdES-B-T) — pas de dépendance Yousign
  ni Docusign. Horodatage RFC 3161. Vérifiable dans Adobe Reader.
- **IA via Claude Code CLI** : extraction de devis depuis un brief texte, rédaction de relances.
  Votre propre token Anthropic. Vos données ne quittent jamais votre machine.
- **SQLite local** dans `~/.fakt/` — zéro cloud obligatoire, zéro abonnement.

---

## Fonctionnalités v0.1.0

- Création de devis (D2026-XXX) avec numérotation séquentielle automatique
- Génération IA du contenu depuis un brief client (subprocess Claude Code CLI)
- Édition manuelle complète (clients, prestations, lignes, conditions)
- Rendu PDF déterministe via Typst — fidèle aux templates des skills `/devis-freelance` et `/facture-freelance`
- Conversion devis signé → facture en un clic
- Suivi cycle factures : émise → envoyée → payée / en retard
- Signature électronique avancée PAdES B-T (RSA 4096 + TSA RFC 3161 + audit trail SHA-256)
- Brouillon email `.eml` avec PDF en pièce jointe, ouvert via le client mail de l'OS
- Archive et compliance : export ZIP workspace (clients.csv + prestations.csv + PDFs)
- Dashboard KPIs + activity feed
- Bibliothèque de prestations réutilisables
- Gestion clients (SIRET, forme sociale, adresse)
- Design system Brutal Invoice : mémorable et unique

---

## Installation

**Taille installer :** ~100 Mo (sidecar Bun bundlé, cohérent avec les apps desktop modernes
type Slack, Discord, Obsidian qui pèsent 100-200 Mo). Un port Rust du sidecar est envisagé
en v0.2 pour réduire la taille à ~20 Mo.

### Télécharger depuis GitHub Releases

Rendez-vous sur la page [Releases](https://github.com/AlphaLuppi/FAKT/releases/latest) et
téléchargez l'installeur correspondant à votre OS.

**Windows** — fichier `.msi`

> **Note v0.1.0 :** l'installeur Windows n'est pas signé (signature Authenticode en v0.1.1).
> Windows SmartScreen affichera « Unknown Publisher ». Clic droit → Exécuter quand même.

**macOS** — fichier `.dmg` (Universal : Intel + Apple Silicon)

> Si Gatekeeper bloque : clic droit sur l'app → Ouvrir.

**Linux** — fichier `.AppImage` ou `.deb`

```bash
# AppImage
chmod +x FAKT_0.1.0_amd64.AppImage
./FAKT_0.1.0_amd64.AppImage

# .deb (Debian/Ubuntu)
sudo dpkg -i FAKT_0.1.0_amd64.deb
```

### Premier lancement

Au premier lancement, FAKT affiche un wizard d'onboarding (~2 minutes) pour configurer
votre workspace : nom légal, SIRET, adresse, régime fiscal. Un certificat X.509 de signature
est généré automatiquement et stocké dans le keychain de l'OS.

---

## Usage

1. **Créer un client** — menu Clients → Nouveau client.
2. **Créer un devis** — menu Devis → Nouveau devis. Sélectionner un client, ajouter des lignes
   de prestations depuis la bibliothèque ou manuellement.
3. **Générer avec IA** — ouvrir le Composer IA (sidebar droite), coller un brief, cliquer Extraire.
4. **Signer** — menu Actions → Signer le document. Signature PAdES générée localement.
5. **Préparer l'email** — menu Actions → Préparer email. Brouillon `.eml` ouvert dans votre client mail.
6. **Créer la facture** — depuis un devis signé, un clic génère la facture liée.
7. **Archiver** — menu Archive → Exporter workspace (ZIP) pour la compliance 10 ans.

---

## Troubleshooting

**L'app ne démarre pas / crash silencieux (Windows)**
Depuis v0.1.3, l'app écrit un log d'exécution persistant qui permet de
diagnostiquer les crashes au boot même quand stderr est avalé par le mode
`windows_subsystem = "windows"`. Chemins :
- Windows : `%APPDATA%\com.alphaluppi.fakt\logs\fakt-trace.log`
- macOS : `~/Library/Application Support/com.alphaluppi.fakt/logs/fakt-trace.log`
- Linux : `~/.local/share/com.alphaluppi.fakt/logs/fakt-trace.log`

Pour les crashes TRÈS précoces (avant que Tauri n'ait résolu `app_data_dir`),
fallback dans `%TEMP%/fakt-trace.log` (Windows) ou `/tmp/fakt-trace.log` (Unix).

**Sidecar ne répond pas**
Logs sidecar Bun :
- Windows : `%APPDATA%\fakt\logs\sidecar.log`
- macOS : `~/Library/Application Support/fakt/logs/sidecar.log`
- Linux : `~/.local/share/fakt/logs/sidecar.log`

**Port 3117 déjà occupé**
Une instance précédente est peut-être encore en arrière-plan. Sur Windows : `netstat -ano | findstr :3117` puis `taskkill /PID <pid>`. Sur macOS/Linux : `lsof -ti:3117 | xargs kill`.

**Erreur 401 UNAUTHORIZED en dev**
Le token `window.__FAKT_API_TOKEN__` n'a pas été injecté. Relancer via `bun run dev` (qui injecte) au lieu de `bun --cwd apps/desktop run dev` (Vite standalone sans token).

**Sidecar crash-loop (l'app se ferme 3× de suite en <60s)**
Vérifier les logs sidecar ci-dessus. Causes courantes : DB corrompue (supprimer `~/.fakt/db.sqlite` et relancer pour regénérer), migration cassée, port 3117 pris.

**Erreur "Network error: Failed to fetch" à l'onboarding**
Bug fixé en v0.1.1 (CORS sidecar manquant). Installer ≥ v0.1.1.

**Erreur "SIRET INVALIDE" alors que le SIRET est correct**
Bug fixé en v0.1.2 (normalize espaces/tirets). Installer ≥ v0.1.2.

**Écran Identity settings vide / Enregistrer ne fait rien**
Bug fixé en v0.1.4 (Tauri commands fantômes remplacées par API sidecar).
Installer ≥ v0.1.4.

---

## Développement local

**Prérequis :**
- [Bun](https://bun.sh) >= 1.3
- [Rust](https://rustup.rs) >= 1.75 (stable)
- [Tauri CLI v2](https://tauri.app)
- [Claude Code CLI](https://claude.ai/code) (optionnel, pour les features IA)

```bash
git clone https://github.com/AlphaLuppi/FAKT.git
cd FAKT
bun install
bun run dev
```

**Commandes utiles :**

```bash
bun run typecheck   # Vérification TypeScript strict
bun run lint        # Biome (zéro warning)
bun run test        # Vitest (tous les packages)
bun run build       # Build production Vite
bun run release     # Build Tauri complet (installers)
```

---

## Contribution

FAKT est open-source et les contributions sont bienvenues.

Format obligatoire : DCO (Developer Certificate of Origin).
Chaque commit doit inclure `Signed-off-by: Nom <email>` — ajouté automatiquement via `git commit -s`.

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le workflow complet, les standards de code
et le texte complet du DCO.

---

## Architecture

FAKT est pensé pour **trois modes de déploiement** qui partagent le même code serveur
(`packages/api-server/` — Bun + Hono + Drizzle) et les mêmes queries DB. Seuls l'adapter
DB et la couche auth changent entre modes.

### Mode 1 — Solo desktop (v0.1, MVP)

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

### Mode 2 — Self-host entreprise (v0.2+)

```
┌─────────────────────┐              ┌──────────────────────────┐
│ Desktop Tauri       │    HTTPS     │ VPS Docker               │
│ (utilisateur équipe)│ ───────────▶ │ api-server (Bun)         │
│ FAKT_API_URL=https  │  JWT header  │ Drizzle Postgres 16      │
│ ://fakt.agence.com  │              │ Reverse proxy : Caddy    │
└─────────────────────┘              └──────────────────────────┘
```

Même binaire api-server (bundle Bun compile standalone).
Différence : `DATABASE_URL=postgres://...`, `AUTH_MODE=jwt`, `BIND=0.0.0.0:3000`.
Le Rust core reste en desktop (signature et email OS locaux).

### Mode 3 — SaaS hébergé (v0.3+)

```
┌──────────────────┐          ┌────────────────────────────────┐
│ Desktop Tauri    │          │ fakt.com (Cloud Run / Fly.io)  │
│ ou navigateur    │ ──HTTPS─▶│ api-server scalable            │
│ multi-tenant     │  OAuth   │ Drizzle Postgres + RLS         │
└──────────────────┘          │ Stripe · Clerk · Sentry        │
                              └────────────────────────────────┘
```

Mêmes endpoints REST, auth = OAuth / session cookie,
`workspace_id` résolu server-side (RLS policies par workspace).

### Structure monorepo

```
fakt/
├── apps/desktop/          # Application Tauri 2 (React 19 + Rust)
├── packages/
│   ├── api-server/        # Sidecar Bun + Hono (55 endpoints REST)
│   ├── ui/                # Design system Brutal Invoice (primitives React)
│   ├── db/                # Schéma Drizzle + migrations (SQLite / Postgres)
│   ├── core/              # Modèles métier TS (Quote, Invoice, Client)
│   ├── pdf/               # Wrapper Typst → PDF
│   ├── crypto/            # Interfaces signature PAdES
│   ├── ai/                # Subprocess Claude CLI
│   ├── email/             # Générateur .eml RFC 5322 + 4 templates FR
│   ├── legal/             # Validateurs mentions légales FR
│   ├── design-tokens/     # Tokens Brutal Invoice (Tailwind plugin)
│   └── shared/            # Types partagés + i18n FR
├── landing/               # Landing page Astro (fakt.alphaluppi.com)
└── docs-site/             # Documentation Mintlify
```

Stack : Tauri 2 · Bun · Hono · React 19 · Vite · Tailwind v4 · Drizzle ORM · SQLite · Typst · Rust

Détails architecturaux : [`docs/architecture.md`](docs/architecture.md) ·
Spec refacto sidecar : [`docs/refacto-spec/architecture.md`](docs/refacto-spec/architecture.md) ·
Catalogue REST : [`docs/refacto-spec/api-endpoints.md`](docs/refacto-spec/api-endpoints.md)

CI : GitHub Actions matrix 3 OS · tauri-apps/tauri-action@v2

---

## Licence

[Business Source License 1.1](LICENSE) · Change Date **2030-04-21** → Apache License 2.0

La BSL autorise : usage personnel, self-host dans votre organisation, fork, contribution, lecture du code.
La BSL interdit pendant 4 ans : revente en SaaS concurrent payant basé sur FAKT.

Pour une licence commerciale : contact@alphaluppi.com

---

## Support

- **Issues** : [github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues)
- **Discussions** : [github.com/AlphaLuppi/FAKT/discussions](https://github.com/AlphaLuppi/FAKT/discussions)
- **Email** : contact@alphaluppi.com

---

## Reconnaissance

Merci aux équipes dont les projets rendent FAKT possible :
- [Tauri](https://tauri.app) — framework desktop Rust + webview
- [Typst](https://typst.app) — rendu PDF déterministe sans headless Chrome
- [Anthropic](https://anthropic.com) — Claude Code CLI pour la génération IA
- [FreeTSA](https://freetsa.org) — horodatage RFC 3161 gratuit
- [Biome](https://biomejs.dev) — lint et format ultra-rapide

---

FAKT est fait par [AlphaLuppi](https://alphaluppi.com), petite agence tech à Avignon.
Même pattern que [MnM](https://github.com/AlphaLuppi/mnm) : triple déploiement, open-source, francophone.
