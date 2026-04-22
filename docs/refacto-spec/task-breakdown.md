# FAKT v0.1 — Task breakdown Phase 2 Build

**Statut** : spec exécutable, prêt à spawner agents.
**Auteur** : pm-breakdown, team `fakt-phase1-design`.
**Date** : 2026-04-22.
**Cible** : team `fakt-phase2-build`, 8 agents `general-purpose` parallèles.
**Prérequis** : `docs/refacto-spec/api-endpoints.md` lu + `docs/refacto-spec/architecture.md` validé.

## Vue d'ensemble

8 tracks disjoints (zéro overlap git). Objectif : `v0.1.0` dogfoodable dans ~2-3 jours calendaires d'exécution parallèle.

### Graphe de dépendances

```
  α (scaffold + workspace + clients) ──┬──> β (services + quotes)
                                       │
                                       └──> γ (invoices + activity + signature-events + backups)
  δ (Tauri sidecar)  ───> ε (refacto hooks React invoke→fetch)
                         ↑                ↑
  ζ (plugins Tauri + capabilities + supprimer stubs cycle.rs)
  η (signature fixes : hash TSA + persistance + mismatch + test file)
  θ (migration payment_notes + README NFR-003 + CHANGELOG + dettes mineures)
```

### Ordre d'exécution conseillé

1. **Wave 1** (parallèle immédiat) : α + δ + ζ + η + θ. Zéro dépendance croisée : α écrit dans `packages/api-server/`, δ dans `apps/desktop/src-tauri/`, ζ dans Cargo.toml + capabilities + cycle.rs, η dans commands Rust signature + migrations, θ dans migrations + docs.
2. **Wave 2** (dès α livré) : β + γ en parallèle.
3. **Wave 3** (dès α + β + γ + δ livrés) : ε refacto frontend.

Aucun track ne touche en écriture les mêmes fichiers qu'un autre. Voir section « Matrice des fichiers » à la fin pour validation mécanique.

### Commit policy

- 1 track = 1 agent = **1 commit atomique** (DCO `-s` obligatoire).
- Format message : `feat(refacto-{track-letter}): <description courte>`.
- Commit direct sur `main` (pas de worktree branch, cf feedback Tom).
- `git add` avec chemins explicites listés dans le track — jamais `git add .`.
- Avant commit : `bun run typecheck && bun run test && bun run build` all-green. Si échec, fix avant commit (pas de commit cassé).
- Après commit, cocher la case `- [x]` dans `docs/sprint-notes/progress.md` section Phase 2.

---

## Track α — api-server scaffold + workspace + clients

**Durée estimée** : 6-8h agent.
**Dépendances upstream** : aucune.
**Bloque** : β, γ, ε.

### Objectifs

1. Scaffolder le package `packages/api-server/` Bun + Hono.
2. Implémenter les middlewares partagés (auth, Zod validation, error handler, logger).
3. Implémenter 10 premiers endpoints : healthcheck + workspace + clients + settings.

### Fichiers à créer

```
packages/api-server/
├── package.json                    (new)
├── tsconfig.json                   (new)
├── src/
│   ├── server.ts                   (new — Hono app factory)
│   ├── index.ts                    (new — entry point, lit port & token depuis env, start listen)
│   ├── middleware/
│   │   ├── auth.ts                 (new — vérif X-FAKT-Token timingSafeEqual)
│   │   ├── zod.ts                  (new — helper validate body/query Zod)
│   │   ├── error-handler.ts        (new — catch any error → JSON standardisé)
│   │   ├── request-id.ts           (new — UUID v4 par requête, log contextualisé)
│   │   └── index.ts                (new — re-exports)
│   ├── schemas/
│   │   ├── workspace.ts            (new — Zod schemas PATCH/POST workspace)
│   │   ├── clients.ts              (new — Zod CreateClient, UpdateClient)
│   │   ├── settings.ts             (new — Zod Setting)
│   │   └── index.ts                (new)
│   ├── routes/
│   │   ├── health.ts               (new — GET /health)
│   │   ├── workspace.ts            (new — GET, POST, PATCH /api/workspace)
│   │   ├── settings.ts             (new — GET /api/settings, /:key, PUT /:key)
│   │   ├── clients.ts              (new — CRUD + search + restore)
│   │   └── index.ts                (new — Hono router root)
│   └── db-singleton.ts             (new — wrap createDb() depuis packages/db, singleton instance)
└── tests/
    ├── health.test.ts              (new)
    ├── workspace.test.ts           (new)
    ├── clients.test.ts             (new)
    └── helpers.ts                  (new — spawn test server + DB in-memory)
```

### Fichiers à modifier

```
package.json                        (root — ajouter packages/api-server au workspace)
packages/db/src/queries/settings.ts (ajouter createWorkspace)
packages/db/src/queries/clients.ts  (ajouter restoreClient)
packages/db/src/queries/index.ts    (re-export si nécessaire)
```

### Endpoints à implémenter (11)

- `GET /health`
- `GET /api/workspace`
- `POST /api/workspace`
- `PATCH /api/workspace`
- `GET /api/settings`
- `GET /api/settings/:key`
- `PUT /api/settings/:key`
- `GET /api/clients` (+ search, pagination)
- `GET /api/clients/:id`
- `POST /api/clients`
- `PATCH /api/clients/:id`
- `DELETE /api/clients/:id`
- `POST /api/clients/:id/restore`
- `GET /api/clients/search`

### DoD

- [ ] `cd packages/api-server && bun run test` passe (≥ 15 tests unit + intégration in-memory DB).
- [ ] `bun run typecheck` vert sur `packages/api-server/`.
- [ ] `bun run build` produit `packages/api-server/dist/` exécutable Node/Bun.
- [ ] Scenario manuel : `bun run packages/api-server/src/index.ts` démarre sur port arbitraire, `curl -H "X-FAKT-Token: xxx" http://localhost:PORT/health` renvoie 200 JSON.
- [ ] Entry point lit `FAKT_API_PORT` (défaut 0 = aléatoire) et `FAKT_API_TOKEN` (obligatoire), logue sur stdout `{"event":"listening","port":NNNNN,"pid":PPP}` (parsable par Tauri Rust).
- [ ] Tests couvrent : happy path CRUD clients, 401 sans token, 404 client inexistant, 409 email dupliqué, 400 body Zod invalide.

