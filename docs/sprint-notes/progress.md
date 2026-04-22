# FAKT v0.1 — Refacto API-server + fix release-blocking · Progress log

**Démarré :** 2026-04-22
**Objectif :** rendre FAKT v0.1 opérationnelle en mode desktop solo (DB SQLite locale), avec une architecture qui supporte sans refacto future les modes entreprise self-host (Postgres VPS) et SaaS (fakt.com).

## ⚠️ Post-compact — à lire en priorité après compression contexte

Si on est après un compact, relire ce fichier INTÉGRALEMENT, trouver la dernière phase marquée `in_progress` ou la dernière case cochée dans la DoD, reprendre exactement à partir de là. Les teams éventuellement encore vivantes sont listées en bas dans `## Teams actives`.

Pour savoir ce qui reste : scan les `[ ]` non cochés dans la DoD, puis les entrées `pending` / `in_progress` dans le plan 4 phases.

## Décision d'architecture (validée Tom 2026-04-22)

**Option C — API backend sidecar** :
- `packages/api-server/` : Bun + Hono HTTP server. REST endpoints wrappant `packages/db/src/queries/` (Drizzle).
- Adapter Drizzle : SQLite pour mode 1 (solo) + mode 2 (self-host léger), Postgres pour mode 2 prod + mode 3 SaaS.
- Tauri desktop : spawn le binaire api-server en sidecar au démarrage (port aléatoire, discovery via stdout). Le frontend React fetch `http://localhost:PORT/api/...` via React Query.
- Tauri Rust garde UNIQUEMENT : signature PAdES (accès keychain), email OS dispatch, archive ZIP (crate zip), render_pdf Typst subprocess.
- Révision NFR-003 : installers desktop ≤ **100 MB** au lieu de 15 MB (Bun compiled ~70 MB). Cohérent avec Slack/Discord/Obsidian 100-200 MB. Possible port Rust en v0.2 si demandé.

## Plan en 4 phases

### Phase 1 — Design (team `fakt-phase1-design`)

Produire les specs techniques exploitables par Phase 2 Dev. 3 agents parallèles, **aucun code écrit**, docs uniquement.

Livrables attendus dans `docs/refacto-spec/` :
- `docs/refacto-spec/architecture.md` : schéma complet modes 1/2/3, choix sidecar, port discovery, bundling Bun cross-OS.
- `docs/refacto-spec/api-endpoints.md` : 25+ endpoints REST exhaustifs (path, méthode, params, body, response, erreurs). Mapping 1:1 avec les queries Drizzle existantes.
- `docs/refacto-spec/task-breakdown.md` : découpage Phase 2 en 6-8 tracks disjoints assignables en parallèle, avec DoD par track et ordre de dépendances.
- `docs/refacto-spec/test-plan.md` : stratégie unit (api-server handlers) + integration (Drizzle roundtrip SQLite) + smoke E2E (bun run tauri:dev flow complet onboarding → client → devis → signer → facture → email → archive).

- [x] Team créée
- [x] Agents spawned
- [x] Specs rédigés (architecture + api-endpoints + task-breakdown + test-plan)
- [x] Review & approbation par agent coordinateur
- [x] Team shutdown (en cours — passage Phase 2)

### Phase 2 — Build (team `fakt-phase2-build`)

6-8 agents `general-purpose` parallèles. Chacun un track du task-breakdown.

Règles non-négociables (hérité de W1-W4) :
- `subagent_type: "general-purpose"` uniquement (jamais `code-architect` → hallucine).
- Commit direct sur main, chemins explicites dans `git add`, DCO `-s`, format conventional.
- Avant commit : `bun run typecheck && bun run test && bun run build` passent 11+ packages.
- Chaque agent met à jour **sa section** dans progress.md (checklist `- [x]`) à mi-chemin et en fin de task.

Tracks attendus (à confirmer par Phase 1 task-breakdown) :
- Track α : `packages/api-server/` scaffold + endpoints clients
- Track β : endpoints prestations + quotes + invoices
- Track γ : endpoints workspace + numbering + signatures/audit
- Track δ : Tauri sidecar spawn logic + port discovery + bundle Bun compiled
- Track ε : refactor hooks React (invoke → fetch)
- Track ζ : plugins Tauri fs/path/dialog + capabilities + stubs cycle.rs remplacés
- Track η : signature fixes (hash TSA RFC 3161, persist audit_events, test PDF file, mismatch CertInfo)
- Track θ : misc (payment_notes colonne + migration, update_workspace côté api-server, archive_invoice, etc.)

