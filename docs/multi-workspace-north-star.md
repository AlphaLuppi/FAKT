# Multi-workspace — North Star architectural

**Audience :** Mainteneur, contributeur, agent IA.
**Résumé :** Toute évolution de FAKT doit préserver la possibilité d'avoir plusieurs workspaces par compte sans refactor structural.
**Dernière mise à jour :** 2026-04-25

---

## Origine de la décision

Demande explicite de Tom Andrieu (mainteneur) lors du setup mode 2 self-host AlphaLuppi (2026-04-25) :

> "Pour l'instant FAKT ne doit gérer qu'un SIRET/SIREN donc je dirais un seul workspace, mais gardons le flexible et prêt à l'évolution si jamais par exemple on travaille en mode maison mère/fille ou AlphaLuppi est un holding et qu'on a chacun notre entreprise ce serais bien de pouvoir tout gérer au même endroit, mais ça c'est le plan long terme documente le et que ça drive les futurs développements de ne jamais oublier ça et de pas faire des trucs architecturellement bloquant."

## Cas d'usage anticipés (à terme)

1. **Holding AlphaLuppi + filiales** : 1 compte mère + N filiales (chacune avec son SIRET, sa numérotation, ses clients).
2. **Agence partagée + entreprise perso de chaque user** : workspace agence commun + workspace personnel par user.
3. **Migration entre régimes fiscaux** : créer un nouveau workspace EI/SASU à côté de l'ancien micro-entreprise pour la transition.
4. **Multi-tenant SaaS v0.3** : un workspace par client, avec RLS Postgres.

## Implications concrètes

Ces règles doivent être respectées **par CHAQUE contribution** au code (humaine ou IA). Tout choix qui les violerait doit être justifié dans la PR.

### Côté DB (packages/db/)

- **Toute table métier** doit avoir `workspace_id text NOT NULL REFERENCES workspaces(id)`.
- **Toute contrainte d'unicité métier** (numéro de facture par exemple) doit inclure `workspace_id` :
  - ✅ `UNIQUE(workspace_id, year, sequence)` sur `quotes` / `invoices`
  - ❌ `UNIQUE(year, sequence)` (provoquerait des collisions cross-workspace)
- **La numérotation séquentielle CGI** est par `(workspace_id, year, type)` — jamais globale.
- La table **`user_workspaces`** (n:n) est posée dès le MVP, même si tous les users d'AlphaLuppi sont sur le même workspace. C'est elle qui permet l'extension future sans migration cassante.
- **Aucune migration DB ne doit faire de `DROP COLUMN workspace_id`** — toujours évolution additive.

### Côté API (packages/api-server/)

- **Toute route `/api/*`** doit résoudre `c.var.workspaceId` via le middleware d'auth (mode 1 = single workspace seedé, mode 2 = JWT claim + header `X-FAKT-Workspace-Id` validé contre `payload.ws[]`).
- **Toute query Drizzle** côté route doit filtrer par `workspaceId` :
  - ✅ `db.select().from(invoices).where(eq(invoices.workspaceId, c.var.workspaceId))`
  - ❌ `db.select().from(invoices)` sans filtre workspace
- **Aucun endpoint** ne doit exposer un `id` cross-workspace sans contrôle. Lookup par id ⇒ vérifier que la row appartient au `workspaceId` courant.
- En mode 3 SaaS (futur), les **policies RLS Postgres** seront le filet de sécurité — mais le code applicatif doit déjà être correct sans dépendre de RLS.

### Côté frontend (apps/desktop/)

- **Tout fetch de données** passe par l'`ApiClient` qui injecte automatiquement `X-FAKT-Workspace-Id` (lu depuis `useWorkspaceStore.getState().currentWorkspaceId`).
- **Tout composant** qui affiche de la donnée doit consommer le store workspace courant (via `useWorkspaceStore` ou cache TanStack Query keyé sur `workspaceId`).
- Le composant **`<WorkspaceSwitcher>`** existe **dès le MVP** dans la topbar. Caché si 1 workspace, dropdown si plusieurs. Pose le pattern UI sans coût MVP.
- **TanStack Query keys** doivent inclure `workspaceId` pour invalidation correcte au switch :
  - ✅ `["invoices", workspaceId]`
  - ❌ `["invoices"]`

### Côté distribution / infra