### Commit message template

```
feat(refacto-α): scaffold packages/api-server + endpoints workspace/clients/settings

Introduit le sidecar Bun+Hono qui wrappe les queries Drizzle :
- Middlewares auth (X-FAKT-Token), Zod, error handler, request-id.
- Endpoints workspace (GET, POST, PATCH), settings (GET, PUT), clients (CRUD + restore + search).
- Entry point lisible par Tauri via stdout JSON.
- Tests intégration SQLite in-memory (15+ cas).

Ajoute `createWorkspace` et `restoreClient` dans queries/.

Refs : docs/refacto-spec/api-endpoints.md sections 4-7.

Signed-off-by: <agent name>
```

---

## Track β — endpoints prestations + quotes

**Durée estimée** : 5-7h agent.
**Dépendances upstream** : α livré (scaffold + middlewares dispo).
**Bloque** : ε (partiel — les composants Devis consomment ces endpoints).

### Objectifs

Implémenter 18 endpoints couvrant services (prestations) + quotes (devis complet avec cycle de vie).

### Fichiers à créer

```
packages/api-server/src/schemas/
├── services.ts                     (new — Zod CreatePrestation, UpdatePrestation)
└── quotes.ts                       (new — Zod CreateQuote, UpdateQuote, QuoteItem)

packages/api-server/src/routes/
├── services.ts                     (new — CRUD + search + restore)
└── quotes.ts                       (new — CRUD + issue + expire + cancel + mark-signed + mark-invoiced + search + preview-next-number)

packages/api-server/src/routes/
└── numbering.ts                    (new — GET /api/numbering/peek, POST /next)

packages/api-server/tests/
├── services.test.ts                (new)
├── quotes.test.ts                  (new)
├── numbering.test.ts               (new)
└── quotes-cycle.test.ts            (new — cycle de vie complet draft→sent→signed→invoiced)
```

### Fichiers à modifier

```
packages/api-server/src/routes/index.ts   (wire les nouveaux routers)
packages/db/src/queries/prestations.ts    (ajouter restorePrestation)
```

### Endpoints à implémenter (18)

Services :
- `GET /api/services`
- `GET /api/services/:id`
- `POST /api/services`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
- `POST /api/services/:id/restore`
- `GET /api/services/search`

Numbering :
- `GET /api/numbering/peek`
- `POST /api/numbering/next`

Quotes :
- `GET /api/quotes`
- `GET /api/quotes/:id`
- `POST /api/quotes`
- `PATCH /api/quotes/:id`
- `DELETE /api/quotes/:id`
- `POST /api/quotes/:id/issue`
- `POST /api/quotes/:id/expire`
- `POST /api/quotes/:id/cancel`
- `POST /api/quotes/:id/mark-signed`
- `POST /api/quotes/:id/mark-invoiced`
- `GET /api/quotes/search`

### DoD

- [ ] Tests unit services (8+) et quotes (12+) verts.
- [ ] Test de **cycle de vie complet** : créer draft → issue (numéro attribué D2026-001) → mark-signed → mark-invoiced, vérifier les transitions refusées (ex: issue sur signed).
- [ ] Numérotation atomique vérifiée : 10 `POST /api/numbering/next` séquentiels → sequences 1..10 sans trou.
- [ ] Transition `PATCH /quotes/:id` sur un quote `sent` retourne `422 INVALID_TRANSITION`.
- [ ] `DELETE /api/quotes/:id` sur un quote non-draft → `422`.
- [ ] Aucun warning lint, aucun any TS.

### Commit message template

```
feat(refacto-β): endpoints services + quotes + numbering

- Services : CRUD + restore + search (7 endpoints).
- Numbering : peek + next atomic (2 endpoints).
- Quotes : CRUD + cycle complet issue/expire/cancel/mark-signed/mark-invoiced + search (11 endpoints).
- Tests intégration : 20+ cas dont cycle de vie complet draft→sent→signed→invoiced.

Ajoute `restorePrestation` dans queries/.

Refs : docs/refacto-spec/api-endpoints.md sections 8-10.

Signed-off-by: <agent name>
```

---

## Track γ — endpoints invoices + activity + signature-events + signed-documents + backups

**Durée estimée** : 6-8h agent.
**Dépendances upstream** : α livré (scaffold + middlewares).
**Bloque** : ε.

### Objectifs

Implémenter 21 endpoints couvrant factures (cycle complet, from-quote, mark-paid avec notes), activity feed, signature events append-only, signed documents metadata, backups journal. Inclut plusieurs nouvelles queries Drizzle.

### Fichiers à créer

```
packages/db/src/queries/activity.ts            (new — listActivity, insertActivity)
packages/db/src/queries/signed-documents.ts    (new — getSignedDocument, upsertSignedDocument)
packages/db/src/queries/backups.ts             (new — listBackups, insertBackup, deleteBackup)

packages/api-server/src/schemas/
├── invoices.ts                     (new)
├── activity.ts                     (new)
├── signature-events.ts             (new)
├── signed-documents.ts             (new)
└── backups.ts                      (new)

packages/api-server/src/routes/
├── invoices.ts                     (new — CRUD complet + from-quote + issue + mark-paid + archive + mark-overdue + cancel + search)
├── activity.ts                     (new)
├── signature-events.ts             (new — append-only + verify chain)
├── signed-documents.ts             (new — metadata only, pas de bytes)
└── backups.ts                      (new)

packages/api-server/tests/
├── invoices.test.ts                (new)
├── invoices-from-quote.test.ts     (new — 3 modes deposit30/balance/full)
├── activity.test.ts                (new)
├── signature-events.test.ts        (new — vérifie triggers no-update/no-delete)
├── signed-documents.test.ts        (new)
└── backups.test.ts                 (new)
```

### Fichiers à modifier

