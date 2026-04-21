# FAKT

> Devis, factures, signés.

**FAKT** est une application desktop open-source, hors-ligne par défaut, qui remplace Yousign + Indy + Google Drive en un binaire de ~5 Mo. De ton brief client à un PDF signé, en 3 minutes au lieu de 30.

Fait pour les freelances et petites agences francophones qui facturent en micro-entreprise et utilisent déjà Claude Code CLI comme outil quotidien.

## État du projet

En construction. Release v0.1.0 publique prévue 2026-05-12.

Ce repo est public mais le code commence à peine. Consulte `docs/product-brief.md` pour la vision complète et suis les issues pour l'avancement.

## Features v0.1.0

- Création de devis (D2026-XXX) et factures (F2026-XXX) avec numérotation séquentielle FR automatique.
- Génération IA du contenu depuis un brief client collé, uploadé ou dicté (subprocess Claude Code CLI).
- Édition manuelle complète après génération (clients, prestations, lignes, conditions).
- Rendu PDF déterministe via Typst, fidèle aux templates originaux des skills `/devis-freelance` et `/facture-freelance`.
- Signature électronique avancée PAdES B-T maison (cert X.509 auto-généré + horodatage RFC 3161 FreeTSA + audit trail append-only). Qualité équivalente à Yousign Basic, vérifiable dans Adobe Reader, 100% hors-ligne.
- Brouillon email `.eml` avec PDF en pièce jointe, ouvert via le client mail par défaut de l'OS.
- Stockage SQLite local, sauvegarde ZIP export, zéro cloud obligatoire.
- Installers signés Windows (.msi), macOS (.dmg), Linux (.AppImage).

## Trois modes de déploiement

FAKT suit le pattern "outil interne AlphaLuppi" établi par [MnM](https://github.com/AlphaLuppi/mnm) :

1. **Solo local (v0.1+)** — installe le binaire, tout reste sur ton PC (SQLite).
2. **Self-host entreprise (v0.2)** — Docker Compose + backend partagé pour ton équipe.
3. **SaaS hébergé (v0.3+)** — on te gère tout, ~12 €/user/mois.

## Stack

- Desktop : Tauri 2 (Rust + React webview)
- Monorepo : Bun workspaces
- Rendu docs : Typst
- DB locale : SQLite + Drizzle ORM
- DB entreprise : PostgreSQL + Drizzle (même schema via adapters)
- IA : Claude Code CLI en subprocess (token utilisateur)
- UI : React 19 + Vite + Tailwind v4 + design system Brutal Invoice

## Design system : Brutal Invoice

Identité visuelle non-négociable : noir encre, papier off-white, jaune vif, Space Grotesk UPPERCASE, ombres plates, zéro border-radius. Tokens et règles dans `packages/design-tokens/` (à venir).

## Démarrer en local (quand le code arrivera)

Prérequis : Bun >= 1.3, Rust >= 1.75 (pour Tauri), Claude Code CLI installé et configuré.

```bash
git clone https://github.com/AlphaLuppi/FAKT.git
cd FAKT
bun install
bun run dev
```

## Licence

[Business Source License 1.1](LICENSE). Change Date 2030-04-21, bascule automatique en Apache License 2.0.

La BSL autorise : usage personnel ou dans ton organisation, self-host, fork, contribution, lecture du code.
La BSL interdit pendant 4 ans : revente en SaaS concurrent payant basé sur FAKT.

Pour une licence commerciale : contact@alphaluppi.com.

## Contribuer

On accepte les PR. Format DCO (Developer Certificate of Origin). Chaque commit doit contenir `Signed-off-by: Ton Nom <ton@email.com>`. Voir `CONTRIBUTING.md`.

## Projet AlphaLuppi

FAKT est fait par AlphaLuppi, petite agence freelance tech à Avignon. Même pattern que MnM : triple déploiement, open-source, francophone.
