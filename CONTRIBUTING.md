# Contribuer à FAKT

Merci de ton intérêt pour FAKT. Ce document résume comment participer au projet.

## Format des contributions

On utilise le **DCO (Developer Certificate of Origin)**, pas un CLA.
Chaque commit que tu proposes doit inclure la ligne suivante en pied de message :

```
Signed-off-by: Prénom Nom <ton@email.com>
```

Tu peux l'ajouter automatiquement avec `git commit -s`.

Cela signifie que tu certifies avoir le droit de contribuer ton code sous la licence BSL 1.1 du projet (voir fichier `LICENSE`).

## Workflow

1. Fork le repo.
2. Crée une branche descriptive : `feat/nom-de-la-feature`, `fix/nom-du-bug`, `docs/...`.
3. Commits conventionnels : `feat(scope): description`, `fix(scope): description`, `refactor`, `test`, `docs`, `chore`.
4. Ouvre une PR vers `main` avec une description claire du "pourquoi" (pas juste "quoi").
5. Attends review. Les mainteneurs regardent sous ~48h en semaine.

## Issues

Avant d'ouvrir une issue, cherche si elle existe déjà. Sinon :

- **Bug :** reproduire en 3 lignes, OS + version FAKT + version Claude CLI, logs pertinents.
- **Feature :** décris le problème utilisateur, pas la solution. On discute la solution en commentaires.
- **Question :** préfère les [Discussions GitHub](https://github.com/AlphaLuppi/FAKT/discussions) pour les questions ouvertes.

## Standards code

- TypeScript strict, `any` interdit.
- Format automatique (Biome ou Prettier — à confirmer à l'architecture).
- Lint zéro warning.
- Tests requis sur `packages/core` et `packages/pdf` (coverage >= 70%).
- Commits atomiques — une feature ou un fix par PR dans l'idéal.

## Périmètre des contributions

Bienvenues :
- Corrections de bugs.
- Nouvelles traductions (FR est la base, ajoute ta langue).
- Templates régionaux (Belgique, Suisse, Québec).
- Plugins (export compta, intégrations tierces).
- Amélioration des docs.

Discute d'abord en issue :
- Changements d'architecture.
- Nouvelles features majeures.
- Ajout de dépendances.

Probablement pas acceptées :
- Changements qui cassent la compatibilité avec la législation française micro-entreprise (règle non-négociable).
- Changements de design système sans discussion préalable (Brutal Invoice est la base).

## Licence

En contribuant, tu acceptes que ton code soit publié sous la [Business Source License 1.1](LICENSE) du projet.

## Code de conduite

Respect, clarté, bienveillance. Pas de harcèlement, pas d'attaques personnelles. Toute violation = ban.

## Questions

Ouvre une [Discussion GitHub](https://github.com/AlphaLuppi/FAKT/discussions) ou écris à contact@alphaluppi.com.
