# FAKT — Architecture refacto api-server sidecar · v0.1

**Document type :** spec technique haute-niveau (pas de code).
**Date :** 2026-04-22
**Auteur :** tech-architect (agent `fakt-phase1-design`)
**Statut :** draft, en attente review coordinateur.
**Scope :** architecture cible v0.1 (mode solo desktop), pensée extensible sans refacto pour modes 2 (self-host entreprise) et 3 (SaaS hébergé).

---

## 0 · Contexte et problème

L'audit E2E (`docs/sprint-notes/e2e-wiring-audit.md`) a constaté un gap majeur : le frontend React est complet, les queries Drizzle sont complètes, mais **~20 commandes Tauri Rust CRUD manquent**, et la DB Drizzle n'est jamais initialisée au runtime. L'app n'est pas dogfoodable.

Tom a validé l'**option C** : un backend sidecar `packages/api-server/` (Bun + Hono) qui wrappe toutes les queries Drizzle derrière une API REST locale. Tauri spawn ce binaire au démarrage, le frontend React fetch `http://127.0.0.1:PORT/api/...`. Cela résout :

1. **Pas besoin de dupliquer CRUD en Rust** : les queries Drizzle existantes sont exposées en REST.
2. **Architecture triple-mode native** : le même binaire tourne en sidecar desktop, en Docker VPS ou en Cloud Run. Seul l'adapter DB et l'auth changent.
3. **Frontend découplé** : `fetch` au lieu de `invoke`, remplaçable par un backend distant via `FAKT_API_URL`.

Ce document décrit l'archi cible et les invariants que chaque track de Phase 2 doit respecter.

---

## 1 · Vue haut-niveau des 3 modes de déploiement

### 1.1 · Mode 1 — Solo desktop (v0.1, MVP)

```
┌──────────────────────────────────────────────────────────────┐
│  Desktop Tauri (installer .msi/.dmg/.AppImage, ≤ 100 MB)     │
│                                                               │
│  ┌─────────────────┐   HTTP localhost   ┌──────────────────┐ │
│  │ React webview   │ ─────────────────▶ │ Bun api-server   │ │
│  │ (Vite build)    │  fetch + X-FAKT-   │ Hono REST        │ │
│  │                 │   Token header     │ Drizzle SQLite   │ │
│  └─────────────────┘ ◀───────────────── └──────────────────┘ │
│         │                                        │           │
│         │ Tauri invoke (signature/email/         │ rwa       │
│         │                archive/PDF render)     ▼           │
│         ▼                                   ~/.fakt/db.sqlite│
│  ┌──────────────────────────────┐                            │
│  │ Rust core                    │                            │
│  │  - PAdES B-T (keychain OS)   │                            │
│  │  - open_email_draft (.eml)   │                            │
│  │  - build_workspace_zip       │                            │
│  │  - render_pdf (Typst subproc)│                            │
│  └──────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────┘

Bind api-server : 127.0.0.1:RANDOM_PORT (jamais exposé LAN)
Token : 32 bytes aléatoire généré au spawn, partagé Rust↔webview
```

### 1.2 · Mode 2 — Self-host entreprise (v0.2+)

```
┌─────────────────────┐              ┌──────────────────────────┐
│ Desktop Tauri       │   HTTPS      │ VPS Docker               │
│ (users freelances)  │ ───────────▶ │ ┌──────────────────────┐ │
│ FAKT_API_URL=https  │  JWT header  │ │ api-server (Bun)     │ │
│ ://fakt.agence.com  │              │ │ Drizzle Postgres     │ │
└─────────────────────┘              │ └──────────────────────┘ │
                                     │ ┌──────────────────────┐ │
┌─────────────────────┐              │ │ Postgres 16          │ │
│ Desktop Tauri       │ ───────────▶ │ └──────────────────────┘ │
│ (autre membre)      │              │                          │
└─────────────────────┘              │ Reverse proxy : Caddy    │
                                     └──────────────────────────┘

Même binaire api-server (bundle standalone Bun compile).
Différence : DATABASE_URL=postgres://…, AUTH_MODE=jwt, BIND=0.0.0.0:3000.
Rust core reste en desktop — signature et email OS locaux.
```

### 1.3 · Mode 3 — SaaS hébergé (v0.3+)

```
┌──────────────────┐          ┌────────────────────────────────┐
│ Desktop Tauri    │          │ fakt.com (Cloud Run / Fly.io)  │
│ ou navigateur    │ ───HTTPS─▶│ ┌──────────────────────────┐  │
│ (multi-tenant)   │  OAuth   │ │ api-server scalable      │  │
└──────────────────┘  session │ │ Drizzle Postgres RLS     │  │
                              │ │ X-Workspace-Id résolu    │  │
                              │ │   par session OAuth      │  │
                              │ └──────────────────────────┘  │
                              │ ┌──────────────────────────┐  │
                              │ │ Postgres RLS + backups   │  │
                              │ └──────────────────────────┘  │
                              │                                │
                              │ Stripe billing, Clerk auth,    │
                              │ Sentry, PostHog.               │
                              └────────────────────────────────┘

Mêmes endpoints REST, mais auth = OAuth/session cookie,
workspace_id résolu server-side (jamais envoyé par le client),
Row-Level Security activé sur Postgres (policies par workspace_id).
```

