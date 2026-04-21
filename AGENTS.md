# AGENTS.md — Instructions multi-agents pour FAKT

Ce fichier complète `CLAUDE.md` pour les contextes où plusieurs agents IA collaborent (Claude Code + Cursor + Codex + agents MCP externes). Il est lu par la plupart des outils compatibles AGENTS.md.

## Règles générales

- Lire `CLAUDE.md` d'abord. Les règles y sont prioritaires.
- Communication utilisateur en **français**.
- Toujours vérifier `docs/bmm-workflow-status.yaml` avant d'ajouter des stories ou changer l'architecture — FAKT suit BMAD Method v6.

## Rôles

- **Business Analyst (BMAD brief)** — auteur de `docs/product-brief.md`. Ne touche pas au code.
- **Product Manager (BMAD PRD)** — auteur de `docs/prd.md` et des user stories. Priorise le backlog.
- **Architect (BMAD architecture)** — auteur de `docs/architecture.md`, définit les packages et leurs interfaces. Garant de la stack non-négociable.
- **Developer (BMAD dev-story)** — implémente les stories. Respecte les tests et les standards.
- **Reviewer (BMAD code-review)** — valide les PR. Bloque si non-conformité avec CLAUDE.md ou les règles légales FR.
- **QA / Verifier** — lance les tests, valide visuellement les changements UI, check la conformité mentions légales.

## Travail parallèle

Quand plusieurs agents bossent en même temps :
- Déclarer son périmètre dans le titre de PR (ex: `feat(pdf): port template devis`).
- Ne pas modifier les fichiers en dehors de son scope sauf bug bloquant.
- Coordination via issues GitHub + labels (`scope:pdf`, `scope:ui`, `scope:ai`, etc.).

## Limitations

- Pas d'appel à une API externe payante (Yousign, Stripe, etc.) en MVP sans validation explicite de Tom.
- Pas d'ajout de dépendance lourde (> 1 MB) sans justification dans la PR description.
- Pas de modification de `LICENSE`, `bmad/config.yaml`, ou `CLAUDE.md` sans discussion avec le mainteneur.

## Outils recommandés

- **Claude Code CLI** pour l'implémentation principale.
- **BMAD workflows** (`/product-brief`, `/prd`, `/architecture`, `/create-story`, `/dev-story`, `/code-review`) pour le pilotage.
- **Vitest + Playwright** pour tests.
- **Biome** (à confirmer à l'architecture) pour lint+format.

## Ressources

- Brief : `docs/product-brief.md`
- PRD : `docs/prd.md` (à venir)
- Archi : `docs/architecture.md` (à venir)
- Status workflow : `docs/bmm-workflow-status.yaml`
- Pattern référence : https://github.com/AlphaLuppi/mnm
