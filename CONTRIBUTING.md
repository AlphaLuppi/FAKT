# Contribuer à FAKT

Merci de ton intérêt pour FAKT. Ce document explique comment participer
au projet de manière efficace et alignée avec les conventions du repo.

## DCO — Developer Certificate of Origin (obligatoire)

On utilise le **DCO (Developer Certificate of Origin)**, pas un CLA.
Chaque commit doit inclure la ligne de certification suivante en pied de message :

```
Signed-off-by: Prénom Nom <ton@email.com>
```

La commande `git commit -s` l'ajoute automatiquement.

En ajoutant cette ligne, tu certifies que :

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including
    all personal information I submit with it, including my
    sign-off) is maintained indefinitely and may be redistributed
    consistent with this project or the open source license(s)
    involved.
```

Sans cette ligne, le commit ne sera pas accepté dans `main`.

## Mise en place dev local

Prérequis :
- [Bun](https://bun.sh) >= 1.3
- [Rust](https://rustup.rs) >= 1.75 stable
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/) v2
- [Claude Code CLI](https://claude.ai/code) installé et configuré avec ton token Anthropic

```bash
# 1. Fork + clone
git clone https://github.com/TON_USERNAME/FAKT.git
cd FAKT

# 2. Installer les dépendances
bun install

# 3. Lancer en mode développement
bun run dev
```

## Format des commits (Conventional Commits)

```
feat(scope): description courte (max 72 chars)

Corps optionnel expliquant le "pourquoi" pas le "quoi".
Peut s'étendre sur plusieurs lignes.

Signed-off-by: Prénom Nom <email@example.com>
```

Types autorisés :
- `feat` — nouvelle fonctionnalité
- `fix` — correction de bug
- `refactor` — refactoring sans nouveau comportement
- `test` — ajout ou modification de tests
- `docs` — documentation uniquement
- `chore` — maintenance, CI, dépendances

Scopes courants : `core`, `pdf`, `crypto`, `ai`, `email`, `db`, `ui`, `design-tokens`, `desktop`, `ci`, `landing`, `docs`.

## Workflow de contribution

1. Fork le repo sur GitHub.
2. Crée une branche descriptive :
   - `feat/nom-de-la-feature`
   - `fix/description-du-bug`
   - `refactor/module-scope`
   - `docs/section-concernee`
3. Développe en suivant les conventions (TypeScript strict, design system Brutal Invoice, i18n FR).
4. Écris les tests **avant ou avec** le code (TDD). Coverage cible : **≥ 70 %** sur `packages/core` et `packages/pdf`.
5. Lance la suite complète avant de pousser :
   ```bash
   bun run typecheck
   bun run lint
   bun run test
   ```
6. Ouvre une Pull Request vers `main` avec :
   - Titre au format `feat(scope): description`
   - Body expliquant le problème résolu et l'approche choisie
   - Checklist tests + lint + typecheck
7. Attends au moins **1 approbation** d'un mainteneur avant merge.

## Standards de code

- **TypeScript strict** — `any` est interdit, utiliser `unknown` + type guards.
- **Format automatique** — Biome. Lance `bun run format` avant de committer.
- **Lint zéro warning** — `bun run lint` doit passer sans avertissement. C'est bloquant en CI.
- **Pas de commentaires évidents** — un commentaire décrit une contrainte cachée, pas une paraphrase du code.
- **Aucune string hardcodée en anglais** dans l'UI — toutes les clés passent par `packages/shared/i18n/fr.ts`.
- **Design system Brutal Invoice non-négociable** — noir #000 / papier #F5F5F0 / jaune #FFFF00, bordures 2.5px, ombres plates, zéro radius. Tout changement visuel doit être discuté en issue d'abord.

## Tests

- **Vitest** pour les tests unitaires et d'intégration TS.
- **Playwright** pour les tests E2E.
- **Cargo test** pour les composants Rust (crypto, PDF, Tauri commands).
- Coverage minimum : 70 % sur `packages/core` et `packages/pdf` (bloquant CI).
- Tests obligatoires sur tout nouveau code — une PR sans tests sera renvoyée.

## Issues

Avant d'ouvrir une issue, recherche si elle existe déjà. Sinon :

- **Bug** : reproduire en 3 lignes, OS + version FAKT + version Claude CLI, logs pertinents.
- **Feature** : décris le problème utilisateur, pas la solution technique. On discute l'approche en commentaires.
- **Question** : préfère les [Discussions GitHub](https://github.com/AlphaLuppi/FAKT/discussions).

## Périmètre des contributions

Bienvenues sans discussion préalable :
- Corrections de bugs.
- Amélioration de la documentation.
- Nouvelles traductions (FR est la base, ajoute ta langue).
- Templates régionaux (Belgique, Suisse, Québec — mentions légales locales).
- Plugins export (FEC, EBP, Sage, Ciel).

Discuter en issue d'abord :
- Changements d'architecture.
- Nouvelles features majeures (scope MVP peut changer).
- Ajout de dépendances significatives.
- Changements de design system.

Probablement pas acceptées sans justification légale solide :
- Changements qui cassent la conformité française micro-entreprise (CGI, URSSAF).
- Ajout d'un backend SMTP ou d'un envoi automatique d'emails (v0.1 = brouillons locaux uniquement).

## Licence

En contribuant, tu acceptes que ton code soit publié sous la
[Business Source License 1.1](LICENSE) du projet.
Change Date 2030-04-21 → Apache License 2.0.

## Code de conduite

Respect, clarté, bienveillance. Pas de harcèlement ni d'attaques personnelles.
Toute violation signalée sera traitée par le mainteneur dans les 48h.

## Contact mainteneur

Tom Andrieu — contact@alphaluppi.com — [@Seeyko_](https://twitter.com/seeyko_)