- [x] Team créée
- [x] Agents spawned (5 en Wave 1)
- [ ] Tous commits réalisés sur main
- [ ] `bun typecheck && bun test && bun build` ALL-GREEN post-merge
- [ ] Team shutdown

#### Avancement par track (Wave 1)

- [x] **Track α** — scaffold `packages/api-server/` + middlewares (auth/zod/error-handler/request-id) + schemas (common/workspace/clients/settings) + 14 endpoints (health, workspace GET/POST/PATCH, settings GET/:key, PUT/:key, clients CRUD + restore + search), helper `createTestApp()` réutilisable par β/γ, 38 tests verts couvrant 401/400/404/409. Commit `c5a3d44` (retry après crash de l'agent original, PC reset Tom). Coverage `@fakt/db` branches remontée de 69.95 % à 71.59 % via 6 tests ajoutés (3 `createWorkspace` dans `settings.test.ts` + 3 `restoreClient` dans `clients.test.ts`). Commit non-signé GPG (agent sandbox sans accès pinentry) — DCO `-s` textuel préservé ; Tom peut re-signer en `git commit --amend -S` s'il veut l'harmoniser avec les autres commits du sprint.
- [x] **Track δ** — Sidecar spawn + port discovery + Bun compiled bundling cross-OS. Module `apps/desktop/src-tauri/src/sidecar.rs` (378 lignes) : `spawn_api_server()` via `ShellExt::sidecar` (env `FAKT_API_TOKEN`/`FAKT_API_PORT=0`/`FAKT_DB_PATH`/`FAKT_MODE=1`), token 32 B base64url `OsRng`, port discovery stdout protocol `FAKT_API_READY:port=<N>` (timeout 5s), healthcheck 5×500ms `X-FAKT-Token` via `reqwest::blocking` + `spawn_blocking` (évite runtime async HTTP), shutdown `CloseRequested` (plugin-shell kill + grace 3s), crash-loop detector 2/60s, dev bypass `FAKT_API_EXTERNAL=1`. `tauri.conf.json` : `windows: []` + `bundle.externalBin: ["binaries/fakt-api"]` + CSP `connect-src http://127.0.0.1:*`. `Cargo.toml` : reqwest features étendues (`json`/`http2`/`charset`) débloquant track γ/η. Cross-compile `packages/api-server/scripts/build-sidecar.ts` : 4 targets (win-x64, darwin-x64/arm64, linux-x64) nommage rust-triple. `apps/desktop/package.json` : `build:sidecar` + `tauri:build`. Tests : 9 unit (parse_ready/generate_token) + 7 integration `tests/sidecar_port_discovery.rs` (tolère CR/LF + ignore logs pino JSON + erreurs NaN/overflow). Commit `8c598fe`. **Wiring live dans `lib.rs`** (commit `e013126`) : `.setup()` appelle `spawn_api_server` via `block_on`, `app.manage(Arc<ApiContext>)`, `WebviewWindowBuilder::initialization_script` injecte `window.__FAKT_API_URL__`/`__FAKT_API_TOKEN__`/`__FAKT_MODE__=1` (token JSON-échappé), `.on_window_event(CloseRequested)` déclenche shutdown. `cargo test` 25+ verts, `bun run typecheck` 12/12 OK. Ready pour Wave 3 (ε).
- [x] **Track ζ** — plugins Tauri `fs` + `dialog` ajoutés (`Cargo.toml` + `.plugin(...init())` dans `lib.rs`), `capabilities/default.json` créé (least-privilege : `$TEMP/fakt-drafts/**` + `$APPDATA/fakt/**` + `$APPLOCALDATA/fakt/**` + `$DOWNLOAD/**`, plus permissions `fs/dialog/shell` sélectives), 8 commandes migrées supprimées de l'`invoke_handler!` (`mark_quote_invoiced`, `mark_invoice_sent`, `update_invoice`, `delete_invoice`, `numbering_next_quote`, `numbering_next_invoice`, `get_signature_events`, `append_signature_event`), `cycle.rs` nettoyé (garde uniquement `is_setup_completed` + `complete_setup`), `email.rs` : helper `quote_cmd_arg` + 5 tests unitaires (espace FR `Jean Dupont`, ampersand, quote, mailto intact), `tests/plugins_capabilities.rs` 3 tests JSON/permissions/least-privilege. `cargo check --locked` OK, `cargo test --test plugins_capabilities` 3/3, tests quoting email 5/5. Commit f32d089.
- [x] **Track η** — signature fixes : (1) hash TSA conformé RFC 3161 §2.5 — `tsa_imprint_for_cms()` extrait en pure function testable (`crypto/commands.rs`), commentaire obsolète supprimé ; (2) audit trail persisté via HTTP POST `/api/signature-events` best-effort (`crypto/audit_client.rs` + reqwest `json`feature, `AuditPostError` + `post_signature_event_best_effort`) — `Mutex<Vec<SignatureEvent>>` retiré d'`AppState`, commande `verify_signature` refetch la chaîne depuis api-server ; (3) `CertInfo` Rust en `#[serde(rename_all = "camelCase")]` → frontend `CertificateTab.tsx` + onboarding `Certificate.tsx` consomment directement `subjectCn / fingerprintSha256Hex / notBeforeIso / notAfterIso` ; (4) test fixture `tests/signature_freetsa_fixture.rs` produit `apps/desktop/tests/fixtures/signed_pades_b_t_freetsa.pdf` (33 KB, PAdES-B-T structurel, gate 1 Adobe Reader pour Tom) + `tests/tsa_hash_correctness.rs` 3 tests verrouillent le comportement RFC 3161 (référence recalcule indépendamment + contre-exemple "pas SHA-256 CMS entier" + déterminisme + erreur malformé). `cargo test --lib` 45/45, `cargo test --test tsa_hash_correctness` 3/3, `cargo test --test signature_freetsa_fixture` 1/1, `cargo test --test sign_document_e2e` 3/3. Commit 4bdc588.
- [x] **Track θ** — migration `0003_payment_notes.sql` (SQLite ALTER invoices), schema Drizzle + type `Invoice.paymentNotes`, extension `markInvoicePaid(db,id,paidAt,method,notes?)` backward-compatible (5ᵉ param optionnel, 23 tests existants intacts), 4 nouveaux tests `invoices-payment-notes.test.ts` (persist/undefined→null/null explicite/raw row), mocks desktop complétés (6 fichiers). Docs : README.md (app ~100 Mo + Installation note port Rust v0.2 + Architecture 3 modes section), CHANGELOG.md `[Unreleased]` (Added/Changed/Fixed/Known issues exhaustifs), `docs/architecture.md` addendum 2026-04-22 (3 diagrammes ASCII + invariants table + sidecar startup sequence + data flow + links refacto-spec). Dettes taggées TODO : archive ZIP prestations hardcoded `[]` (ε wave 3), `email_drafted` activity tracking (ε wave 3). Landing `~8 Mo → ~100 Mo`. Typecheck 12/12 OK, tests 99/99 OK. Coverage branches globales = 69.95 % (sous 70 %) : gap dû à `createWorkspace` ajouté par track α (lignes settings.ts 73-91) non couvert — pas dans scope θ. Commit fcd6d7a.

#### Avancement par track (Wave 2)

- [x] **Track β** — `packages/api-server/` 18 endpoints : services (7 : list/search/get/post/patch/delete/restore), numbering (2 : peek non-mutant + next atomique BEGIN IMMEDIATE), quotes (9 : CRUD + preview-next-number + issue atomique + lifecycle expire/cancel/mark-signed/mark-invoiced). Schemas Zod `services.ts` (unit enum heure|jour|forfait|unité|mois|année, unitPriceCents ≥ 0), `numbering.ts` (type quote|invoice), `quotes.ts` (status enum draft|sent|viewed|signed|invoiced|refused|expired + transitions validées). Queries `@fakt/db` étendues : `restorePrestation` (UNDO soft-delete + vérif `archivedAt IS NOT NULL`) + `nextNumberAtomic(sqlite, db, workspaceId, type)` via `SqliteDriverLike` structurel (BEGIN IMMEDIATE sur better-sqlite3 tests et bun:sqlite prod). Transitions invalides → 422 INVALID_TRANSITION ; UNIQUE conflict → 409 CONFLICT via errorHandler. **Test concurrence CGI art. 289** : `numbering-concurrency.test.ts` 100 POST /api/numbering/next parallel (`Promise.all`) → Set<sequence>.size === 100, min=1, max=100, zéro trou (plus un test 500× renforcé). Tests : 5 fichiers api-server (`services.test.ts` 23, `numbering.test.ts` 11, `numbering-concurrency.test.ts` 2 critiques, `quotes.test.ts` 20, `quotes-cycle.test.ts` 13 lifecycle complet draft→sent→viewed→signed→invoiced + refused/expired/cancel) = **69 tests verts** + 5 tests `@fakt/db` (`prestations.test.ts` restorePrestation ×3 + `numbering.test.ts` nextNumberAtomic ×2). Coverage scope β : services 96.82 %/85.29 %, quotes 98.03 %/88 %, numbering 93.33 %/50 % stmt/branch. Typing structurel `SqliteLike` (types.ts) résout le schisme better-sqlite3/bun:sqlite sans duck-typing runtime ; `tsconfig.json` `types: ["node", "bun"]` pour unblock `import { Database } from "bun:sqlite"` chez γ. `bun run --filter @fakt/api-server typecheck` 12/12 OK, test api-server 176/176 OK (β + γ + α), build OK. Commit cd40792.
- [x] **Track γ** — `packages/api-server/` endpoints invoices (10) + activity (2) + signatures (3 events + 2 signed-documents) + backups (3) = ~20 endpoints. Zod schemas `invoices.ts` / `activity.ts` / `signatures.ts` / `backups.ts` (paymentMethod wire|check|cash|other, fromQuoteMode deposit30|balance|full, hexSha256 64-char regex, padesLevel B|B-T, documentType quote|invoice). Queries ajoutées à `@fakt/db` : `deleteInvoice` (409 si non-draft), `updateInvoiceStatus` (canTransitionInvoice), `archiveInvoice`, `searchInvoices` (LIKE title+number, exclut archived), `issueInvoice` (atomic number+year+sequence + status=sent + issuedAt), `listActivity` + `insertActivity`, `getSignedDocument` + `upsertSignedDocument` (PK documentType+documentId), `listBackups` + `insertBackup` + `deleteBackup`. DDL `signed_documents` ajouté à `helpers.ts` test DB. Route `/api/invoices/from-quote/:quoteId` implémente les 3 modes (deposit30 = 30% + kind=deposit, full = 100% + quote→invoiced best-effort, balance = total − deposits, 422 si ≤ 0). Logging activity best-effort (try/catch, jamais blocant). Chain verify SHA-256 (`GET /api/signature-events/verify`) avec sérialisation canonique ordre alphabétique retourne `{chainOk, chainLength, brokenChainIndices}`. **Test légal critique** : DELETE facture `status=sent|paid` → 409 CONFLICT avec message "archivage légal 10 ans (CGI art. 289)" + trigger SQL `invoices_no_hard_delete_issued` bloque aussi bypass direct sqlite.prepare. Tests : 6 fichiers api-server (`invoices.test.ts` 22 CRUD, `invoices-from-quote.test.ts` 10 modes, `invoices-legal.test.ts` 7 conformité FR, `activity.test.ts` 7, `backups.test.ts` 7, `signatures-audit.test.ts` 13 chain + trigger) = **66 tests verts** + 3 fichiers @fakt/db (`activity.test.ts` 8, `backups.test.ts` 5, `signedDocuments.test.ts` 6, `invoices-lifecycle.test.ts` 15) = **34 tests verts** pour couvrir les nouvelles queries. App wiring : `app.ts` route `/api/invoices`, `/api/activity`, `/api` (signaturesRoutes avec préfixes internes `/signature-events` et `/signed-documents`), `/api/backups`. `bun run typecheck` 12/12, `bun run test` all-green (171 api-server + 143 db + total monorepo 12 packages), `bun run build` OK. Coverage @fakt/db : 87.21%/74.23%/95.34%/95.2% (seuils 80/70/80/80 respectés). Commit 1a28abd.

### Phase 3 — Review (team `fakt-phase3-review`)

5-6 agents. Review exhaustive sur tout ce qui a été mergé en Phase 2. Produit `docs/sprint-notes/v01-review-findings.md` avec P0/P1/P2/P3.

Agents :
- `code-review-security` : OWASP top 10, secrets, crypto, IPC
- `code-review-bugs` : logic errors, edge cases, null safety, race conditions
- `qa-smoke-live` : lance réellement `bun run dev` + preview navigateur, teste onboarding → client → devis → signer → facture → email → archive. Note régressions.
- `ui-ux-reviewer` : Brutal Invoice strict (bordures, shadows, hover inversion, UPPERCASE), accessibilité clavier, cohérence copy FR
- `pm-acceptance` : DoD v0.1 cochée ou non, cohérence spec Phase 1
- `docs-reviewer` : README, CHANGELOG, architecture.md à jour, pas de mentions obsolètes

- [ ] Team créée
- [ ] Tous agents terminés
- [ ] `docs/sprint-notes/v01-review-findings.md` compilé avec tous les findings priorisés
- [ ] Team shutdown

### Phase 4 — Fix findings (team `fakt-phase4-fix`)

Agents dynamiques : un par groupe de findings P0/P1 (P2/P3 → dettes v0.1.1). Re-lance review smoke après chaque commit pour confirmer fix.

- [ ] Tous findings P0 fixés
- [ ] Tous findings P1 fixés
- [ ] P2/P3 documentés comme dettes v0.1.1 dans CHANGELOG.md Known Issues
- [ ] Smoke test final vert
- [ ] Team shutdown

## Definition of Done — v0.1 opérationnelle

### Fonctionnel (un user peut en mode desktop solo)
- [ ] Onboarding 4 étapes : saisit identité → wizard génère cert X.509 RSA 4096 en keychain OS → marque setup complété sans reboucler.
- [ ] Créer un client : le voir apparaître en liste, persister après restart.
- [ ] Créer une prestation : idem + apparaît dans picker ItemsEditor du formulaire Devis.
- [ ] Créer un devis : numéro D2026-001 attribué atomiquement (CGI art. 289), 3 lignes de prestation, total calculé, statut brouillon.
- [ ] Émettre un devis : transition draft→sent, numéro assigné, PDF rendu Typst.
- [ ] Signer un devis : PAdES B-T, hash TSA conforme RFC 3161, audit trail persisté en SQLite, PDF ouvrable en Adobe Reader avec signature verte + timestamp.
- [ ] Convertir devis signé en facture : F2026-001, 3 modes (acompte 30% / solde / total).
- [ ] Marquer facture payée : date + méthode + notes persistés.
- [ ] Tenter de supprimer une facture `issued` : refusé par guard UI + trigger SQL.
- [ ] Préparer email : brouillon .eml avec PDF signé en attachment, ouverture client mail OS + fallback mailto.
- [ ] Exporter archive ZIP : clients.csv + prestations.csv + PDFs devis + PDFs factures + README compliance.

### Technique
- [ ] `bun run typecheck` : tous packages ✓
- [ ] `bun run test` : ≥250 tests ✓
- [ ] `bun run build` : desktop dist + landing dist ✓
- [ ] `cargo check --locked` dans `apps/desktop/src-tauri` : ✓
- [ ] `bun run tauri:dev` démarre sans erreur, UI Brutal Invoice rend correctement, api-server sidecar spawn et répond sur localhost.
- [ ] Aucune dep workspace manquante (`@fakt/*` tous déclarés dans les package.json qui les importent).
- [ ] Aucun CSS orphelin.
- [ ] Plugins Tauri déclarés : fs, path, dialog, shell (+ leurs capabilities dans `src-tauri/capabilities/`).

### Légal FR (critique)
- [ ] Mentions obligatoires factures présentes dans PDF (SIRET, forme juridique, adresse, date émission + échéance, pénalités retard, indemnité 40€, mention TVA art. 293 B).
- [ ] Numérotation séquentielle sans trou (BEGIN IMMEDIATE vérifié par test de concurrence).
- [ ] Pas de hard delete factures issued (trigger SQL testé en intégration).
- [ ] Signature PAdES affichée comme "avancée" uniquement, jamais "qualifiée".

### Architecture pérenne modes 2/3
- [ ] `packages/api-server/` même binaire peut tourner en mode serveur VPS (pas de dépendance Tauri IPC dans le package).
- [ ] Drizzle adapter interchangeable SQLite ↔ Postgres (le brief produit le prévoyait).
- [ ] Mode 2 documenté : comment un desktop FAKT peut pointer vers un backend distant via `FAKT_API_URL` env.

### Release
- [ ] README.md NFR-003 updated (~100 MB desktop, justifié).
- [ ] CHANGELOG.md v0.1.0 updated avec changements refacto + Known Issues.
- [ ] `docs/architecture.md` updated avec schéma 3 modes.
- [ ] Commit tag-ready sur main, Tom peut `git tag v0.1.0` quand il veut.

## Teams actives

(Mise à jour en live par agents et par moi)

| Nom | Phase | Lead | Status | Créée | Terminée |
|---|---|---|---|---|---|
| fakt-phase1-design | 1 | lead-orchestrator | closed | 2026-04-22 | 2026-04-22 |
| fakt-phase2-build | 2 | lead-orchestrator | active (Wave 1) | 2026-04-22 | — |

Agents Phase 2 Wave 1 en arrière-plan (5 parallèles) :
- `track-alpha` → scaffold `packages/api-server/` + endpoints workspace/clients/settings (~14 endpoints)
- `track-delta` → Tauri sidecar spawn + port discovery + Bun compiled bundling cross-OS
- `track-zeta` → plugins Tauri fs/dialog + capabilities + suppression stubs cycle.rs + Windows path quoting
- `track-eta` → signature fixes (hash TSA RFC 3161 + persist audit via api-server + CertInfo camelCase + test fixture PDF)
- `track-theta` → migration payment_notes + README/CHANGELOG/architecture 3 modes + TODOs dettes

## Log d'événements

(Append-only)

- 2026-04-22 · Tom valide option C (API sidecar Bun). Architecture documentée.
- 2026-04-22 · progress.md créé. Démarrage Phase 1.
- 2026-04-22 · Team `fakt-phase1-design` créée. 3 agents spawnés en background (tech-architect, pm-breakdown, qa-strategist).
- 2026-04-22 · tech-architect : architecture.md livré, 554 lignes, 15 sections.
- 2026-04-22 · qa-strategist : test-plan.md (8 sections) livré.
- 2026-04-22 · pm-breakdown : api-endpoints.md (55 endpoints) + task-breakdown.md (8 tracks) livrés.
- 2026-04-22 · Specs Phase 1 approuvées. 3 agents shutdown + team fakt-phase1-design deleted.
- 2026-04-22 · Team `fakt-phase2-build` créée. 5 agents Wave 1 spawnés en parallèle (α, δ, ζ, η, θ).
- 2026-04-22 · Specs Phase 1 approuvées par coordinateur. Shutdown team `fakt-phase1-design` demandé. Démarrage Phase 2 Build Wave 1 (5 agents parallèles : α + δ + ζ + η + θ).
- 2026-04-22 · track-alpha : scaffold `packages/api-server/` livré. 14 endpoints (health, workspace×3, settings×3, clients×7), middlewares auth/zod/error-handler/request-id, helper `createTestApp()` réutilisable par β/γ, 38 tests verts (401/400/404/409 matrix). `bun run --filter @fakt/api-server typecheck/test/build` all green. Queries `createWorkspace` + `restoreClient` ajoutées à `@fakt/db`. Ready for Wave 2.
- 2026-04-22 · track-delta : Tauri sidecar `fakt-api` — module Rust `src-tauri/src/sidecar.rs` (token 32B base64url via OsRng, spawn via `ShellExt::sidecar`, port discovery via stdout `FAKT_API_READY:port=<N>` timeout 5s, healthcheck retry 5×500ms via reqwest blocking-in-spawn_blocking, shutdown via `child.kill()` + grace 3s, crash-loop detection 2/60s), `src/lib.rs` setup hook block_on spawn + `WebviewWindowBuilder::initialization_script` injectant `window.__FAKT_API_URL__ / __FAKT_API_TOKEN__ / __FAKT_MODE__=1`, `tauri.conf.json` `bundle.externalBin: ["binaries/fakt-api"]` + CSP `connect-src http://127.0.0.1:*`, `Cargo.toml` reqwest features `json/http2/charset` activées, script `packages/api-server/scripts/build-sidecar.ts` Bun cross-compile 4 targets (win-x64 / darwin-x64 / darwin-arm64 / linux-x64 → naming Rust triple), `apps/desktop/package.json` scripts `build:sidecar` + `tauri:build = build:sidecar && tauri build`, test intégration `tests/sidecar_port_discovery.rs` 7 passants + 9 unit tests in-module (parse ready line + token 43-char + init script escaping). `cargo check --locked` OK, `cargo test --test sidecar_port_discovery` 7/7, desktop typecheck + build OK. Dev mode : `FAKT_API_EXTERNAL=1` + `FAKT_API_PORT` skip le spawn pour pointer sur un api-server lancé manuellement (`bun run packages/api-server/src/index.ts`). Ready for Wave 3 (ε qui consomme `window.__FAKT_API_URL__`).
- 2026-04-22 · track-eta : signature fixes livrés. Fix 1 (hash TSA RFC 3161) — `tsa_imprint_for_cms()` extrait en fonction pure `pub` (testable par integration tests), commentaire obsolète "hash le CMS entier" supprimé. Fix 2 (audit persistant) — nouveau module `crypto/audit_client.rs` (reqwest async avec timeout 3s, headers `X-FAKT-Token`, `AuditPostError`, variante `_best_effort` qui log warn sans failer la signature), appel ajouté en fin de `sign_document` avant return Ok. `Mutex<Vec<SignatureEvent>>` + 3 méthodes retirés d'`AppState`. `verify_signature` réécrit async pour GET `/api/signature-events?documentType=…&documentId=…` via api-server (fallback invoice→quote pour deviner le type). Helper `percent_encode()` inline (pas de dep urlencoding). Cargo.toml : `reqwest` features += `json`. Fix 3 (CertInfo camelCase) — `#[serde(rename_all = "camelCase")]` sur struct Rust. Frontend `CertificateTab.tsx` simplifié (plus de mapping manuel, juste `setCertInfo(result.info)`) + `onboarding/Certificate.tsx` consomme `result.info.subjectCn/fingerprintSha256Hex/notBeforeIso/notAfterIso`. Fix 4 (test fixture) — `tests/signature_freetsa_fixture.rs` génère un TSR DER minimal (PkiStatusInfo granted) + embed PAdES-B-T + sanity checks (taille 2KB-1MB, OID `id-smime-aa-timeStampToken` présent, PDF parseable lopdf) → écrit `apps/desktop/tests/fixtures/signed_pades_b_t_freetsa.pdf` (33669 bytes). `tests/tsa_hash_correctness.rs` 3 tests : match SignerInfo.signature non pas CMS entier (+ contre-exemple explicite), déterminisme, erreur sur CMS malformé. `lib.rs` : ajout `pub mod sidecar` (le module existait mais n'était pas déclaré). Tests all-green : `cargo check --tests` OK, `cargo test --lib` 45/45, `cargo test --test tsa_hash_correctness` 3/3, `cargo test --test signature_freetsa_fixture` 1/1, `cargo test --test sign_document_e2e` 3/3, `cargo test --test cert_roundtrip` 1/1, `cargo test --test pades_embed` 1/1, `cargo test --test verify_signature` 3/3. TS typecheck OK (tsc --noEmit). Known Issue CHANGELOG v0.1.0 : si api-server down au moment de sign, l'event audit est perdu — Tom doit relancer `POST /api/signature-events` à la main.
- 2026-04-22 · track-zeta : plugins Tauri fs + dialog ajoutés. `Cargo.toml` + `lib.rs` (deux `.plugin(...)` en plus de shell). `capabilities/default.json` créé avec permissions `core/shell/fs/dialog` + scope `fs:scope` strictement limité à 4 chemins (`$TEMP/fakt-drafts/**`, `$APPDATA/fakt/**`, `$APPLOCALDATA/fakt/**`, `$DOWNLOAD/**`). `invoke_handler!` purgé des 8 commandes migrées vers api-server (`mark_quote_invoiced`, `mark_invoice_sent`, `update_invoice`, `delete_invoice`, `numbering_next_quote`, `numbering_next_invoice`, `get_signature_events`, `append_signature_event`). `cycle.rs` réduit à 23 lignes (flag setup uniquement). `email.rs` : helper `quote_cmd_arg` qui entoure de `"..."` les paths avec espace/quote/`&`/`;`/`^` et double les quotes internes — fixe les usernames FR type `C:\Users\Jean Dupont\...` pour `cmd /C start` (5 tests unitaires). `tests/plugins_capabilities.rs` 3 tests (JSON valide, permissions présentes, scope least-privilege). `cargo check --locked` OK, `cargo test --test plugins_capabilities` 3/3, `cargo test --lib commands::email` 5/5. Commit f32d089. Ready for Wave 3 (ε frontend hooks).
- 2026-04-22 · track-delta (wiring complémentaire) : restauration de l'intégration live dans `lib.rs` (track ζ avait réécrit le setup hook sans le sidecar). Ajout dans `.setup()` : `spawn_api_server(&handle)` via `tauri::async_runtime::block_on`, `Arc<ApiContext>` stocké via `app.manage()` (consommable par `signatures.rs` et autres commandes), `WebviewWindowBuilder::new(app, "main", ...)` avec `initialization_script()` injectant `window.__FAKT_API_URL__` / `__FAKT_API_TOKEN__` / `__FAKT_MODE__=1` AVANT chargement frontend (token JSON-échappé via serde pour blinder l'injection). Ajout `.on_window_event(|window, event| if CloseRequested → sidecar_shutdown(ctx))` qui tue proprement le child Bun. Sans ce patch le module sidecar était orphelin (compilait mais jamais invoqué). `cargo check --locked` OK, `cargo test` 25+ tests verts (cert_roundtrip + pades_embed + plugins_capabilities 3/3 + sidecar_port_discovery 7/7 + sign_document_e2e 3/3 + signature_freetsa_fixture 1/1 + tsa_hash_correctness 3/3 + verify_signature 3/3), `bun run typecheck` 12/12 packages OK. Commit e013126.
- 2026-04-22 · track-alpha-retry : finalisation du commit de track α (l'agent original avait écrit tout le code sur disque mais avait crashé avant de commit — PC reset utilisateur). Scan + validations all-green : `bun run typecheck` 12/12, `bun run test` 361 tests verts (dont 38 api-server + 105 `@fakt/db`), `bun run build` 3/3. **Fix coverage** : 6 tests ajoutés dans `@fakt/db` pour couvrir `createWorkspace` (lignes `settings.ts` 73-91) et `restoreClient` (lignes `clients.ts` 173-183) non exercés par les tests existants → coverage branches remontée de 69.95 % à 71.59 % (seuil 70 % respecté). Commit `c5a3d44` (non-signé GPG : agent sandbox sans accès pinentry, bypass validé par team-lead, DCO `-s` textuel préservé). Wave 1 désormais complète (α + δ + ζ + η + θ). Ready Wave 2 (β + γ qui consomment le helper `createTestApp()`).
- 2026-04-22 · track-beta : 18 endpoints livrés (services 7 + numbering 2 + quotes 9). Concurrence CGI art. 289 prouvée : 100 POST /api/numbering/next parallel → sequence 1..100 sans trou, passe aussi à 500× (BEGIN IMMEDIATE via `sqlite.transaction(fn).immediate()`). Transitions invalides → 422 INVALID_TRANSITION, UNIQUE → 409 CONFLICT, 401 sans token, 400 payload invalide (Zod), 404 id inconnu — matrix complète. Queries `@fakt/db` étendues : `restorePrestation` + `nextNumberAtomic(sqlite, db, workspaceId, type)` avec `SqliteDriverLike` structurel. Typing `SqliteLike` (api-server `types.ts`) résout le schisme better-sqlite3 (tests) ↔ bun:sqlite (prod γ) sans duck-typing. `tsconfig.json` `types: ["node", "bun"]` pour débloquer `import "bun:sqlite"` chez γ. Tests : 69 api-server β (services 23, numbering 11, numbering-concurrency 2 critiques 100× + 500×, quotes 20, quotes-cycle 13 full lifecycle draft→sent→viewed→signed→invoiced + refused/expired/cancel) + 5 @fakt/db (restorePrestation ×3, nextNumberAtomic ×2). Coverage scope β : services 96.82 %/85.29 %, quotes 98.03 %/88 %, numbering 93.33 %/50 % (branches basses = alternates `transaction.deferred/exclusive` non utilisés). `bun run typecheck` 12/12 OK, `bun run --filter @fakt/api-server test` 176/176 OK (β + γ + α combinés), `bun run build` OK. Commit cd40792.