### 1.4 · Invariant fondateur

**Les 3 modes partagent le même code `packages/api-server/` et les mêmes queries `packages/db/`.** Seuls diffèrent :

| Dimension | Mode 1 | Mode 2 | Mode 3 |
|---|---|---|---|
| DB adapter | SQLite (better-sqlite3) | Postgres (postgres-js) | Postgres + RLS |
| Bind | 127.0.0.1 | 0.0.0.0 | 0.0.0.0 derrière LB |
| Auth | Token 32B local | JWT ou session cookie | OAuth + session |
| Workspace resolution | `workspace_id` seed unique | JWT claim | Session → `workspace_id` via RLS |
| Bundling | Bun compiled sidecar | Docker image | Docker image |
| TLS | non (localhost) | reverse-proxy | LB managed |

Le PM agent produira `api-endpoints.md` sans distinguer ces modes : les endpoints sont identiques, c'est le middleware auth qui change.

---

## 2 · `packages/api-server/` — stack et structure

### 2.1 · Stack choisi

- **Runtime :** Bun 1.3+ (runtime officiel déclaré dans le monorepo, `bun build --compile` existe, perf native).
- **Framework HTTP :** **Hono** 4.x. Justifications : (i) léger (~30 kB), (ii) types TS excellents, (iii) runtime-agnostic (Bun, Node, Cloudflare), (iv) middleware mature (logger, CORS, JWT), (v) déjà utilisé dans l'écosystème AlphaLuppi (pattern MnM).
- **Validation :** Zod 3.x partagé via `@fakt/shared`. Chaque endpoint valide body + params + query.
- **ORM :** Drizzle — imports depuis `@fakt/db`. Zero duplication.
- **Logging :** `pino` JSON, niveau configurable via env. stdout → capturé par Tauri en mode 1.
- **Tests :** Vitest pour handlers unitaires + intégration roundtrip SQLite (le qa agent détaillera).

### 2.2 · Alternative rejetée : Rust Axum

Sur le papier, Axum permet de tout mettre en un seul binaire Rust (Tauri + Axum). **Rejeté** pour 3 raisons :

1. **Dupliquer les queries Drizzle en Rust (sqlx/sea-orm) = 2000+ lignes de code** à réécrire et tester. Bloquant pour la fenêtre v0.1.
2. **Perte de cohérence dual-adapter** : Drizzle SQLite ↔ Postgres est l'endroit où l'investissement a été fait. Pas de bibliothèque Rust qui offre équivalent sans rewrite.
3. **Le surcoût de 70 MB Bun compiled est acceptable** (NFR-003 révisé à 100 MB, cohérent avec Slack/Discord/Obsidian 100-200 MB). Un port Rust peut être fait en v0.2 si la taille devient critique — mais les queries seront alors stables.

### 2.3 · Structure de dossiers

```
packages/api-server/
├── package.json                  # deps: hono, @fakt/db, @fakt/shared, zod, pino
├── tsconfig.json
├── src/
│   ├── index.ts                  # entry point — boot, port discovery, graceful shutdown
│   ├── app.ts                    # construit l'instance Hono + registre routes
│   ├── config.ts                 # parse env (DATABASE_URL, AUTH_MODE, BIND, PORT)
│   │
│   ├── db/
│   │   └── bootstrap.ts          # init DbInstance (SQLite ou Postgres) + run migrations
│   │
│   ├── routes/
│   │   ├── health.ts             # GET /health (heartbeat + db ping)
│   │   ├── workspace.ts          # /api/workspace/*
│   │   ├── clients.ts            # /api/clients/*
│   │   ├── services.ts           # /api/services/*
│   │   ├── quotes.ts             # /api/quotes/*
│   │   ├── invoices.ts           # /api/invoices/*
│   │   ├── numbering.ts          # /api/numbering/*
│   │   └── signatures.ts         # /api/signatures/* (lecture audit only; sign est Rust)
│   │
│   ├── middleware/
│   │   ├── auth.ts               # pluggable : local-token | jwt | session
│   │   ├── error.ts              # mapping FaktError → HTTP status
│   │   ├── logger.ts             # pino middleware
│   │   └── workspace-ctx.ts      # résout workspace_id (mode 1 : env seed ; mode 2/3 : JWT/session)
│   │
│   ├── services/                 # couche métier (si logique > 1 query Drizzle)
│   │   └── lifecycle.ts          # transitions statut quote/invoice + audit activity
│   │
│   └── types/
│       └── env.ts                # types sur process.env parsé
└── __tests__/
    ├── routes/                   # handler tests (Vitest + supertest-like via hono/testing)
    └── integration/              # DB roundtrip SQLite :memory:
```

