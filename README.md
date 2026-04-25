# FAKT

**Facturez et signez en local. Open source. Conforme législation FR.**

[![CI](https://github.com/AlphaLuppi/FAKT/actions/workflows/ci.yml/badge.svg)](https://github.com/AlphaLuppi/FAKT/actions/workflows/ci.yml)
[![License BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-yellow)](LICENSE)
[![Version](https://img.shields.io/github/v/release/AlphaLuppi/FAKT)](https://github.com/AlphaLuppi/FAKT/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/AlphaLuppi/FAKT/total)](https://github.com/AlphaLuppi/FAKT/releases)
[![DCO](https://img.shields.io/badge/DCO-required-blue)](CONTRIBUTING.md)

> **Yousign + Indy + Google Drive fusionnés en une app desktop ~100 Mo. Hors-ligne par défaut.**

---

## En une phrase

FAKT est une application desktop open-source (Windows / macOS / Linux) qui permet à un freelance ou une petite agence française de gérer son cycle complet **devis → signature électronique PAdES → facture → archive 10 ans**, sans cloud obligatoire ni abonnement.

## Quick start

```bash
# Utilisateur : télécharge l'installeur de ton OS
# https://github.com/AlphaLuppi/FAKT/releases/latest

# Développeur : 3 commandes pour run en local
git clone https://github.com/AlphaLuppi/FAKT.git
cd FAKT && bun install
bun run dev
```

---

## Trouvez ce que vous cherchez

| Vous êtes... | Allez voir... |
|---|---|
| **Freelance** qui veut installer FAKT | [`docs/readme/install.md`](docs/readme/install.md) → [`usage.md`](docs/readme/usage.md) |
| **Curieux** ou **investisseur** | [`docs/readme/about.md`](docs/readme/about.md) + [`roadmap.md`](docs/readme/roadmap.md) + [`faq.md`](docs/readme/faq.md) |
| **Dev contributeur** | [`CONTRIBUTING.md`](CONTRIBUTING.md) + [`docs/readme/architecture-overview.md`](docs/readme/architecture-overview.md) |
| **Dev intégrateur** / self-host | [`docs/readme/self-hosting.md`](docs/readme/self-hosting.md) |
| **Auditeur** / **juriste** / **DPO** | [`docs/readme/security-compliance.md`](docs/readme/security-compliance.md) + [`SECURITY.md`](SECURITY.md) |
| **Designer** / UX | [`docs/readme/design-system.md`](docs/readme/design-system.md) |
| **Product Manager** | [`docs/readme/roadmap.md`](docs/readme/roadmap.md) + [`docs/prd.md`](docs/prd.md) + [`docs/product-brief.md`](docs/product-brief.md) |
| **Agent IA** (Claude, Cursor, Codex) | [`CLAUDE.md`](CLAUDE.md) + [`AGENTS.md`](AGENTS.md) |
| **Problème** ou **bug** ? | [`docs/readme/troubleshooting.md`](docs/readme/troubleshooting.md) puis [Issues](https://github.com/AlphaLuppi/FAKT/issues) |
| **Index complet** | [`docs/readme/_INDEX.md`](docs/readme/_INDEX.md) |

---

## Stack technique

Tauri 2 · Bun · Hono · React 19 · Vite · Tailwind v4 · Drizzle ORM · SQLite/Postgres · Typst · Rust · PAdES B-T · Claude Code CLI

## Statut & roadmap

- **v0.1** ✅ Solo desktop (MVP livré 2026-04-21, Windows/macOS/Linux)
- **v0.2** 🚧 Self-host entreprise (Docker + Postgres + JWT, en cours)
- **v0.3** 📅 SaaS hébergé multi-tenant

Détails et milestones : [`docs/readme/roadmap.md`](docs/readme/roadmap.md).

## License

[Business Source License 1.1](LICENSE) · Change Date **2030-04-21** → Apache License 2.0.

> **TL;DR :** usage personnel, fork, contribution, self-host pour ton organisation : OK. Revente en SaaS concurrent payant basé sur FAKT pendant 4 ans : interdit. Licence commerciale anticipée : `contact@alphaluppi.com`.

## Contribuer

DCO obligatoire (`git commit -s`). Voir [`CONTRIBUTING.md`](CONTRIBUTING.md) et [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## Support & contact

- **Issues** : [github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues)
- **Discussions** : [github.com/AlphaLuppi/FAKT/discussions](https://github.com/AlphaLuppi/FAKT/discussions)
- **Sécurité (vuln)** : [`SECURITY.md`](SECURITY.md) — `contact@alphaluppi.com` avec `[SECURITY] FAKT` en objet
- **Email** : `contact@alphaluppi.com`

---

FAKT est un outil interne open-sourcé par [AlphaLuppi](https://alphaluppi.com), agence tech à Avignon.
Pattern triple déploiement comme [MnM](https://github.com/AlphaLuppi/mnm).
