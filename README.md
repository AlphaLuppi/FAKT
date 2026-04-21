# FAKT

**Facturez et signez en local. Open source.**

[![CI](https://github.com/AlphaLuppi/FAKT/actions/workflows/ci.yml/badge.svg)](https://github.com/AlphaLuppi/FAKT/actions/workflows/ci.yml)
[![License BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-yellow)](LICENSE)
[![Version](https://img.shields.io/github/v/release/AlphaLuppi/FAKT)](https://github.com/AlphaLuppi/FAKT/releases/latest)

FAKT est une application desktop (Windows, macOS, Linux) open-source pour freelances et
petites agences francophones. De ton brief client à un PDF signé, en 3 minutes au lieu de 30.

**Yousign + Indy + Google Drive fusionnés en un binaire de ~8 Mo. Hors-ligne par défaut.**

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

```
fakt/
├── apps/desktop/          # Application Tauri 2 (React 19 + Rust)
├── packages/
│   ├── ui/                # Design system Brutal Invoice (primitives React)
│   ├── db/                # Schéma Drizzle + migrations SQLite
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

Stack : Tauri 2 · Bun · React 19 · Vite · Tailwind v4 · Drizzle ORM · SQLite · Typst · Rust

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
- [Tauri](https://tauri.app) — le framework desktop qui tient en ~8 Mo
- [Typst](https://typst.app) — rendu PDF déterministe sans headless Chrome
- [Anthropic](https://anthropic.com) — Claude Code CLI pour la génération IA
- [FreeTSA](https://freetsa.org) — horodatage RFC 3161 gratuit
- [Biome](https://biomejs.dev) — lint et format ultra-rapide

---

FAKT est fait par [AlphaLuppi](https://alphaluppi.com), petite agence tech à Avignon.
Même pattern que [MnM](https://github.com/AlphaLuppi/mnm) : triple déploiement, open-source, francophone.