### 2.4 · Responsabilités — ce que `api-server` fait et ne fait pas

**Fait :**
- Toutes les opérations CRUD persistées dans `packages/db/` (clients, services, quotes, invoices, numbering, settings, activity).
- Transitions de statut (draft → sent → signed → invoiced, etc.) avec écriture audit dans table `activity`.
- Lecture de l'audit trail signature (table `signature_events`) — consulté par le frontend pour afficher "Qui a signé quoi quand".
- Application de la numérotation atomique CGI art. 289 (via `BEGIN IMMEDIATE` SQLite ou `SERIALIZABLE` Postgres).
- Validation légale (Zod schemas miroir des contraintes DB).

**Ne fait pas :**
- Signature cryptographique PAdES (reste en Rust, accès keychain OS).
- Rendu PDF Typst (reste en Rust, subprocess).
- Création fichier `.eml` + spawn client mail OS (reste en Rust, API OS).
- Construction archive ZIP (reste en Rust, crate `zip`).
- File pickers / dialogs système (plugins Tauri).

### 2.5 · Lifecycle d'un appel `api-server`

```
1. Tauri spawn `fakt-api.exe` avec env : FAKT_DB_PATH, FAKT_MODE=1, FAKT_WORKSPACE_ID, FAKT_LOCAL_TOKEN, PORT=0 (auto)
2. api-server boot :
   a. Parse env
   b. Connecte DB (SQLite via @fakt/db createDb)
   c. Exécute migrations Drizzle (idempotent) — voir §10
   d. Construit l'app Hono, enregistre middleware auth + routes
   e. Listen sur 127.0.0.1:0 (kernel choisit port libre)
   f. Écrit `FAKT_API_READY:port=<N>\n` sur stdout
   g. Boucle d'events jusqu'à SIGTERM
3. Tauri lit stdout, parse le port, stocke dans AppState, injecte dans webview via `window.__FAKT_API_URL__` + `window.__FAKT_API_TOKEN__`
4. Frontend fetch le backend avec header X-FAKT-Token
5. Shutdown : Tauri envoie SIGTERM au child, api-server flush logs + close DB + exit 0
```

### 2.6 · Healthcheck

```
GET /health
→ 200 { ok: true, version: "0.1.0", db: "ok", uptimeMs: 12345 }
ou 503 { ok: false, db: "error", reason: "…" }
```

Mode 1 : appelé une fois par Tauri à la fin du boot pour confirmer que le backend est prêt. Si 503, retry 5×500ms, sinon affichage erreur fatale.

Mode 2/3 : healthcheck lu par Docker healthcheck / Cloud Run probe.

---

## 3 · Drizzle dual-adapter SQLite ↔ Postgres

### 3.1 · Situation actuelle (v0.1)

Le fichier `packages/db/src/adapter.ts` existe mais n'implémente que SQLite (better-sqlite3). Le schéma `packages/db/src/schema/index.ts` utilise exclusivement `drizzle-orm/sqlite-core`.

### 3.2 · Stratégie cible

**Approche :** un fichier `adapter.ts` qui exporte une **factory** `createDb(config)` retournant un type union `DbInstance = SqliteDb | PgDb`. Les queries sont écrites contre le **type le plus restreint des deux** (drizzle-orm sans sous-dialect spécifique, ce qui marche déjà pour la majorité des opérations CRUD).

```ts
// packages/db/src/adapter.ts (cible)

export interface DbConfig {
  dialect: "sqlite" | "postgres";
  sqlite?: { path: string };
  postgres?: { url: string; maxConnections?: number };
}

export type DbInstance =
  | BetterSQLite3Database<typeof schema>
  | PostgresJsDatabase<typeof schema>;

export function createDb(config: DbConfig): DbInstance { … }
```

### 3.3 · Contraintes sur les queries existantes

Aujourd'hui les queries importent `BetterSQLite3Database` directement. À refactorer :

1. **Typer `DbInstance` comme union** et utiliser uniquement les méthodes Drizzle communes aux deux dialectes (`select`, `insert`, `update`, `delete`, `.where()`, `.orderBy()`, etc.).
2. **Identifier les endroits SQLite-only** : `db.transaction()` fonctionne différemment en Postgres async. `db.select().all()` vs `await db.select()`. Stratégie : **forcer le mode async partout dans les queries** — SQLite via better-sqlite3 est sync nativement mais on wrap en `Promise.resolve()` pour homogénéité. Coût perf négligeable (monouser).
3. **Numbering CGI art. 289** nécessite `BEGIN IMMEDIATE` SQLite et `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` Postgres. Encapsulé dans un helper `runSerializable(db, fn)` qui dispatch selon dialect.