```
packages/api-server/src/routes/index.ts              (wire routers)
packages/db/src/queries/invoices.ts                  (ajouter deleteInvoice, updateInvoiceStatus, archiveInvoice, searchInvoices, étendre markInvoicePaid avec paymentNotes)
packages/db/src/queries/index.ts                     (re-export nouveaux fichiers)
```

### Endpoints à implémenter (21)

Invoices (12) :
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `POST /api/invoices`
- `POST /api/invoices/from-quote`
- `PATCH /api/invoices/:id`
- `DELETE /api/invoices/:id`
- `POST /api/invoices/:id/issue`
- `POST /api/invoices/:id/mark-paid`
- `POST /api/invoices/:id/mark-overdue`
- `POST /api/invoices/:id/cancel`
- `POST /api/invoices/:id/archive`
- `GET /api/invoices/search`

Activity (2) :
- `GET /api/activity`
- `POST /api/activity`

Signature events (3) :
- `GET /api/signature-events`
- `POST /api/signature-events`
- `GET /api/signature-events/verify`

Signed documents (2) :
- `GET /api/signed-documents/:documentType/:documentId`
- `POST /api/signed-documents`

Backups (3) :
- `GET /api/backups`
- `POST /api/backups`
- `DELETE /api/backups/:id`

### DoD

- [ ] Tests invoices (15+), activity (5+), signature-events (8+), signed-documents (4+), backups (5+) verts.
- [ ] Test **create-from-quote** : 3 modes testés (deposit30=30% total, full=100%, balance=solde restant). Vérifie ratio proportionnel items.
- [ ] Test **mark-paid avec notes** : colonne `payment_notes` persistée et ressortie au GET (dépend track θ pour la migration).
- [ ] Test **signature-events append-only** : tentative UPDATE/DELETE via Drizzle direct → trigger SQL rejette (SELECT events inchangés).
- [ ] Test **verify chain** : 3 events chaînés OK + 1 event corrompu (previousEventHash modifié en RAW SQL bypassing trigger) → `brokenChainIndices: [2]`.
- [ ] Test **hard delete invoice issued** : `DELETE /api/invoices/:id` sur status=sent → 422.
- [ ] Aucun leak de stack trace dans les réponses d'erreur.

### Commit message template

```
feat(refacto-γ): endpoints invoices + activity + signature-events + signed-documents + backups

- Invoices : CRUD + from-quote 3 modes + issue + mark-paid avec notes + archive + mark-overdue + cancel + search (12 endpoints).
- Activity feed : list + insert (2).
- Signature events : append-only + verify chain (3).
- Signed documents metadata : get + upsert (2).
- Backups journal : list + insert + delete (3).

Nouvelles queries Drizzle : activity.ts, signed-documents.ts, backups.ts.
Extensions invoices.ts : deleteInvoice, updateInvoiceStatus, archiveInvoice, searchInvoices, markInvoicePaid(notes).

Tests : 40+ cas dont from-quote 3 modes, append-only triggers, chain verify.

Refs : docs/refacto-spec/api-endpoints.md sections 11-15.

Signed-off-by: <agent name>
```

---

## Track δ — Tauri sidecar spawn + port discovery + bundle Bun cross-OS

**Durée estimée** : 5-7h agent.
**Dépendances upstream** : aucune (scaffold côté Rust parallèle de α).
**Bloque** : ε (le frontend a besoin du port pour `api-client.ts`).

### Objectifs

Configurer Tauri 2 pour spawner le binaire api-server en sidecar au démarrage :
- Bundler api-server avec `bun build --compile` pour 3 OS (Windows, macOS, Linux).
- Déclarer le sidecar dans `tauri.conf.json` (`bundle.externalBin`).
- Spawn logic Rust : lance le binaire, récupère port via stdout JSON, injecte `window.__FAKT_API_TOKEN` + `window.__FAKT_API_PORT` dans le webview.
- Healthcheck polling avant de charger React.

### Fichiers à créer

```
apps/desktop/src-tauri/src/sidecar.rs        (new — module Spawn + discovery)
apps/desktop/src-tauri/binaries/              (new — dossier où apparaissent les binaires Bun compilés par track)
apps/desktop/src-tauri/binaries/.gitignore   (new — ignore les binaires build, ne garder qu'un README de structure)
scripts/build-sidecar.ts                      (new — script root qui build api-server pour les 3 targets Bun cross-compile)
```

### Fichiers à modifier

```
apps/desktop/src-tauri/Cargo.toml             (ajouter tauri-plugin-shell déjà présent, rien à changer ; éventuellement crate rand pour token génération)
apps/desktop/src-tauri/tauri.conf.json        (bundle.externalBin, initializationScript injectant __FAKT_API_TOKEN / PORT)
apps/desktop/src-tauri/src/lib.rs             (dans setup() : spawn sidecar avant app.manage(), attendre healthcheck, puis injecter token/port)
apps/desktop/src-tauri/capabilities/default.json (permettre shell-execute sidecar)
apps/desktop/package.json                     (script prebuild: `bun run scripts/build-sidecar.ts`)
package.json (root)                           (orchestration build sidecar → desktop)
.github/workflows/release-desktop.yml         (ajouter step build sidecar 3 OS avant package Tauri)
README.md                                     (section « NFR-003 : taille ~100 MB justifiée par sidecar Bun »)
```

### Détails techniques

