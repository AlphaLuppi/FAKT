# Contribuer à FAKT — version courte

**Audience :** Dev contributeur
**Résumé :** Les bases en 30 secondes. Pour le détail complet, voir [CONTRIBUTING.md](../../CONTRIBUTING.md) à la racine.
**Dernière mise à jour :** 2026-04-25

---

## Quick start

```bash
git clone https://github.com/AlphaLuppi/FAKT.git
cd FAKT
bun install
bun run dev
```

## Standards

- **Conventional commits** : `feat(scope):`, `fix(scope):`, `refactor(scope):`, `test(scope):`, `docs(scope):`
- **DCO obligatoire** : `git commit -s` (ajoute `Signed-off-by:` automatiquement)
- **Lint zéro warning** sur la CI : `bun run lint` doit passer
- **TypeScript strict** : `any` interdit, utilisez `unknown` + type guards
- **Tests** : Vitest + Playwright. Coverage cible 70% sur `packages/core` et `packages/pdf`

## Commandes utiles

```bash
bun run typecheck   # Vérification TypeScript strict tous packages
bun run lint        # Biome (format + lint)
bun run test        # Vitest + Playwright (tous les packages)
bun run build       # Build production Vite
bun run release     # Build Tauri complet (installers)
```

## Workflow

1. Créer une branche `feature/xxx` ou `fix/xxx` (jamais commit direct sur main)
2. Coder + tester localement
3. Commit avec `git commit -s -m "feat(scope): description"`
4. Push + ouvrir une PR
5. CI vérifie : typecheck, lint, tests, builds
6. Code review (CODEOWNERS auto-assignés)
7. Merge

## Pour aller plus loin

- [../../CONTRIBUTING.md](../../CONTRIBUTING.md) — **guide complet**, texte DCO, workflow détaillé
- [../../CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) — Contributor Covenant 2.1
- [architecture-overview.md](architecture-overview.md) — résumé technique
- [design-system.md](design-system.md) — Brutal Invoice (pour les contribs UI)
- [../../CLAUDE.md](../../CLAUDE.md) — instructions agents IA (Claude Code, Cursor)