### 3.4 · Schéma dual

Le schéma Drizzle actuel utilise `sqliteTable`. Pour Postgres, il faudra un schéma miroir `pgTable` — **NON livré en v0.1**. En v0.1, l'api-server supporte **uniquement SQLite**. Le wiring Postgres est posé (config, adapter factory) mais le schéma Postgres sera ajouté en v0.2.

**Décision explicite :** le mode 2 self-host peut tourner en v0.1 sur SQLite également (NFS partagé ou volume Docker). Ce n'est pas idéal prod mais c'est viable pour une petite équipe < 5 users. Postgres schema vient en v0.2 quand un vrai client self-host le demande.

### 3.5 · Migrations Drizzle

Actuellement 2 fichiers : `0001_triggers.sql` (trigger no-hard-delete) et `0002_signed_pdf.sql`. Ils restent SQLite-only. Pour Postgres v0.2, créer `0001_pg.sql` + `0002_pg.sql` équivalents (triggers PL/pgSQL).

`drizzle-kit` génère aussi des migrations auto-dérivées du schéma — à garder, mais s'assurer que les triggers custom et les contraintes CGI (UNIQUE sur year/type/sequence) sont commités en migrations et non régénérés à chaque `drizzle-kit generate`.

---

## 4 · Authentification et autorisation

### 4.1 · Mode 1 (solo desktop) — token local

**Threat model :** un process malveillant tournant sur la même machine pourrait tenter de se connecter à `127.0.0.1:PORT` et lire/modifier les données. Un attaquant distant ne peut pas — bind localhost.