- **Pas de hard-code d'un seul workspace** dans les builds AlphaLuppi pré-bakés (compile-time). Le workspace courant est résolu **au login**, jamais bakée.
- Les **scripts de migration** (`migrate-sqlite-to-postgres.ts`) préservent les UUIDs workspace tels quels (pas de re-attribution), pour que le multi-workspace puisse être ajouté plus tard sans re-migration.

## Anti-patterns à refuser en review

| Pattern | Pourquoi c'est mauvais |
|---|---|
| Variable globale `currentWorkspaceId` côté front (au lieu d'un store) | Pas testable, race condition au switch |
| Query Drizzle sans `where(eq(table.workspaceId, ...))` | Leak cross-workspace à la première migration multi-tenant |
| Settings utilisateur stockés sans `workspace_id` | Confusion entre prefs perso vs prefs workspace |
| Numérotation séquentielle globale | Violation CGI dès qu'on ajoute un 2e workspace |
| Foreign key cross-workspace (ex: client d'un workspace référencé par invoice d'un autre) | Casse l'isolation multi-tenant |
| Cache TanStack Query keyé sans `workspaceId` | Affichage des données du mauvais workspace après switch |
| Endpoint `/api/admin/*` sans check `userId in user_workspaces` | Élévation de privilèges cross-workspace |

## Points d'extension futurs (non-MVP)

- **Onboarding multi-workspace** : permettre à un user de créer un nouveau workspace depuis l'UI (mode 2/3).
- **Invitations** : mécanisme pour inviter un user existant dans un workspace (table `workspace_invitations`).
- **Roles plus fins** : actuellement `owner|admin|member`. Pourrait s'étendre à `accountant`, `viewer`, etc.
- **RLS Postgres** : policies au niveau DB pour mode 3 SaaS public (`SET LOCAL app.current_workspace = $1` au début de chaque request).
- **Workspace switcher avec recherche** : fuzzy search si un user est dans 20+ workspaces.
- **Export multi-workspace** : zip combiné avec dossier par workspace.

## Comment vérifier qu'on respecte la north star

Avant de merger une PR qui touche au modèle de données ou aux queries :

1. **Grep pour vérifier le filtre workspace** :
   ```bash
   rg "db\.(select|insert|update|delete)" packages/api-server/src/routes/ -A 5 | grep -i "workspaceId"
   ```
   Toute query métier doit avoir un filtre workspace ou être explicitement justifiée.

2. **Vérifier les contraintes d'unicité** :
   ```bash
   rg "uniqueIndex|unique\(" packages/db/src/schema/
   ```
   Les uniques métier doivent inclure `workspaceId`.

3. **Vérifier les TanStack Query keys** :
   ```bash
   rg "queryKey:" apps/desktop/src/
   ```
   Les keys de données scoped workspace doivent inclure `workspaceId` (ou un proxy comme `currentWorkspaceId`).

4. **Vérifier qu'on n'a pas de `currentWorkspaceId` global** :
   ```bash
   rg "currentWorkspaceId" apps/desktop/src/ --files-without-match | xargs grep -l "globalThis\|window\."
   ```

## Références code

- Schéma Postgres avec FK workspace partout : [packages/db/src/schema/pg.ts](../packages/db/src/schema/pg.ts)
- Table `user_workspaces` n:n : [packages/db/src/schema/pg.ts](../packages/db/src/schema/pg.ts)
- Middleware résolution workspace : [packages/api-server/src/auth/middleware-jwt.ts](../packages/api-server/src/auth/middleware-jwt.ts)
- Header `X-FAKT-Workspace-Id` côté client : [apps/desktop/src/api/client.ts](../apps/desktop/src/api/client.ts)
- Store workspace courant : [apps/desktop/src/stores/useWorkspaceStore.ts](../apps/desktop/src/stores/useWorkspaceStore.ts)
- Composant switcher : [apps/desktop/src/features/shell/WorkspaceSwitcher.tsx](../apps/desktop/src/features/shell/WorkspaceSwitcher.tsx)

## Pour les agents IA

Quand tu travailles sur FAKT, **avant tout choix d'architecture qui touche au modèle de données ou aux queries**, vérifie cette north star. Si tu hésites, demande à Tom plutôt que de faire un choix qui bloquerait l'évolution multi-workspace.

Ce fichier est référencé dans [`CLAUDE.md`](../CLAUDE.md) — toute session Claude Code le lit automatiquement.