1. **Token génération** : dans `setup()` Rust, générer 32 octets crypto random via `rand::random::<[u8; 32]>()` → hex → string partagée avec le sidecar via env `FAKT_API_TOKEN=xxx` au spawn.
2. **Spawn** : `tauri::api::process::Command::new_sidecar("fakt-api")?.envs([...]).spawn()?` → handle `Child`. Non-blocking.
3. **Port discovery** : lire `child.stdout` ligne par ligne jusqu'à matcher regex `{"event":"listening","port":\d+}`. Timeout 10s → si pas de match, error au boot.
4. **Healthcheck polling** : `GET http://127.0.0.1:PORT/health` toutes les 100ms jusqu'à 200, timeout 5s après listening.
5. **Injection webview** : option A = `tauri.conf.json` `initializationScript` statique qui lit ensuite les valeurs via un endpoint Tauri auxiliaire. Option B recommandée = `Window::execute_javascript()` au runtime pour définir `window.__FAKT_API_TOKEN` et `window.__FAKT_API_PORT` juste après spawn réussi (appelé depuis le setup handler Rust, avant le chargement React).
6. **Sidecar binaire** : `bun build packages/api-server/src/index.ts --compile --target=bun-linux-x64 --outfile apps/desktop/src-tauri/binaries/fakt-api-x86_64-unknown-linux-gnu` (ajouter 3 targets : linux-x64, darwin-arm64, windows-x64). Nommage suit convention Tauri `{name}-{rust-target-triple}`.
7. **Shutdown** : au `on_window_event` close, tuer proprement le child via SIGTERM (Unix) ou `terminate()` (Windows). Kill -9 après 3s si refus.
8. **Dev mode** : en `bun run tauri dev`, possibilité de skip le sidecar et pointer vers un `bun run packages/api-server/src/index.ts` manuel via env `FAKT_API_EXTERNAL=1` + port fixe. Documenté dans README.

### DoD