**Mitigation :** token aléatoire 32 bytes (base64url, ~43 chars) généré par Tauri au démarrage via `rand::thread_rng()`. Partagé en env var au spawn du child `fakt-api`. Le frontend le lit via `window.__FAKT_API_TOKEN__` injecté par Tauri `initialization_script`. Toute requête doit porter `X-FAKT-Token: <token>` — middleware Hono check strict, 401 sinon. Ce header **empêche le CSRF** (un browser externe ne peut pas lire un header custom non-CORS sans preflight, qu'on rejette).

**Décision :** pas de CORS wildcard. Seul `Origin: tauri://localhost` (ou équivalent OS) est accepté en mode 1. Les requêtes sans origin (native fetch Tauri) sont OK.

### 4.2 · Mode 2 (self-host) — JWT ou session cookie, v0.2

v0.1 ne supporte pas le mode 2 auth complet. Posé pour v0.2 :

- **JWT** signé server-side (HS256 secret env), porte `{ workspaceId, userId, roles }`, expire 7j, renouvelé côté client via refresh-token.
- **Ou session cookie** httpOnly, sameSite=Lax, signé. Plus classique webapp.

Le choix sera tranché par un mini-RFC en v0.2. En attendant, le middleware `auth.ts` est prévu pluggable (interface `AuthStrategy` avec méthode `verify(req) → Principal | null`).

### 4.3 · Mode 3 (SaaS) — OAuth + multi-tenant, v0.3+

- Provider : Clerk ou Auth.js. Login email/password + OAuth Google.
- Après login : session cookie sécurisée + workspace_id résolu côté serveur (user → membership → workspace).
- **Row-Level Security Postgres activé** : chaque query exécutée dans une transaction qui `SET LOCAL app.current_workspace = $workspaceId`. Les policies RLS filtrent. Évite tout bug métier menant à une fuite cross-tenant.
- Endpoints identiques en v0.1/v0.2, seul le middleware workspace-ctx change.

### 4.4 · Invariant

Le code des routes (`routes/clients.ts`, `quotes.ts`, etc.) **ne connaît jamais le mode**. Il reçoit un `c.var.workspaceId` via middleware et l'utilise en paramètre de query Drizzle. Ce qui change selon le mode, c'est comment ce `workspaceId` est résolu.

---

## 5 · Tauri sidecar — spawn, port discovery, IPC

### 5.1 · Déclaration sidecar

Dans `apps/desktop/src-tauri/tauri.conf.json`, section `bundle.externalBin` :

```json
{
  "bundle": {
    "externalBin": ["bin/fakt-api"],
    "resources": ["resources/**/*"]
  }
}
```

Tauri s'attend à trouver `src-tauri/bin/fakt-api-<target-triple>` pour chaque target compilé (ex : `fakt-api-x86_64-pc-windows-msvc.exe`). Le CI build produit ces binaires via `bun build --compile --target=bun-windows-x64 ./packages/api-server/src/index.ts --outfile=fakt-api-x86_64-pc-windows-msvc.exe`.

### 5.2 · Spawn au boot

Dans `lib.rs` → `setup` :

```rust
// pseudo-code, pas une spec d'impl complète
let sidecar = app.shell()
    .sidecar("fakt-api")?
    .env("FAKT_DB_PATH", db_path)
    .env("FAKT_MODE", "1")
    .env("FAKT_WORKSPACE_ID", workspace_id)
    .env("FAKT_LOCAL_TOKEN", random_token)
    .env("PORT", "0")
    .spawn()?;

let (port, token) = wait_for_ready(sidecar.stdout, Duration::from_secs(5))?;
app.manage(ApiContext { port, token, child: sidecar.child });
```

### 5.3 · Port discovery via stdout

**Protocole simple :** api-server au démarrage écrit **une seule ligne** sur stdout :

```
FAKT_API_READY:port=56839
```

Rust parse cette ligne via `BufReader::read_line`, extrait le port, stoppe de consommer stdout (ou redirect vers log file pour debug). Timeout 5s ; dépassé → tuer le child et afficher erreur bloquante.

**Pourquoi pas un fichier temp ?** : stdout est async, plus rapide, sans cleanup à faire. Cross-OS.

**Pourquoi pas port fixe ?** : conflits si l'user a déjà un service sur 3000/3001. Le port 0 = "kernel, donne-moi un libre".

### 5.4 · Injection dans le webview

Tauri `WebviewWindowBuilder.initialization_script` permet d'injecter du JS avant le premier script de la page :

```javascript
// script injecté automatiquement
window.__FAKT_API_URL__ = "http://127.0.0.1:56839";
window.__FAKT_API_TOKEN__ = "k8x2…";
window.__FAKT_MODE__ = 1;
```

Le frontend crée un `ApiClient` singleton qui lit ces globals. En mode 2/3, elles seraient absentes et l'ApiClient tomberait sur `process.env.FAKT_API_URL` via `import.meta.env.VITE_FAKT_API_URL`.

### 5.5 · Shutdown propre et crash recovery

**Shutdown normal :** quand la fenêtre Tauri se ferme, `on_window_event(CloseRequested)` → envoie SIGTERM au child. Timeout grace 3s → SIGKILL.

**Crash api-server :** le child meurt inopinément. Rust détecte via `child.wait()` async. Strategy : (i) logger l'event, (ii) re-spawn automatiquement une fois, (iii) si 2 crashes en 60s → dialog brutaliste erreur "Backend FAKT crashé, veuillez redémarrer l'app" avec lien vers logs.

**Logs api-server :** redirigés vers `~/.fakt/logs/api-server.log` rotaté 5 MB × 3 fichiers (via `pino-roll` ou rotation maison).

---

## 6 · Bundling Bun compiled — taille et cross-OS

### 6.1 · Commande de build

```
bun build \
  --compile \
  --target=bun-windows-x64 \
  --minify \
  --outfile=fakt-api-x86_64-pc-windows-msvc.exe \
  ./packages/api-server/src/index.ts
```

Variants :
- `bun-windows-x64`
- `bun-darwin-x64`, `bun-darwin-arm64`
- `bun-linux-x64`, `bun-linux-arm64` (v0.2, optionnel en v0.1)

### 6.2 · Taille estimée

Sur un projet Hono + Drizzle + SQLite + pino équivalent, Bun compile produit ~55-75 MB par binaire (le runtime Bun lui-même pèse ~50 MB, pas compressible sous cette méthode). 

Estimation par OS :
- Windows x64 : ~72 MB
- macOS x64 : ~68 MB
- macOS arm64 : ~65 MB
- Linux x64 : ~70 MB

### 6.3 · Impact NFR-003 (taille installer)

**Original :** ≤ 15 MB (objectif 8 MB).
**Révision :** ≤ 100 MB.

Détail Windows :
- Tauri Rust core + webview runtime : ~12 MB
- Assets frontend (React build) : ~4 MB
- Sidecar fakt-api Bun : ~72 MB
- Templates Typst + resources : ~2 MB
- **Total installer .msi** : ~90 MB.

Cohérent avec : Slack 105 MB, Discord 130 MB, Obsidian 85 MB, Raycast 120 MB. Acceptable pour un desktop moderne.

### 6.4 · Port Rust envisagé v0.2+

Si la taille devient bloquante (feedback users), porter api-server en Rust Axum en v0.2. Les endpoints Hono et les queries Drizzle servent alors de spec exécutable pour le port. Estimé 2 semaines.

### 6.5 · CI cross-compile

GitHub Actions matrix déjà en place pour Tauri (voir track-l wave 4). Étendre :

```yaml
strategy:
  matrix:
    include:
      - os: windows-latest
        bun-target: bun-windows-x64
      - os: macos-latest
        bun-target: bun-darwin-arm64
      - os: macos-13
        bun-target: bun-darwin-x64
      - os: ubuntu-latest
        bun-target: bun-linux-x64
```

Chaque job : `bun build --compile --target=<t>` → copie binaire dans `src-tauri/bin/` → `tauri build`.

---

## 7 · Frontend React — refacto `invoke` → `fetch`

### 7.1 · Créer `apps/desktop/src/lib/api-client.ts`

Centraliser la logique base URL + token + parsing erreurs. Interface minimale :

```ts
export interface ApiClient {
  get<T>(path: string, query?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export function getApiClient(): ApiClient { … }
```

Détails :
- Base URL : `window.__FAKT_API_URL__` (mode 1) ou `import.meta.env.VITE_FAKT_API_URL` (mode 2/3 dev).
- Header `X-FAKT-Token` ajouté systématiquement en mode 1.
- Gestion d'erreur : `fetch` renvoie body JSON `{ error: string, code: string }` → wrappé en `ApiError` typée.
- JSON body parsé via Zod schemas importés de `@fakt/shared`.

### 7.2 · Refacto des hooks React

Pattern actuel dans `apps/desktop/src/hooks/useClients.ts` (hypothétique) :

```ts
const { data } = useQuery({
  queryKey: ["clients"],
  queryFn: () => invoke<Client[]>("list_clients", { workspaceId }),
});
```

Pattern cible :

```ts
const { data } = useQuery({
  queryKey: ["clients"],
  queryFn: () => api.get<Client[]>("/api/clients", { workspaceId }),
});
```

**Le cache React Query, les mutations, les optimistic updates : identiques.** Seule la ligne `queryFn` change. Track ε de Phase 2 fera cette refacto hook par hook.

### 7.3 · Ce qui reste en `invoke`

Tout ce qui touche le Rust core (voir §8). On garde `@tauri-apps/api/core.invoke` pour ces 6-8 commandes.

### 7.4 · Runtime detection

```ts
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const API_MODE = window.__FAKT_MODE__ ?? (IS_TAURI ? 1 : 3);
```

Permet au même bundle React de tourner en webapp SaaS v0.3 (mode 3) sans Tauri. Les composants qui appellent `invoke` (signature, archive ZIP) doivent afficher un fallback "fonctionnalité desktop-only" si `!IS_TAURI`.

---

## 8 · Ce qui reste en Rust Tauri (exhaustif)

Commandes qui **ne migrent pas** vers api-server, avec la raison :

| Command | Raison |
|---|---|
| `generate_cert`, `rotate_cert`, `get_cert_info` | Accès keychain OS (Windows Credential Manager, macOS Keychain, Linux Secret Service). La keyring crate est Rust-only. |
| `sign_document` | Signature PAdES CMS : nécessite clé privée du keychain (ci-dessus) + crates Rust `rsa`, `cms`, `lopdf`. Réécrire en TS = impossible sans embarquer OpenSSL. |
| `verify_signature` | Lecture PDF + parse CMS + vérif crypto. Côté Rust pour cohérence avec sign_document. |
| `render_pdf` / `render_quote_pdf` / `render_invoice_pdf` | Subprocess `typst compile` — le process management est plus fiable en Rust (tokio), et Typst ne se run pas côté Bun sans embarquer le CLI Typst bundle. |
| `open_email_draft`, `open_mailto_fallback` | API OS spécifiques : ShellExecute Windows, NSWorkspace macOS, xdg-open Linux. Le sidecar Bun ne peut pas invoquer ces API proprement sans subprocess shell en Rust de toute façon. |
| `build_workspace_zip` | Utilise crate Rust `zip`. Pourrait être porté en Bun (`JSZip` ou `jszip`) mais : (a) les sources PDFs sont sur disque en paths Rust-connu, (b) c'est une opération one-shot one-click, pas besoin de la bouger. |
| `append_signature_event`, `get_signature_events`, `store_signed_pdf`, `get_signed_pdf` | **À migrer vers api-server** — ce sont juste des accès DB. Ces commandes resteront en Rust uniquement le temps de Phase 2 track γ, puis retirées. |
| `numbering_next_quote`, `numbering_next_invoice` | **À migrer vers api-server** endpoint POST /api/numbering/next. L'implémentation atomique BEGIN IMMEDIATE est équivalente en Drizzle côté Bun. |
| `ai::check_claude_cli`, `ai::spawn_claude` | Subprocess management Claude CLI : reste en Rust pour stream management + timeout cleanup fiable. |
| Plugins Tauri fs/path/dialog/shell | UI interactions (file picker, temp dir) → plugins natifs Tauri. À déclarer dans `Cargo.toml` et `capabilities/`. |

**Commandes à supprimer de Rust** (après migration track γ) : tout ce qui est `mark_quote_invoiced`, `mark_invoice_sent`, `update_invoice`, `delete_invoice`, `update_workspace`, `get_workspace`, `is_setup_completed`, `complete_setup` — toutes remplacées par endpoints REST.

---

## 9 · Sécurité

### 9.1 · Bind localhost strict mode 1

`bun --bind 127.0.0.1` exclusif. Aucun accès LAN. Vérifié par test d'intégration qui tente `curl http://<lan-ip>:<port>/health` → `ECONNREFUSED`.

### 9.2 · Token aléatoire 32 bytes

Généré par Tauri avec `rand::rngs::OsRng`, encodé base64url. Transmis au sidecar via env var (pas CLI arg — visible via `ps`). Token rotaté à chaque démarrage app (pas persisté).

### 9.3 · Pas de CORS wildcard

Middleware Hono CORS :
- Mode 1 : `Access-Control-Allow-Origin: tauri://localhost` (ou équiv), `Vary: Origin`, pas de `*`.
- Mode 2/3 : liste blanche d'origins configurable via env.

### 9.4 · Input validation Zod

Chaque route body parsé via Zod. Les schemas vivent dans `@fakt/shared/src/schemas/` pour partage front/back.

### 9.5 · SQL injection

Drizzle protège par construction (parametrized queries). Jamais de `sql.raw()` avec input user.

### 9.6 · Rate limiting

Mode 1 : non-applicable (process local).
Mode 2/3 : middleware `hono-rate-limiter` avec redis v0.3.

### 9.7 · Secrets

- Token local : env var, non persisté, non logué.
- DATABASE_URL postgres mode 2/3 : env var Docker/K8s secret.
- Clés signature : keychain OS, jamais en fichier plat.
- Logs : aucun PII inutile, pas de SIRET client dans les logs INFO, OK en DEBUG local.

### 9.8 · Audit trail append-only

Reste en Rust (table `signature_events`). L'api-server la consulte en lecture via `/api/signatures/events`, jamais en écriture. L'écriture reste la responsabilité de `sign_document` Rust.

---

## 10 · Migration runtime — bootstrap idempotent

### 10.1 · Premier démarrage (DB vide)

1. api-server détecte `FAKT_DB_PATH` n'existe pas.
2. `createDb(path)` crée le fichier SQLite vide.
3. Exécute `migrations/` dans l'ordre (0001, 0002, …) via `drizzle-orm/migrator`.
4. Écrit la row initiale `workspaces` si `FAKT_WORKSPACE_ID` fourni et absent.
5. Healthcheck `/health` → ok.

### 10.2 · Upgrade (DB existante)

1. `drizzle-orm/migrator` lit la table `__drizzle_migrations` et applique seulement les nouvelles.
2. Si migration irréversible nécessaire : backup auto de la DB en `~/.fakt/db.sqlite.backup-{timestamp}` avant.

### 10.3 · Idempotence stricte

Les migrations SQL sont `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE TRIGGER IF NOT EXISTS`. Re-runner N fois == runner 1 fois.

### 10.4 · Mode 2/3 Postgres v0.2+

Idem Postgres : `drizzle-kit migrate` au boot. Migrations Postgres séparées (`migrations-pg/`) car syntaxe trigger PL/pgSQL diffère.

### 10.5 · Rollback

Pas de rollback auto en v0.1. Si corruption : `cp backup-* db.sqlite`. Documenté dans le guide Ops.

---

## 11 · Observabilité (v0.1 basique, v0.2 riche)

### 11.1 · Logging structuré

Pino JSON stdout. Format :

```json
{"level":30,"time":1714123456789,"msg":"client_created","workspaceId":"ws_1","clientId":"cl_2","durationMs":12}
```

Mode 1 : redirigé vers `~/.fakt/logs/api-server.log`.
Mode 2 : captured par Docker log driver → ELK/Loki.
Mode 3 : vers stackdriver/cloudwatch.

### 11.2 · Métriques

v0.1 : endpoint `/metrics` (prom-client) désactivé par défaut, activable via env `FAKT_METRICS=1`. Expose : request count, latency p50/p95, DB pool stats.

v0.2+ : Prometheus scrape server-side.

### 11.3 · Error tracking

v0.1 : erreurs loguées (level=error) avec stack trace. Pas d'agrégation.
v0.3 : Sentry SDK.

### 11.4 · Télémétrie produit

Plausible self-host beacon opt-in (FR-004). Pas dans l'api-server, côté frontend React.

---

## 12 · Risques et mitigations

| # | Risque | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Bun compiled trop lourd (>100 MB installer) | Medium | Medium | Mesurer tôt (track δ) ; si dépasse, strip symbols, ou porter Rust Axum v0.2. |
| R2 | Port discovery échoue (stdout bufferisé) | Medium | High | api-server `process.stdout.write` + flush explicite + line non-bufferisée. Test CI cross-OS. |
| R3 | Child process zombie sur crash Tauri | Low | Medium | Tauri `on_window_event(Destroyed)` + SIGKILL fallback + cleanup `pid` file. |
| R4 | Drizzle SQLite sync vs async APIs ne cohabitent pas proprement | Medium | High | Choix clair : toutes les queries retournent `Promise<T>`. Wrap sync en Promise.resolve dans le adapter. |
| R5 | Token 32B leak via logs | Low | High | Middleware pino : redact `headers["x-fakt-token"]` toujours. Tests unitaires sur le redact. |
| R6 | CSRF via app web tierce qui fetch localhost | Low | Medium | CORS strict Origin + X-FAKT-Token header préventif. Même si navigateur bypass CORS (impossible), le token secret empêche. |
| R7 | Migration Drizzle casse une DB prod v0.1.1 | Medium | High | Backup auto avant migrate. Test "v0.1.0 DB → v0.1.1 migrate" en CI sur chaque PR. |
| R8 | Typst CLI non installé côté user en mode 1 | Medium | High | Bundle Typst binaire dans `src-tauri/resources/` (track-c wave 1 l'a déjà fait ; à vérifier). Ne pas dépendre du PATH. |
| R9 | Conflit workspace_id entre env FAKT_WORKSPACE_ID et row existante | Low | Medium | Boot api-server : si workspace_id env ≠ workspace_id DB → erreur fatale. |
| R10 | Dual-adapter Drizzle types union casse l'inférence IDE | High | Medium | Typer les queries avec `DbInstance` générique + tests de compilation. Acceptable trade-off. |

---

## 13 · Décisions tranchées (résumé)

- **Sidecar stack :** Bun + Hono + Drizzle. Axum Rust rejeté pour v0.1.
- **Installer size target :** ≤ 100 MB (NFR-003 révisé).
- **Mode 1 auth :** token aléatoire 32B en header `X-FAKT-Token`, bind 127.0.0.1 strict.
- **Mode 2 auth :** JWT en v0.2, non-shippé en v0.1.
- **Mode 3 auth :** OAuth + RLS Postgres en v0.3, non-shippé en v0.1.
- **DB dual adapter :** factory `createDb(config)` SQLite|Postgres, Postgres schema en v0.2.
- **Port discovery :** stdout line `FAKT_API_READY:port=<N>`, parsé par Rust, timeout 5s.
- **Injection frontend :** `window.__FAKT_API_URL__` + `__FAKT_API_TOKEN__` via Tauri `initialization_script`.
- **Commandes Rust conservées :** signature, email OS, archive ZIP, render_pdf, spawn claude, cert keychain, plugins fs/path/dialog.
- **Commandes Rust à supprimer :** tout CRUD métier + numbering + workspace settings → migré REST.
- **Migrations :** idempotentes au boot api-server, backup auto avant upgrade.

---

## 14 · Non-goals de ce document

- Pas de design de chaque endpoint REST (path, params, response shape). **C'est le livrable du pm agent** dans `api-endpoints.md`.
- Pas de stratégie de test unit/integration/E2E détaillée. **C'est le livrable du qa agent** dans `test-plan.md`.
- Pas de découpage en tracks parallélisables. **C'est le livrable du coordinateur** (ou d'un 4e agent) dans `task-breakdown.md`.
- Pas de code : ce document est une spec d'architecture, pas un prototype.

---

## 15 · Annexe — cartographie endpoints prévus (indicatif, pm agent détaille)

Pour orienter le pm agent, voici la **surface à couvrir** (ne pas remplacer `api-endpoints.md`) :

```
/health                                GET

/api/workspace                         GET, PATCH
/api/workspace/settings                GET, PATCH

/api/clients                           GET (list), POST (create)
/api/clients/:id                       GET, PATCH, DELETE (soft)

/api/services                          GET, POST
/api/services/:id                      GET, PATCH, DELETE

/api/numbering/next                    POST { type, workspaceId } → atomic increment
/api/numbering/peek                    GET  { type } → preview sans incr

/api/quotes                            GET (list, filters status), POST
/api/quotes/:id                        GET, PATCH, DELETE (if draft)
/api/quotes/:id/issue                  POST → assign number + status=sent
/api/quotes/:id/expire                 POST
/api/quotes/:id/cancel                 POST
/api/quotes/:id/duplicate              POST

/api/invoices                          GET, POST (independent)
/api/invoices/from-quote/:quoteId      POST → kind=deposit|balance|total
/api/invoices/:id                      GET, PATCH
/api/invoices/:id/mark-paid            POST { method, paidAt, notes }
/api/invoices/:id/archive              POST

/api/signatures/events                 GET (audit consult) — write only par Rust

/api/activity                          GET (dashboard feed)
```

~25 endpoints, cohérent avec le gap identifié dans l'audit E2E.

---

**Fin du document.**

Prochaine étape : review par le coordinateur `team-lead` (lead-orchestrator), puis démarrage travail parallèle pm agent (api-endpoints) + qa agent (test-plan).