- [ ] `bun run tauri:dev` démarre proprement : sidecar spawn visible dans logs, healthcheck OK, webview charge sans erreur console « __FAKT_API_TOKEN undefined ».
- [ ] `bun run scripts/build-sidecar.ts` produit les 3 binaires compilés (taille ~60-80 MB chacun).
- [ ] `bun run tauri:build` produit un installer desktop qui embarque le bon sidecar.
- [ ] Test manuel : couper le process sidecar via Task Manager → webview doit afficher un écran d'erreur « API unreachable, redémarrez l'app » (pas de blanc).
- [ ] Test manuel Windows : chemin contenant espace (ex: `C:\Program Files\FAKT\`) → sidecar spawn OK.
- [ ] README NFR-003 mis à jour : ~100 MB justifié, note Bun compile vs port Rust futur.
- [ ] CI GitHub Actions build les 3 sidecars pré-package (sinon release cassée).

### Commit message template

```
feat(refacto-δ): sidecar Tauri Bun api-server + port discovery + cross-OS build

- Spawn logic Rust (sidecar.rs) : lance binaire api-server avec token env, lit port via stdout JSON, healthcheck, injecte token/port dans webview via initializationScript.
- tauri.conf.json : externalBin fakt-api-{target-triple}, capability shell-execute.
- scripts/build-sidecar.ts : compile 3 targets Bun (linux-x64, darwin-arm64, windows-x64).
- CI release-desktop.yml : step build sidecar avant Tauri bundle.
- README NFR-003 : ~100 MB justifié.

Shutdown propre : SIGTERM sidecar child à window close.

Refs : docs/refacto-spec/architecture.md § sidecar.

Signed-off-by: <agent name>
```

---

## Track ε — refactor hooks React : invoke → fetch via api-client.ts

**Durée estimée** : 4-6h agent.
**Dépendances upstream** : α + β + γ livrés (tous les endpoints consommés doivent exister) + δ livré (token/port injectés dans webview).
**Bloque** : rien (dernière pièce frontend).

### Objectifs

Remplacer tous les `invoke(IPC_COMMANDS.XXX)` par des `fetch()` vers le sidecar, sauf les 11 commandes Rust conservées (cf `api-endpoints.md` section 16). Introduire un client React Query par-dessus.

### Fichiers à créer

```
apps/desktop/src/api/api-client.ts               (new — fetch wrapper : attache X-FAKT-Token, baseURL depuis window.__FAKT_API_PORT, gestion erreurs typée)
apps/desktop/src/api/clients.ts                  (new — listClients, getClient, createClient, updateClient, deleteClient, restoreClient, searchClients)
apps/desktop/src/api/services.ts                 (new — idem services)
apps/desktop/src/api/quotes.ts                   (new — idem quotes + cycle de vie)
apps/desktop/src/api/invoices.ts                 (new — idem invoices + from-quote + mark-paid)
apps/desktop/src/api/workspace.ts                (new)
apps/desktop/src/api/settings.ts                 (new)
apps/desktop/src/api/numbering.ts                (new)
apps/desktop/src/api/activity.ts                 (new)
apps/desktop/src/api/signature-events.ts         (new — append, list, verify)
apps/desktop/src/api/signed-documents.ts         (new — metadata)
apps/desktop/src/api/backups.ts                  (new)
apps/desktop/src/api/index.ts                    (new — barrel)
```

### Fichiers à modifier (refacto hooks)

```
apps/desktop/src/hooks/useClients.ts                          (remplacer invoke par fetch via api-client)
apps/desktop/src/hooks/usePrestations.ts                      (idem)
apps/desktop/src/features/doc-editor/clients-api.ts           (switcher body Tauri → fetch)
apps/desktop/src/features/doc-editor/prestations-api.ts       (idem)
apps/desktop/src/features/doc-editor/quotes-api.ts            (idem)
apps/desktop/src/features/doc-editor/invoice-api.ts           (idem)
apps/desktop/src/features/doc-editor/workspace-api.ts         (idem)
apps/desktop/src/features/doc-editor/numbering-api.ts         (idem)
apps/desktop/src/features/doc-editor/signature-api.ts         (HYBRIDE : `sign` / `verify` / `storeSignedPdf` / `getSignedPdf` restent invoke Rust, `appendEvent` / `listEvents` basculent fetch)
apps/desktop/src/features/onboarding/RecapStep.tsx            (fix update_workspace via PATCH /api/workspace, permet de finir l'onboarding)
apps/desktop/src/features/cert/tabs/CertificatTab.tsx         (fix mismatch CertInfo : uniformiser avec les noms Rust — dépend track η)
```

### Fichiers à supprimer/stubber

- Les commandes Rust stubs de `cycle.rs` deviennent inutiles — handled par track ζ.

### api-client.ts interface (à respecter)

```typescript
interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T = void>(path: string): Promise<T>;
}

// Implémentation : baseURL = `http://127.0.0.1:${window.__FAKT_API_PORT}/api`
// Headers : X-FAKT-Token: ${window.__FAKT_API_TOKEN}, Content-Type: application/json
// Gestion erreur : parse body { error: { code, message } } → throw FaktApiError typé
```

### DoD

- [ ] `bun run typecheck` vert : aucun `invoke(IPC_COMMANDS.LIST_CLIENTS)` ou équivalent restant dans `apps/desktop/src/`, grep attendu retourne 0 match.
- [ ] Tests existants passent : `ClientPicker.test.tsx`, `ItemsEditor.test.tsx`, etc. Les `setClientsApi(mock)` continuent de fonctionner (les api TS restent stubbables via même interface).
- [ ] Nouveau test : `apps/desktop/src/api/api-client.test.ts` (mock fetch → vérifie headers, 401, 404, 500, JSON parsing erreur).
- [ ] Scenario `bun run tauri:dev` manuel : onboarding 4 étapes termine proprement (update_workspace via PATCH).
- [ ] Scenario : créer client via modal → toast succès → reload app → client apparaît en liste (persisté).
- [ ] Aucun warning console `command not found` dans le webview Tauri.

### Commit message template

```
refactor(refacto-ε): hooks React migrent invoke → fetch via api-client

- apps/desktop/src/api/ : client typé par feature (clients, services, quotes, invoices, workspace, settings, numbering, activity, signature-events, signed-documents, backups) au-dessus d'un api-client.ts central.
- Hooks (useClients, usePrestations) + bridges (clients-api, quotes-api, invoice-api, etc.) passent sur fetch.
- signature-api.ts garde invoke pour sign/verify/storeSignedPdf/getSignedPdf (Rust-only, bytes) et bascule appendEvent/listEvents sur fetch.
- Fix update_workspace onboarding RecapStep.

Fix catégorie « MOCK-ONLY » (audit e2e-wiring) : CRUD métier désormais réel via sidecar.

Refs : docs/refacto-spec/api-endpoints.md section 16 (Rust-only).

Signed-off-by: <agent name>
```

---

## Track ζ — plugins Tauri fs/path/dialog + capabilities + suppression stubs cycle.rs

**Durée estimée** : 3-5h agent.
**Dépendances upstream** : aucune.
**Bloque** : rien directement (mais l'email draft et l'archive ZIP crashent sans ça).

### Objectifs

1. Ajouter les plugins Tauri manquants identifiés dans `e2e-wiring-audit.md` section 7-8.
2. Déclarer les capabilities JSON associées.
3. Supprimer les stubs `Ok(())` de `cycle.rs` qui sont remplacés par les endpoints api-server (track ε les utilisera).

### Fichiers à modifier

```
apps/desktop/src-tauri/Cargo.toml
  + tauri-plugin-fs = "2"
  + tauri-plugin-path = "2"  (si plugin séparé v2 ; sinon utiliser tauri::path::BaseDirectory)
  + tauri-plugin-dialog = "2"

apps/desktop/src-tauri/src/lib.rs
  - dans la chaîne .plugin() : ajouter .plugin(tauri_plugin_fs::init()), .plugin(tauri_plugin_dialog::init())
  - supprimer de invoke_handler! : commands::mark_quote_invoiced, commands::mark_invoice_sent, commands::update_invoice, commands::delete_invoice (tous remplacés par api-server)
  - supprimer : commands::numbering_next_quote, commands::numbering_next_invoice (remplacés par POST /api/numbering/next)
  - supprimer : commands::update_workspace, commands::get_workspace (remplacés par /api/workspace)
  - supprimer : commands::get_signature_events, commands::append_signature_event (remplacés par /api/signature-events)
  - conserver : sign_document, verify_signature, store_signed_pdf, get_signed_pdf, generate_cert, get_cert_info, rotate_cert, render_pdf, open_email_draft, open_mailto_fallback, build_workspace_zip, is_setup_completed, complete_setup, check_claude_cli, spawn_claude, ping, get_version

apps/desktop/src-tauri/src/commands/cycle.rs
  - supprimer les stubs : mark_quote_invoiced, mark_invoice_sent, update_invoice, delete_invoice, numbering_next_quote, numbering_next_invoice
  - conserver : is_setup_completed, complete_setup (keychain setup flag — local au process)
  - fichier peut être renommé setup.rs après nettoyage (optionnel)

apps/desktop/src-tauri/src/commands/workspace.rs
  - supprimer get_workspace, update_workspace (remplacés par api-server) — ou supprimer le fichier si vide

apps/desktop/src-tauri/src/commands/signatures.rs
  - supprimer get_signature_events, append_signature_event (remplacés par api-server) — conserver sign_document, verify_signature, store_signed_pdf, get_signed_pdf

apps/desktop/src-tauri/capabilities/default.json
  - permissions: ["fs:default", "fs:allow-write-text-file", "fs:allow-create-dir", "path:default", "dialog:default", "dialog:allow-save", "shell:default", "shell:allow-open"]
  - scope: fs allow uniquement sous $TEMP et $APPDATA (jamais le filesystem entier — principe de moindre privilège)

apps/desktop/src/features/*/PrepareEmailModal.tsx
  (vérifier que les invoke plugin:fs continuent de fonctionner avec les permissions ajoutées, fix chemin Windows quoté si pas déjà fait)
```

### DoD

- [ ] `cargo check --locked` passe dans `apps/desktop/src-tauri/`.
- [ ] `bun run tauri:dev` démarre sans warning manquant plugin.
- [ ] Scenario manuel email draft : ouvrir modal → bouton « Préparer l'email » → .eml créé dans temp, client mail s'ouvre (plus de crash silencieux).
- [ ] Scenario manuel archive ZIP : bouton export → dialog save apparaît → sélectionner dossier → ZIP produit avec contenu correct.
- [ ] Scenario manuel Windows : nom d'utilisateur avec espace (ex: `C:\Users\Jean Dupont\`) → email draft + archive ZIP fonctionnent.
- [ ] `grep -r "mark_quote_invoiced\|mark_invoice_sent\|numbering_next_quote" apps/desktop/src-tauri/` retourne 0 match.
- [ ] Aucune régression : `bun run typecheck && cargo test` verts.

### Commit message template

```
refactor(refacto-ζ): plugins Tauri fs/path/dialog + suppression stubs cycle.rs

- Cargo.toml : + tauri-plugin-fs, tauri-plugin-dialog (path fourni par tauri v2 natif).
- lib.rs : init plugins, supprime commands cycle.rs stubs (mark_quote_invoiced, mark_invoice_sent, update_invoice, delete_invoice, numbering_next_*, get/update_workspace, get/append_signature_event).
- capabilities/default.json : permissions fs/dialog scopées $TEMP + $APPDATA (least-privilege).
- cycle.rs : nettoyé — conserve uniquement is_setup_completed + complete_setup (flag keychain local).
- workspace.rs, signatures.rs : conservent uniquement les routines crypto/PDF locales, le reste passe par api-server.

Fix runtime crashes identifiés dans e2e-wiring-audit.md sections 7-8 (email draft + archive ZIP).

Signed-off-by: <agent name>
```

---

## Track η — signature fixes : hash TSA + persistance SQLite + mismatch CertInfo + test file

**Durée estimée** : 5-7h agent.
**Dépendances upstream** : aucune (travaille sur commands Rust signature indépendamment).
**Bloque** : gate 1 Tom (validation Adobe Reader) + audit_trail persistant post-ε (via POST /api/signature-events).

### Objectifs

Corriger les 4 bugs identifiés `e2e-wiring-audit.md` section 6 :

1. Hash TSA non conforme RFC 3161.
2. Audit trail en RAM perdu au redémarrage → bascule vers POST /api/signature-events via reqwest.
3. Fichier test `signed_pades_b_t_freetsa.pdf` inexistant.
4. Mismatch CertInfo TS ↔ Rust.

### Fichiers à modifier

```
apps/desktop/src-tauri/src/commands/signatures.rs
  - fix hash TSA : currently `sha256(cms_der)`, doit être `sha256(SignerInfo.signature BIT STRING)` (commentaire présent lignes 347-356)
  - après sign successful : poster l'event via reqwest vers http://localhost:PORT/api/signature-events avec X-FAKT-Token, au lieu de push dans AppState Mutex<Vec>
  - poster également les métadonnées signed-document vers /api/signed-documents
  - poster la transition quote → mark-signed via /api/quotes/:id/mark-signed

apps/desktop/src-tauri/src/commands/state.rs
  - supprimer Mutex<Vec<SignatureEvent>> si utilisé pour audit trail (persistance bascule sur SQLite via api-server)
  - conserver la partie numbering atomique temporaire (peut être supprimée si le stub Drizzle suffit en v0.1)

apps/desktop/src-tauri/src/crypto/mod.rs
  - uniformiser CertInfo avec les noms TS attendus (subject_dn, fingerprint_sha256, not_before) ou côté TS (CertificatTab.tsx) uniformiser vers noms Rust actuels (subject_cn, fingerprint_sha256_hex, not_before_iso). Décision PM : garder les noms RUST existants (Serde rename_all camelCase → "subjectCn", "fingerprintSha256Hex", "notBeforeIso") et adapter côté TS. Moins de churn crypto/sécurité.

apps/desktop/src/features/cert/types.ts
  - mettre à jour interface CertInfo : { subjectCn, fingerprintSha256Hex, notBeforeIso } (camelCase TS du rename_all Rust)

apps/desktop/src/features/cert/tabs/CertificatTab.tsx
  - renommer accès aux champs pour utiliser nouveaux noms

apps/desktop/src-tauri/tests/signature_freetsa.rs (ou chemin équivalent)
  - retirer #[ignore] du test qui génère signed_pades_b_t_freetsa.pdf
  - le test produit le fichier dans apps/desktop/tests/fixtures/signed_pades_b_t_freetsa.pdf
  - commit le fichier OU documenter dans README qu'il est produit par `cargo test signature_freetsa --release`

apps/desktop/src-tauri/src/state.rs
  - retirer la table signature_events rusqlite native (si elle existait), tout passe par api-server maintenant
```

### Gap DB additionnel

**Aucun côté schéma** — la table `signature_events` existe déjà (cf `packages/db/src/schema/index.ts:216`). La persistance passe par `POST /api/signature-events` (track γ implémente l'endpoint).

### DoD

- [ ] `cargo test` vert dans `apps/desktop/src-tauri/`, y compris nouveau test de hash TSA.
- [ ] Nouveau test : `cargo test signature_freetsa --release` produit le fichier `apps/desktop/tests/fixtures/signed_pades_b_t_freetsa.pdf` (taille > 0, contient le CMS PAdES).
- [ ] Validation manuelle Tom (gate 1) : ouvrir `signed_pades_b_t_freetsa.pdf` dans Adobe Reader desktop → affichage : signature verte valide + timestamp visible dans panneau Signatures.
- [ ] Unit test : audit chain hash de 2 events consécutifs vérifie SHA-256(serialize(prev)) = current.previousEventHash.
- [ ] CertInfo tab affiche `subjectCn`, `fingerprintSha256Hex`, `notBeforeIso` sans undefined (au lieu des anciens undefined).
- [ ] Un redémarrage de l'app préserve l'audit trail : signer un devis, quit, restart, ouvrir la route Verify → events apparaissent.
- [ ] Aucun match `grep "Mutex<Vec<SignatureEvent>>" apps/desktop/src-tauri/src/`.

### Commit message template

```
fix(refacto-η): hash TSA RFC 3161 + persistance audit trail SQLite + CertInfo mismatch + test signed PDF

1. Hash TSA : sha256(SignerInfo.signature BIT STRING) — RFC 3161 §2.5.
   Fix des rejets potentiels Adobe Reader (cf commentaire signatures.rs:347-356).

2. Audit trail : persistance via POST /api/signature-events (sidecar api-server) au lieu de
   Mutex<Vec> RAM. Events survivent au redémarrage.

3. CertInfo : uniformise vers camelCase Rust Serde (subjectCn, fingerprintSha256Hex,
   notBeforeIso) côté TS. CertificatTab plus de undefined.

4. Test fixture : retire #[ignore] sur signature_freetsa, produit apps/desktop/tests/fixtures/
   signed_pades_b_t_freetsa.pdf pour gate 1 Tom (validation Adobe Reader).

Nettoie state.rs : supprime l'ancien Mutex audit trail, tout passe par SQLite + api-server.

Refs : docs/sprint-notes/e2e-wiring-audit.md section 6 (signature dettes v0.1.1).

Signed-off-by: <agent name>
```

---

## Track θ — migration payment_notes + NFR-003 docs + dettes mineures

**Durée estimée** : 3-4h agent.
**Dépendances upstream** : aucune.
**Bloque** : rien directement — track γ utilisera la migration si livrée avant.

### Objectifs

1. Ajouter la colonne `payment_notes` dans table `invoices` via nouvelle migration Drizzle.
2. Mettre à jour README + CHANGELOG + architecture.md pour refléter NFR-003 (~100 MB) et refacto sidecar.
3. Nettoyer dettes mineures :
   - Prestations passées `[]` en dur à `buildPrestationsCsv` dans l'archive ZIP.
   - Event `email_drafted` jamais inséré dans activity (câbler via POST /api/activity côté frontend après email draft réussi).
   - Fix chemin Windows non quoté dans `cmd /C start "" <path>` (`e2e-wiring-audit.md` section 7).
   - Landing NFR-003 si mention de 15 MB encore présente.

### Fichiers à créer

```
packages/db/migrations/0002_payment_notes.sql   (new)
  ALTER TABLE invoices ADD COLUMN payment_notes TEXT;

packages/db/src/schema/index.ts                 (modif — ajouter paymentNotes: text("payment_notes") dans table invoices)
packages/shared/src/types.ts (ou équivalent)    (modif — ajouter paymentNotes?: string | null dans Invoice type)
packages/db/src/queries/invoices.ts             (modif — rowToInvoice mappe paymentNotes, markInvoicePaid accepte 4ème param notes?, upsertItems inchangé)
```

### Fichiers à modifier

```
README.md
  - Section Installation : NFR-003 précise ~100 MB (au lieu de 15 MB si mentionné)
  - Section Architecture : schéma 3 modes (solo/self-host/SaaS) + mention sidecar Bun
  - Section Contributing : noter les 55 endpoints api-server + 11 commandes Tauri Rust

CHANGELOG.md
  - Section [0.1.0] :
    * Added : api-server sidecar, 55 endpoints REST, colonne payment_notes, activity feed live
    * Changed : taille installer ~100 MB (sidecar Bun bundlé), architecture 3 modes documentée
    * Fixed : hash TSA RFC 3161, audit trail persistant, mismatch CertInfo, Windows path quoting
    * Known issues : port Rust sidecar prévu v0.2 pour réduire à ~20 MB

docs/architecture.md
  - Schéma ASCII des 3 modes (solo local SQLite, self-host VPS Postgres, SaaS fakt.com)
  - Section sidecar : startup sequence, port discovery, token injection
  - Section data flow : hook React → fetch api-server → Drizzle → SQLite

apps/landing/src/... (si pages-content contient 15 MB / Rust pur)
  - Remplacer par message actualisé

apps/desktop/src-tauri/src/commands/email.rs (si c'est là qu'est le cmd start non quoté)
  - Quote le chemin : cmd /C start "" "<quoted_path>" au lieu de <path> brut

apps/desktop/src-tauri/src/commands/backup.rs (build_workspace_zip)
  - Appelle POST /api/backups en fin d'export pour peupler la table backups
  - Récupère la liste des prestations via GET /api/services pour le CSV (au lieu de [] en dur)
```

### DoD

- [ ] `bun run migrate` applique 0002_payment_notes.sql sans erreur sur une DB fraîche + une DB existante.
- [ ] `bun run test` vert : nouveau test `markInvoicePaid(db, id, paidAt, method, "notes")` persiste et relit notes.
- [ ] README mentionne « sidecar Bun » et taille ~100 MB ; plus aucune référence à 15 MB.
- [ ] CHANGELOG 0.1.0 section Added/Changed/Fixed/Known issues complète.
- [ ] architecture.md contient schéma ASCII des 3 modes.
- [ ] Test manuel : export archive ZIP → CSV prestations contient vraies prestations (plus de CSV vide).
- [ ] Test manuel Windows : utilisateur avec espace dans le nom → email draft fonctionne.

### Commit message template

```
chore(refacto-θ): migration payment_notes + NFR-003 docs + dettes mineures

- packages/db/migrations/0002_payment_notes.sql : ALTER invoices ADD COLUMN payment_notes.
- Schema + Invoice type + markInvoicePaid étendus.
- README : NFR-003 ~100 MB justifié, schéma 3 modes documenté.
- CHANGELOG 0.1.0 : Added/Changed/Fixed/Known issues complets.
- docs/architecture.md : schéma ASCII modes solo/self-host/SaaS + startup sequence sidecar.
- backup.rs : peuple table backups via POST /api/backups, CSV prestations via GET /api/services.
- email.rs : quote le chemin cmd /C start "" <path> (fix Windows user space).

Refs : docs/sprint-notes/e2e-wiring-audit.md sections 4, 7, 8.

Signed-off-by: <agent name>
```

---

## Matrice des fichiers par track (validation zéro-overlap)

Vérification mécanique qu'aucun fichier n'est modifié par deux tracks en écriture (seul cas autorisé : index/barrel `queries/index.ts` en mode append-only via merge git).

| Fichier / Dossier | Track |
|---|---|
| `packages/api-server/` (tout le dossier créé) | α, β, γ (disjoints par sous-dossier : routes/workspace, routes/clients → α ; routes/services, routes/quotes → β ; routes/invoices, routes/activity, etc. → γ) |
| `packages/db/src/queries/settings.ts` | α (createWorkspace) |
| `packages/db/src/queries/clients.ts` | α (restoreClient) |
| `packages/db/src/queries/prestations.ts` | β (restorePrestation) |
| `packages/db/src/queries/invoices.ts` | γ + θ (γ ajoute deleteInvoice/updateInvoiceStatus/etc., θ étend markInvoicePaid avec notes → coordination : θ livre en premier, γ rebase) |
| `packages/db/src/queries/activity.ts` | γ (nouveau fichier) |
| `packages/db/src/queries/signed-documents.ts` | γ (nouveau) |
| `packages/db/src/queries/backups.ts` | γ (nouveau) |
| `packages/db/src/queries/index.ts` | α + β + γ (append-only barrel, merge trivial) |
| `packages/db/src/schema/index.ts` | θ (paymentNotes) |
| `packages/db/migrations/0002_payment_notes.sql` | θ |
| `packages/shared/src/types.ts` | θ (paymentNotes) |
| `apps/desktop/src-tauri/Cargo.toml` | δ (sidecar binaries) + ζ (plugins fs/dialog) → disjoints : δ ajoute `rand`, ζ ajoute `tauri-plugin-fs/dialog`. Merge OK. |
| `apps/desktop/src-tauri/src/lib.rs` | δ + ζ + η → ζ prend les suppressions, δ ajoute le spawn, η n'a besoin de rien (travaille dans commands/signatures.rs). **Ordre** : δ → ζ → η pour éviter les conflits triviaux. |
| `apps/desktop/src-tauri/src/sidecar.rs` | δ (nouveau) |
| `apps/desktop/src-tauri/src/commands/cycle.rs` | ζ (suppressions) |
| `apps/desktop/src-tauri/src/commands/workspace.rs` | ζ (suppressions) |
| `apps/desktop/src-tauri/src/commands/signatures.rs` | η (fix TSA hash + POST api-server) |
| `apps/desktop/src-tauri/src/commands/state.rs` | η (nettoyage Mutex audit) |
| `apps/desktop/src-tauri/src/commands/email.rs` | θ (Windows path quoting) |
| `apps/desktop/src-tauri/src/commands/backup.rs` | θ (POST /api/backups + GET /api/services pour CSV) |
| `apps/desktop/src-tauri/src/crypto/mod.rs` | η (CertInfo rename serde) |
| `apps/desktop/src-tauri/capabilities/default.json` | ζ |
| `apps/desktop/src-tauri/tauri.conf.json` | δ |
| `apps/desktop/src-tauri/binaries/` | δ (nouveau dossier) |
| `apps/desktop/src/hooks/useClients.ts` | ε |
| `apps/desktop/src/hooks/usePrestations.ts` | ε |
| `apps/desktop/src/features/doc-editor/*-api.ts` | ε (tous) |
| `apps/desktop/src/features/onboarding/RecapStep.tsx` | ε |
| `apps/desktop/src/features/cert/tabs/CertificatTab.tsx` | η (rename fields — **coordination avec ε** : η livre le renommage serde, ε consomme les nouveaux noms dans le refacto api-client) |
| `apps/desktop/src/features/cert/types.ts` | η |
| `apps/desktop/src/api/` (nouveau dossier) | ε |
| `apps/desktop/src-tauri/tests/signature_freetsa.rs` | η |
| `scripts/build-sidecar.ts` | δ |
| `.github/workflows/release-desktop.yml` | δ |
| `README.md` | θ |
| `CHANGELOG.md` | θ |
| `docs/architecture.md` | θ |
| `package.json` (root) | α (add api-server workspace) + δ (script prebuild sidecar) → merge trivial |

### Points de coordination explicites

1. **θ doit livrer avant γ** pour que la migration `0002_payment_notes.sql` soit dispo quand γ étend `markInvoicePaid`. Si θ n'est pas livré à temps, γ peut ajouter un TODO et livrer sans le champ `notes`.
2. **η doit livrer son refacto CertInfo avant ε** pour que les nouveaux noms camelCase (subjectCn, etc.) soient consommés dans le refacto api-client. Si η bloque, ε peut livrer avec TODO sur CertificatTab et η ferme le gap dans son propre commit.
3. **δ doit livrer avant ε** pour que `window.__FAKT_API_PORT` / `__FAKT_API_TOKEN` soient injectés — sinon `api-client.ts` ne peut pas instancier le baseURL.
4. **α doit livrer avant β + γ** pour que le scaffold Hono + middlewares + tests helpers soient partagés.

### Dépendances à ajouter au package.json root

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

`packages/api-server` suit la convention : `"dependencies": { "@fakt/db": "workspace:*", "@fakt/shared": "workspace:*", "@fakt/core": "workspace:*", "hono": "^4", "zod": "^3" }`.

---

## Récap par wave + checkpoints

### Wave 1 (parallèle immédiat)

- **Agent 1** : Track α
- **Agent 2** : Track δ
- **Agent 3** : Track ζ
- **Agent 4** : Track η
- **Agent 5** : Track θ

**Checkpoint après Wave 1** : `bun run typecheck && bun run test && bun run build && cargo check --locked` verts. Commit logs montrent 5 commits atomiques `refacto-α/δ/ζ/η/θ`.

### Wave 2 (après α livré)

- **Agent 6** : Track β
- **Agent 7** : Track γ

**Checkpoint après Wave 2** : 7 commits cumulés. Les 55 endpoints REST sont tous implémentés et testés côté serveur. Mais le frontend appelle encore `invoke` → l'app ne marche pas encore end-to-end.

### Wave 3 (après α + β + γ + δ livrés)

- **Agent 8** : Track ε

**Checkpoint final** : 8 commits, `bun run tauri:dev` end-to-end fonctionne. Onboarding complet, CRUD métier persistent, signature PAdES persistée, email + archive ZIP OK. Tag `v0.1.0` possible.

---

## Métriques cibles

- **Lignes de code ajoutées** estimation : ~8000 TS (api-server 5000, api client 1500, tests 1500) + ~500 Rust (sidecar spawn) + ~200 SQL (migrations).
- **Tests ajoutés** : ≥ 80 (15 α + 20 β + 40 γ + 5 ε).
- **Coverage post-refacto** : ≥ 75% sur `packages/api-server/` (> seuil legal 70%).
- **Durée totale sequentielle** : 8 × ~5h = ~40h. En parallèle Wave 1+2+3 : ~15-20h wall-clock.
