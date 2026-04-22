# FAKT v0.1 — API endpoints (packages/api-server/)

**Statut** : spec exhaustive, prêt à implémenter.
**Auteur** : pm-breakdown, team `fakt-phase1-design`.
**Date** : 2026-04-22.
**Source de vérité queries Drizzle** : `packages/db/src/queries/*.ts`.
**Base URL** : `http://127.0.0.1:{PORT_ALEATOIRE}/api` (port découvert via stdout du sidecar, cf `docs/refacto-spec/architecture.md`).

## Sommaire

1. [Conventions générales](#1-conventions-générales)
2. [Authentification](#2-authentification)
3. [Format des erreurs](#3-format-des-erreurs)
4. [Endpoint healthcheck](#4-endpoint-healthcheck)
5. [Workspace](#5-workspace)
6. [Settings](#6-settings)
7. [Clients](#7-clients)
8. [Prestations / services](#8-prestations--services)
9. [Numbering](#9-numbering)
10. [Quotes (devis)](#10-quotes-devis)
11. [Invoices (factures)](#11-invoices-factures)
12. [Activity feed](#12-activity-feed)
13. [Signature events (audit append-only)](#13-signature-events-audit-append-only)
14. [Signed documents](#14-signed-documents)
15. [Backups](#15-backups)
16. [Hors scope api-server (commandes Tauri Rust)](#16-hors-scope-api-server-commandes-tauri-rust)

---

## 1. Conventions générales

- **Stack serveur** : Bun + [Hono](https://hono.dev) v4.
- **Body** : JSON UTF-8. `Content-Type: application/json` obligatoire en POST/PATCH/PUT. Limite body = 10 MB (défaut Hono, à conserver).
- **Encodage IDs** : UUID v4 (36 chars, lowercase, tirets). Validation au middleware Zod.
- **Timestamps** : `number` (epoch millisecondes), jamais ISO string dans les payloads (aligné sur `@fakt/shared` TS).
- **Montants** : `number` en **centimes entiers** (`totalHtCents`, `unitPriceCents`, etc.). Jamais de float.
- **Pagination** : `?limit=50&offset=0` (défaut limit=50, max 200). Réponse liste = tableau brut, pas d'enveloppe (aligné sur queries Drizzle).
- **Soft delete** : exposé via `archivedAt: number | null`. DELETE `/:id` = soft delete. POST `/:id/restore` = remet `archivedAt = null`.
- **Version réponse** : chaque réponse attache header `X-FAKT-Api-Version: 0.1.0`.
- **Logging** : middleware Hono `logger()` en mode dev ; en prod (bundle Tauri), logs JSON structurés vers stdout (consommés par Tauri via `Command::spawn`).
- **Routes REST strictes** : une ressource = une route. Les transitions métier passent par sous-routes verbales (`/:id/issue`, `/:id/mark-paid`), pas par un champ `status` PATCH.

## 2. Authentification

Tous les endpoints (sauf `/health`) exigent le header :

```
X-FAKT-Token: <bearer-token>
```

- Le token est généré au démarrage du sidecar Tauri (crypto random 32 octets hex → 64 chars), injecté dans le webview via `window.__FAKT_API_TOKEN` via script d'initialisation (`initializationScript` dans `tauri.conf.json`).
- Middleware Hono : `auth()` vérifie présence + égalité constante (`crypto.timingSafeEqual`). Token absent ou incorrect → `401 Unauthorized`.
- En mode 2 (self-host) et mode 3 (SaaS) v0.2 : le token deviendra un JWT signé issu d'un login utilisateur. v0.1 desktop solo = token process-scoped.

## 3. Format des erreurs

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "champ 'name' requis",
    "details": {
      "field": "name",
      "expected": "string non vide"
    }
  }
}
```

### Codes HTTP

| Code | Cas | Code erreur |
|---|---|---|
| 400 | Body JSON invalide, Zod refusé, IDs mal formés | `VALIDATION_ERROR` |
| 401 | Token absent ou incorrect | `UNAUTHORIZED` |
| 404 | Ressource non trouvée (`getX` returne null) | `NOT_FOUND` |
| 409 | Contrainte UNIQUE violée (numbering, email client) | `CONFLICT` |
| 422 | Transition métier interdite (canTransitionQuote/Invoice false) | `INVALID_TRANSITION` |
| 500 | Exception non capturée côté Drizzle/SQLite | `INTERNAL_ERROR` |

### Validation Zod partagée

Les schémas Zod vivent dans `packages/api-server/src/schemas/` (nouveau, jumeau léger des `Create*Input`/`Update*Input` TS). Les queries restent indépendantes de Zod.

### Logging des erreurs

Toute erreur `500` est logguée avec stack, request-id (UUID v4 généré par middleware), path + méthode. Jamais leak du stack dans la réponse JSON : le client reçoit uniquement `{code, message}`.

## 4. Endpoint healthcheck

Le seul endpoint non authentifié. Utilisé par Tauri Rust pour confirmer que le sidecar est prêt à accepter du trafic avant de charger le webview React.

### GET /health

**Request** : aucune.

**Response 200** :

```json
{
  "status": "ok",
  "version": "0.1.0",
  "dbReady": true,
  "startedAt": 1745328000000,
  "uptimeMs": 12345
}
```

- `dbReady` : `true` si `createDb()` a renvoyé une instance sans throw au boot + ping SELECT 1 OK.
- `uptimeMs` : `Date.now() - startedAt`.

**Response 503** (si DB pas prête, erreur au boot) :

```json
{ "status": "degraded", "version": "0.1.0", "dbReady": false, "error": "sqlite: unable to open database" }
```

Aucun middleware auth. Aucun middleware logger (polling ping).

---

## 5. Workspace

Singleton mono-user v0.1. Créé au premier onboarding.

### GET /api/workspace

Récupère le workspace courant. Utilisé par `getWorkspace` Drizzle (`packages/db/src/queries/settings.ts::getWorkspace`).

**Response 200 (workspace existe)** :

```json
{
  "id": "8a4e...",
  "name": "Atelier Mercier",
  "legalForm": "micro-entreprise",
  "siret": "12345678901234",
  "address": "12 rue des Oliviers, 84000 Avignon",
  "email": "contact@atelier-mercier.fr",
  "iban": "FR76 3000 ...",
  "tvaMention": "TVA non applicable, art. 293 B du CGI",
  "createdAt": 1745328000000
}
```

**Response 404** (premier lancement, pas d'onboarding terminé) :

```json
{ "error": { "code": "NOT_FOUND", "message": "workspace non initialisé" } }
```

- Middlewares : auth.
- Drizzle : `getWorkspace(db)`.

### POST /api/workspace

Crée le workspace au premier onboarding (uniquement si aucun workspace n'existe déjà). **Nouveau endpoint** non présent dans les queries actuelles — nécessite d'ajouter `createWorkspace(db, input)` dans `packages/db/src/queries/settings.ts`.

**Body** :

```json
{
  "id": "uuid-v4-généré-cote-client",
  "name": "Atelier Mercier",
  "legalForm": "micro-entreprise",
  "siret": "12345678901234",
  "address": "12 rue des Oliviers, 84000 Avignon",
  "email": "contact@atelier-mercier.fr",
  "iban": "FR76 3000 ...",
  "tvaMention": "TVA non applicable, art. 293 B du CGI"
}
```

Tous les champs requis sauf `iban`. `tvaMention` par défaut = `"TVA non applicable, art. 293 B du CGI"` (cf schema).

**Response 201** : Workspace créé (même shape que GET).

**Response 409** (workspace existe déjà) :

```json
{ "error": { "code": "CONFLICT", "message": "workspace déjà initialisé, utiliser PATCH /api/workspace" } }
```

- Middlewares : auth + Zod.
- Drizzle : **nouveau** `createWorkspace(db, input)` à ajouter.

### PATCH /api/workspace

Met à jour le workspace existant. Résout le gap `update_workspace` absent du lib.rs qui bloque le wizard onboarding RecapStep.

**Body** (tous les champs optionnels) :

```json
{
  "name": "Atelier Mercier SAS",
  "legalForm": "SAS",
  "siret": "...",
  "address": "...",
  "email": "...",
  "iban": "FR76 ...",
  "tvaMention": "..."
}
```

**Response 200** : Workspace mis à jour.

**Response 404** (workspace inexistant — onboarding pas fait) : voir format standard.

- Middlewares : auth + Zod.
- Drizzle : `updateWorkspace(db, workspaceId, input)` (le `workspaceId` est récupéré via `getWorkspace` en amont dans le handler — c'est un singleton).

---

## 6. Settings

Key-value store par workspace (AI provider, TSA URL, etc.).

### GET /api/settings

Liste toutes les paires key/value du workspace courant.

**Response 200** :

```json
[
  { "key": "ai.provider", "value": "claude-cli" },
  { "key": "tsa.url", "value": "https://freetsa.org/tsr" },
  { "key": "telemetry.optIn", "value": "false" }
]
```

- Drizzle : `getAllSettings(db, workspaceId)`.

### GET /api/settings/:key

Récupère une valeur par clé. Retourne 404 si absent.

**Response 200** :

```json
{ "key": "ai.provider", "value": "claude-cli" }
```

- Drizzle : `getSetting(db, workspaceId, key)`.

### PUT /api/settings/:key

Upsert (crée ou remplace).

**Body** :

```json
{ "value": "anthropic-api" }
```

**Response 200** :

```json
{ "key": "ai.provider", "value": "anthropic-api" }
```

- Drizzle : `setSetting(db, workspaceId, key, value)`.

---

## 7. Clients

CRUD complet + restore (soft delete seulement, aucun hard delete — documents liés).

Correspondance Drizzle : `packages/db/src/queries/clients.ts`.

### GET /api/clients

Liste les clients du workspace.

**Query params** :

- `search?: string` — LIKE `%name%` ou `%email%`.
- `includeSoftDeleted?: "true" | "false"` (défaut `false`).
- `limit?: number` (défaut 50, max 200).
- `offset?: number` (défaut 0).

**Response 200** :

```json
[
  {
    "id": "8a4e...",
    "workspaceId": "...",
    "name": "Client A",
    "legalForm": "SAS",
    "siret": "...",
    "address": "...",
    "contactName": "...",
    "email": "...",
    "sector": "Tech",
    "firstCollaboration": 1745328000000,
    "note": "...",
    "archivedAt": null,
    "createdAt": 1745328000000
  }
]
```

- Drizzle : `listClients(db, { workspaceId, search, includeSoftDeleted, limit, offset })`.

### GET /api/clients/:id

**Response 200** : Client JSON (même shape).

**Response 404** : not found.

- Drizzle : `getClient(db, id)`.

### POST /api/clients

Crée un client.

**Body** (aligné `CreateClientInput` `clients.ts:21`) :

```json
{
  "id": "uuid-v4-genere-cote-client",
  "name": "Client A",
  "legalForm": "SAS",
  "siret": "12345678901234",
  "address": "...",
  "contactName": "...",
  "email": "contact@client-a.fr",
  "sector": "Tech",
  "firstCollaboration": 1745328000000,
  "note": "..."
}
```

Note : `workspaceId` **n'est pas dans le body** — récupéré server-side depuis `getWorkspace()` (singleton v0.1). Si v0.2 multi-workspace, ajout d'un header `X-FAKT-Workspace-Id`.

**Response 201** : Client créé (shape GET).

**Response 409** : contrainte `clients_email_ws_uq` violée (même email pour ce workspace).

- Middlewares : auth + Zod (`name` requis, email format, SIRET 14 chiffres si fourni).
- Drizzle : `createClient(db, { ...body, workspaceId })`.

### PATCH /api/clients/:id

Met à jour un client.

**Body** (tous optionnels, `UpdateClientInput` `clients.ts:35`) :

```json
{
  "name": "Client A renommé",
  "legalForm": null,
  "note": "Nouvelle note"
}
```

**Response 200** : Client mis à jour.

**Response 404** : not found.

- Drizzle : `updateClient(db, id, input)`.

### DELETE /api/clients/:id

Soft delete (archivage).

**Response 204** : no content.

**Response 404** : client inexistant ou déjà archivé.

- Drizzle : `softDeleteClient(db, id)`.

### POST /api/clients/:id/restore

Désarchive.

**Response 200** : Client restauré.

**Response 404** : not found.

**Drizzle** : **nouveau** `restoreClient(db, id)` à ajouter — un simple `update(clients).set({archivedAt: null}).where(eq(clients.id, id))`. Les hooks actuels (`useClients.ts:100-107`) appellent UPDATE_CLIENT avec `{restore: true}` — à refactorer pour appeler cette nouvelle route POST.

### GET /api/clients/search?q=...

Recherche rapide (20 résultats max) — utilisé par autocomplete ClientPicker.

**Response 200** : Client[].

- Drizzle : `searchClients(db, workspaceId, q)`.

---

## 8. Prestations / services

CRUD + restore. Table `services` dans le schéma.

Correspondance Drizzle : `packages/db/src/queries/prestations.ts`.

### GET /api/services

**Query params** : `search`, `includeSoftDeleted`, `limit`, `offset`.

**Response 200** :

```json
[
  {
    "id": "...",
    "workspaceId": "...",
    "name": "Développement React",
    "description": "Implémentation d'un composant React",
    "unit": "jour",
    "unitPriceCents": 50000,
    "tags": ["frontend", "react"],
    "archivedAt": null,
    "createdAt": 1745328000000
  }
]
```

`unit` ∈ `"forfait" | "jour" | "heure" | "unité" | "mois" | "semaine"` (cf schema).

- Drizzle : `listPrestations(db, input)`.

### GET /api/services/:id

- Drizzle : `getPrestation(db, id)`.

### POST /api/services

**Body** (`CreatePrestationInput` `prestations.ts:21`) :

```json
{
  "id": "uuid",
  "name": "Développement React",
  "description": "...",
  "unit": "jour",
  "unitPriceCents": 50000,
  "tags": ["frontend"]
}
```

**Response 201** : Service créé.

- Middleware Zod : `unit` enum, `unitPriceCents >= 0`.
- Drizzle : `createPrestation(db, { ...body, workspaceId })`.

### PATCH /api/services/:id

**Body** : tous champs optionnels.

- Drizzle : `updatePrestation(db, id, input)`.

### DELETE /api/services/:id

Soft delete.

- Drizzle : `softDeletePrestation(db, id)`.

### POST /api/services/:id/restore

**Drizzle** : **nouveau** `restorePrestation(db, id)` à ajouter.

### GET /api/services/search?q=...

- Drizzle : `searchPrestations(db, workspaceId, q)`.

---

## 9. Numbering

Numérotation séquentielle CGI art. 289. Critique : unicité DB UNIQUE(workspace, year, type, sequence).

Correspondance Drizzle : `packages/db/src/queries/numbering.ts`.

### GET /api/numbering/peek?type=quote|invoice

Peek sans incrémenter. Utilisé par UI pour afficher « le prochain devis sera D2026-007 » avant création.

**Query params** :

- `type: "quote" | "invoice"` (requis).

**Response 200** :

```json
{ "year": 2026, "sequence": 7, "formatted": "D2026-007" }
```

- Drizzle : `peekNextNumber(db, workspaceId, type)`.

### POST /api/numbering/next

**Body** :

```json
{ "type": "quote" }
```

Incrémente atomiquement et retourne. Appelé au moment de `issueQuote` ou `issueInvoice` — pas de endpoint séparé `POST /api/quotes/:id/issue` qui appelle numbering interne. Le handler `issue` peut invoquer ce helper en interne sans passer par HTTP.

**Response 200** :

```json
{ "year": 2026, "sequence": 7, "formatted": "D2026-007" }
```

**Note atomicité** : en mode solo-local mono-user v0.1, le stub Drizzle (`numbering.ts`) est non-atomique mais suffisant (une seule connexion SQLite active). En mode 2 (self-host multi-agents) et mode 3 (SaaS), le sidecar Bun héberge la logique DB et devient lui-même le point d'atomicité — une requête HTTP à la fois via `better-sqlite3` synchrone (single-threaded). Acceptable.

**Alternative long-terme** : migration vers `BEGIN IMMEDIATE` SQL explicite dans `packages/db/src/queries/numbering.ts` (TODO existant, Wave 2). Ne change pas les endpoints.

- Drizzle : `nextQuoteNumber(db, workspaceId)` ou `nextInvoiceNumber(db, workspaceId)`.
- **Response 409** si contrainte UNIQUE violée (sequence existant).

---

## 10. Quotes (devis)

Cycle de vie : `draft → sent → viewed → signed → invoiced` (+ transitions refused / expired).

Correspondance Drizzle : `packages/db/src/queries/quotes.ts`. Transitions validées via `canTransitionQuote` de `@fakt/core`.

### GET /api/quotes

**Query params** :

- `status?: QuoteStatus | "draft,sent,signed"` (CSV multi).
- `clientId?: UUID`.
- `includeArchived?: "true" | "false"`.
- `limit`, `offset`.

**Response 200** : `Quote[]` avec items joints (cf `rowToQuote` `quotes.ts:64`).

```json
[
  {
    "id": "...",
    "workspaceId": "...",
    "clientId": "...",
    "number": "D2026-007",
    "year": 2026,
    "sequence": 7,
    "title": "Refonte site",
    "status": "sent",
    "totalHtCents": 150000,
    "conditions": "...",
    "validityDate": 1747920000000,
    "notes": "...",
    "issuedAt": 1745328000000,
    "signedAt": null,
    "archivedAt": null,
    "createdAt": 1745328000000,
    "updatedAt": 1745328000000,
    "items": [
      {
        "id": "...",
        "position": 1,
        "description": "Design UI",
        "quantity": 3000,
        "unitPriceCents": 50000,
        "unit": "jour",
        "lineTotalCents": 150000,
        "serviceId": null
      }
    ]
  }
]
```

Note : `quantity` est stocké en milli-unités (`quantity_milli` dans le schéma `quoteItems`). `3000` = 3.0 jours, `3500` = 3.5 jours. L'UI fait la conversion.

- Drizzle : `listQuotes(db, input)`.

### GET /api/quotes/:id

**Response 200** : Quote avec items.

**Response 404** : not found.

- Drizzle : `getQuote(db, id)`.

### POST /api/quotes

Crée un devis **en draft** (status initial). Pas d'attribution de numéro à la création — ça se fait sur `issue` (transition sent).

**Body** (`CreateQuoteInput` `quotes.ts:35`) :

```json
{
  "id": "uuid",
  "clientId": "uuid",
  "title": "Refonte site",
  "conditions": "Paiement 30 jours",
  "validityDate": 1747920000000,
  "notes": "...",
  "totalHtCents": 150000,
  "items": [
    {
      "id": "uuid",
      "position": 1,
      "description": "Design UI",
      "quantity": 3000,
      "unitPriceCents": 50000,
      "unit": "jour",
      "lineTotalCents": 150000,
      "serviceId": null
    }
  ]
}
```

**Response 201** : Quote créé, `status = "draft"`, `number = null`.

**Response 409** : FK `clientId` inexistant.

- Drizzle : `createQuote(db, { ...body, workspaceId })`.

### PATCH /api/quotes/:id

Met à jour titre, conditions, items, etc. Uniquement autorisé si `status === "draft"`. Handler vérifie en amont via SELECT → retourne `422 INVALID_TRANSITION` sinon.

**Body** (`UpdateQuoteInput` `quotes.ts:47`) :

```json
{
  "clientId": "...",
  "title": "...",
  "totalHtCents": 200000,
  "items": [...]
}
```

**Response 200** : Quote mis à jour.

- Drizzle : `updateQuote(db, id, input)`.

### DELETE /api/quotes/:id

Hard delete — uniquement si status `draft` (cf `deleteQuote` `quotes.ts:242`).

**Response 204** : no content.

**Response 422** : quote non draft.

- Drizzle : `deleteQuote(db, id)`.

### POST /api/quotes/:id/issue

Transition `draft → sent`. Attribue le numéro séquentiel, set `issuedAt`.

Handler :
1. Lire le quote (vérifier status === "draft").
2. Appeler `nextQuoteNumber(db, workspaceId)` → `{year, sequence, formatted}`.
3. `updateQuote(db, id, { number: formatted, year, sequence })`.
4. `updateQuoteStatus(db, id, "sent")` — set status + issuedAt.
5. Retourner le Quote rechargé.

**Response 200** : Quote avec number attribué.

**Response 422** : not in draft status.

**Response 409** : conflit numérotation (rare, race condition).

- Drizzle : `nextQuoteNumber` + `updateQuote` + `updateQuoteStatus`.

### POST /api/quotes/:id/expire

Transition `sent → expired` (ex: validité dépassée).

**Response 200** : Quote mis à jour.

**Response 422** : transition invalide.

- Drizzle : `updateQuoteStatus(db, id, "expired")`.

### POST /api/quotes/:id/cancel

Transition vers `refused`.

- Drizzle : `updateQuoteStatus(db, id, "refused")`.

### POST /api/quotes/:id/mark-signed

Transition `sent → signed`. Set `signedAt`. Appelé par le handler Tauri Rust `sign_document` en fin de signature réussie.

**Response 200** : Quote signé.

- Drizzle : `updateQuoteStatus(db, id, "signed")`.

### POST /api/quotes/:id/mark-invoiced

Transition `signed → invoiced`. Appelé automatiquement lors de `createInvoiceFromQuote`. Remplace l'ancien stub `mark_quote_invoiced` Rust (`cycle.rs:41-49`).

**Response 200** : Quote `status = "invoiced"`.

- Drizzle : `updateQuoteStatus(db, id, "invoiced")`.

### GET /api/quotes/:id/preview-next-number

Alias pratique qui wrappe `GET /api/numbering/peek?type=quote`. Utilisé par l'UI Devis pour afficher avant issue. Strictement équivalent — l'UI peut aussi appeler `/api/numbering/peek` directement. Optionnel.

### GET /api/quotes/search?q=...

- Drizzle : `searchQuotes(db, workspaceId, q)`.

---

## 11. Invoices (factures)

Cycle : `draft → sent → paid` (+ overdue, cancelled).

Règle critique : hard delete interdit si status ≠ draft (guard TS + trigger SQL `0001_triggers.sql`).

Correspondance Drizzle : `packages/db/src/queries/invoices.ts`.

### GET /api/invoices

**Query params** : `status`, `clientId`, `quoteId`, `includeArchived`, `limit`, `offset`.

**Response 200** : `Invoice[]` avec items.

```json
[
  {
    "id": "...",
    "workspaceId": "...",
    "clientId": "...",
    "quoteId": "...",
    "number": "F2026-007",
    "year": 2026,
    "sequence": 7,
    "kind": "balance",
    "depositPercent": null,
    "title": "Refonte site - Solde",
    "status": "sent",
    "totalHtCents": 105000,
    "dueDate": 1747920000000,
    "paidAt": null,
    "paymentMethod": null,
    "legalMentions": "TVA non applicable, art. 293 B ...",
    "issuedAt": 1745328000000,
    "archivedAt": null,
    "createdAt": 1745328000000,
    "updatedAt": 1745328000000,
    "items": [...]
  }
]
```

- Drizzle : `listInvoices(db, input)`.

### GET /api/invoices/:id

- Drizzle : `getInvoice(db, id)`.

### POST /api/invoices

Crée une facture **indépendante** (non issue d'un devis). Corresponds à `CREATE_INVOICE_INDEPENDENT` TS.

**Body** (`CreateInvoiceInput` `invoices.ts:38`, avec `quoteId: null`) :

```json
{
  "id": "uuid",
  "clientId": "uuid",
  "quoteId": null,
  "kind": "independent",
  "depositPercent": null,
  "title": "Facture ad-hoc",
  "totalHtCents": 50000,
  "dueDate": 1747920000000,
  "legalMentions": "TVA non applicable, art. 293 B du CGI\nPénalités retard: ...",
  "items": [...]
}
```

`kind` ∈ `"deposit" | "balance" | "total" | "independent"`.

`legalMentions` = texte complet des mentions obligatoires (fourni par `packages/legal/src/mentions.ts` côté frontend, copié en clair dans le body). Immutable côté backend — garantit preuve d'archivage.

**Response 201** : Invoice créée en `status = "draft"`, `number = null`.

- Drizzle : `createInvoice(db, { ...body, workspaceId })`.

### POST /api/invoices/from-quote

Crée une facture depuis un devis signé. 3 modes : `deposit30`, `balance`, `full`.

**Body** :

```json
{
  "id": "uuid-nouvelle-facture",
  "quoteId": "uuid-devis-source",
  "mode": "deposit30",
  "legalMentions": "...",
  "dueDate": 1747920000000
}
```

Handler :
1. `createInvoiceFromQuote(db, newInvoiceId, quoteId, mode, legalMentions)` (copie lignes, applique ratio).
2. Optionnel : override `dueDate` si fourni (update ensuite).
3. Retourner Invoice.

**Response 201** : Invoice créée.

**Response 404** : `quoteId` inexistant.

**Response 422** : quote pas en status `signed`, ou mode `balance` avec solde négatif (`createInvoiceFromQuote` throw).

- Drizzle : `createInvoiceFromQuote(db, newInvoiceId, quoteId, mode, legalMentions)`.

### PATCH /api/invoices/:id

Met à jour titre, items, legalMentions — uniquement si `status === "draft"`. Sinon `422`.

**Body** (`UpdateInvoiceInput` `invoices.ts:52`) :

```json
{
  "clientId": "...",
  "title": "...",
  "totalHtCents": 60000,
  "items": [...]
}
```

**Response 200** : Invoice mise à jour.

- Drizzle : `updateInvoice(db, id, input)`.

### DELETE /api/invoices/:id

Hard delete — uniquement si `status === "draft"` (cf `cannotDeleteIssued`). Trigger SQL `invoices_no_hard_delete_issued` double check. Résout le stub `delete_invoice` Rust (`cycle.rs:82-90`).

**Response 204** : no content.

**Response 422** : invoice émise, suppression interdite.

- Drizzle : **à ajouter** `deleteInvoice(db, id)` dans `invoices.ts` (pattern identique à `deleteQuote`). Actuellement absent.

### POST /api/invoices/:id/issue

Transition `draft → sent`. Attribue numéro `F{year}-{NNN}`, set `issuedAt`.

Handler :
1. Vérifier status draft.
2. `nextInvoiceNumber(db, workspaceId)`.
3. `updateInvoice(db, id, { number, year, sequence })`.
4. Transition status via **nouvelle** `updateInvoiceStatus(db, id, "sent")` — à ajouter dans `invoices.ts` (pattern `updateQuoteStatus`).

**Response 200** : Invoice émise.

- Drizzle : `nextInvoiceNumber` + `updateInvoice` + **nouveau** `updateInvoiceStatus`.

### POST /api/invoices/:id/mark-sent

Équivalent à `/issue` côté renderer — l'UI peut déjà avoir un numéro assigné (ex: facture bounced-back par Claude CLI et déjà numérotée). Alternative plus permissive. À unifier : **recommandation PM** → supprimer `/mark-sent` et garder uniquement `/issue`. Résout le stub `mark_invoice_sent` Rust (`cycle.rs:52-60`).

### POST /api/invoices/:id/mark-paid

Transition `sent → paid` ou `overdue → paid`. Set `paidAt`, `paymentMethod`, et **ajout v0.1** `paymentNotes` (gap identifié audit).

**Body** :

```json
{
  "paidAt": 1745328000000,
  "method": "virement",
  "notes": "Payé en retard, relance 1 envoyée le 15/04"
}
```

`method` ∈ `"virement" | "chèque" | "espèces" | "carte" | "autre"` (PaymentMethod TS).

**Response 200** : Invoice `status = "paid"`.

**Response 422** : transition invalide.

**Gap DB à combler** :
- **Migration** : ajouter colonne `payment_notes: text | null` dans table `invoices` (`packages/db/migrations/0002_payment_notes.sql` nouveau fichier).
- **Query** : étendre `markInvoicePaid(db, id, paidAt, method, notes?)`.
- **Mapper** : ajouter `paymentNotes` dans `Invoice` TS (`@fakt/shared`).

- Drizzle : `markInvoicePaid(db, id, paidAt, method, notes)` (signature mise à jour).

### POST /api/invoices/:id/archive

Archive la facture (soft delete — mais la facture reste légalement conservée 10 ans). Set `archivedAt`.

**Response 200** : Invoice archivée.

**Drizzle** : **nouveau** `archiveInvoice(db, id)` à ajouter — `update(invoices).set({archivedAt: Date.now()}).where(...)`. Pas de hard delete jamais.

### POST /api/invoices/:id/mark-overdue

Transition automatique `sent → overdue` si `dueDate < now()`. Déclenché par cron scheduled task / job background dans sidecar.

- Drizzle : **nouveau** `updateInvoiceStatus(db, id, "overdue")`.

### POST /api/invoices/:id/cancel

Transition vers `cancelled` (facture erronée — pattern contre-facture à terme, v0.2).

- Drizzle : `updateInvoiceStatus(db, id, "cancelled")`.

### GET /api/invoices/search?q=...

**Nouveau** : à ajouter dans `invoices.ts` (pattern `searchQuotes`).

---

## 12. Activity feed

Journal d'événements métier affiché dans la sidebar. Table `activity`.

**Gap identifié** : table existe dans le schéma (`schema/index.ts:240`), mais aucune query dans `packages/db/src/queries/`. À créer : `packages/db/src/queries/activity.ts`.

### GET /api/activity

Liste paginée, ordre desc createdAt.

**Query params** : `limit`, `offset`, `entityType?`, `entityId?`.

**Response 200** :

```json
[
  {
    "id": "...",
    "workspaceId": "...",
    "type": "quote.signed",
    "entityType": "quote",
    "entityId": "...",
    "payload": "{\"quoteNumber\":\"D2026-007\"}",
    "createdAt": 1745328000000
  }
]
```

`type` enum libre (event name) : `"client.created"`, `"quote.issued"`, `"quote.signed"`, `"invoice.issued"`, `"invoice.paid"`, `"email.drafted"`, `"backup.created"`.

- Drizzle : **nouveau** `listActivity(db, input)` à ajouter.

### POST /api/activity

Insère un event (utilisé par les autres handlers du api-server, pas appelé directement par le frontend).

**Body** :

```json
{
  "id": "uuid",
  "type": "quote.signed",
  "entityType": "quote",
  "entityId": "...",
  "payload": "{\"quoteNumber\":\"D2026-007\"}"
}
```

**Response 201** : Activity créée.

- Drizzle : **nouveau** `insertActivity(db, input)` à ajouter.

**Note** : certains handlers (ex: `POST /api/quotes/:id/issue`, `POST /api/invoices/:id/mark-paid`) appellent ce helper interne pour auto-logger. Le frontend consomme uniquement GET.

---

## 13. Signature events (audit append-only)

Chaîne de hash SHA-256, jamais d'UPDATE ou DELETE (trigger SQL).

Correspondance Drizzle : `packages/db/src/queries/signatures.ts`.

### GET /api/signature-events

Liste par document.

**Query params** :

- `documentType: "quote" | "invoice"` (requis).
- `documentId: UUID` (requis).

**Response 200** : `SignatureEvent[]` ordonnés par timestamp asc.

```json
[
  {
    "id": "...",
    "documentType": "quote",
    "documentId": "...",
    "signerName": "Tom Andrieu",
    "signerEmail": "tom@atelier-mercier.fr",
    "ipAddress": null,
    "userAgent": null,
    "timestamp": 1745328000000,
    "docHashBefore": "abc123...",
    "docHashAfter": "def456...",
    "signaturePngBase64": "iVBOR...",
    "previousEventHash": null,
    "tsaResponse": "base64-der-tsr...",
    "tsaProvider": "freetsa.org"
  }
]
```

- Drizzle : `getSignatureChain(db, documentType, documentId)`.

### POST /api/signature-events

**Append only**. Aucun PATCH/DELETE n'existe pour cette ressource — le trigger SQL `signature_events_no_update` / `signature_events_no_delete` rejette toute tentative.

**Body** (`AppendSignatureEventInput` `signatures.ts:17`) :

```json
{
  "id": "uuid",
  "documentType": "quote",
  "documentId": "...",
  "signerName": "...",
  "signerEmail": "...",
  "ipAddress": null,
  "userAgent": null,
  "timestamp": 1745328000000,
  "docHashBefore": "...",
  "docHashAfter": "...",
  "signaturePngBase64": "...",
  "previousEventHash": null,
  "tsaResponse": "...",
  "tsaProvider": "freetsa.org"
}
```

**Response 201** : Event créé.

**Response 500** : trigger SQL a bloqué (ne devrait jamais arriver en INSERT).

- Middlewares : auth + Zod (validation stricte hash = hex 64 chars, base64 valide).
- Drizzle : `appendSignatureEvent(db, input)`.

### GET /api/signature-events/verify

Vérifie la chaîne complète pour un document (intégrité SHA-256 événements consécutifs).

**Query params** :

- `documentType`, `documentId`.

**Response 200** :

```json
{
  "documentType": "quote",
  "documentId": "...",
  "chainOk": true,
  "chainLength": 2,
  "brokenChainIndices": []
}
```

Handler :
1. `getSignatureChain(db, type, id)`.
2. Pour chaque event (i>0), recalculer `sha256(serialize(events[i-1]))` et vérifier `== events[i].previousEventHash`.
3. Retourner report.

- Drizzle : `getSignatureChain` + logique in-handler.

**Note** : cette route retourne uniquement le report chaîne interne. La vérification cryptographique complète (hash PDF before/after, signature RSA, validité TSA RFC 3161) reste côté Tauri Rust (`verify_signature` command) car elle nécessite de parser le CMS PAdES dans le PDF — le sidecar Bun ne manipule pas le PDF signé binaire.

---

## 14. Signed documents

PDF signés. Table `signed_documents`.

**Gap identifié** : pas de query actuelle dans `packages/db/src/queries/`. À créer : `packages/db/src/queries/signed-documents.ts`.

### GET /api/signed-documents/:documentType/:documentId

Récupère les métadonnées du PDF signé (path sur disque, niveau PAdES, TSA provider).

**Response 200** :

```json
{
  "documentType": "quote",
  "documentId": "...",
  "path": "/home/tom/.local/share/fakt/signed/quote-abc123.pdf",
  "padesLevel": "B-T",
  "tsaProvider": "freetsa.org",
  "signedAt": 1745328000000,
  "signatureEventId": "..."
}
```

**Response 404** : pas de signature enregistrée pour ce document.

- Drizzle : **nouveau** `getSignedDocument(db, documentType, documentId)`.

### POST /api/signed-documents

Enregistre les métadonnées d'un PDF signé. Appelé par le handler Rust `sign_document` après écriture disque du PDF.

**Body** :

```json
{
  "documentType": "quote",
  "documentId": "...",
  "path": "/home/.../signed/quote-abc123.pdf",
  "padesLevel": "B-T",
  "tsaProvider": "freetsa.org",
  "signedAt": 1745328000000,
  "signatureEventId": "..."
}
```

**Response 201** : enregistrement créé.

**Response 409** : document déjà signé (contrainte PK `documentType,documentId` — table `signed_documents_pk`).

- Drizzle : **nouveau** `upsertSignedDocument(db, input)` avec `onConflictDoUpdate`.

### GET /api/signed-documents/:documentType/:documentId/bytes

**Hors scope api-server — cf section 16**. Le transfert binaire des PDF reste côté Rust via `get_signed_pdf` command Tauri. L'api-server ne manipule **pas** les fichiers PDF — éviter de gonfler la RAM sidecar Bun avec des bytes.

---

## 15. Backups

Journal des exports workspace ZIP.

**Gap identifié** : table existe (`schema/index.ts:260`), pas de query. À créer : `packages/db/src/queries/backups.ts`.

### GET /api/backups

Liste ordre desc createdAt.

**Query params** : `limit`, `offset`.

**Response 200** :

```json
[
  {
    "id": "...",
    "path": "/home/tom/Documents/fakt-backup-2026-04-22.zip",
    "sizeBytes": 12345678,
    "createdAt": 1745328000000
  }
]
```

- Drizzle : **nouveau** `listBackups(db, input)`.

### POST /api/backups

Enregistre un backup fraîchement créé (côté Rust `build_workspace_zip` appelle ce endpoint après écriture disque réussie).

**Body** :

```json
{
  "id": "uuid",
  "path": "/home/tom/Documents/fakt-backup-2026-04-22.zip",
  "sizeBytes": 12345678
}
```

**Response 201** : Backup enregistré.

- Drizzle : **nouveau** `insertBackup(db, input)`.

### DELETE /api/backups/:id

Supprime l'entrée journal (ne supprime pas le fichier sur disque — l'utilisateur gère ça lui-même).

**Response 204**.

- Drizzle : **nouveau** `deleteBackup(db, id)`.

---

## 16. Hors scope api-server (commandes Tauri Rust)

Les ressources suivantes **ne passent PAS par le sidecar Bun**. Elles restent exposées via `invoke()` direct vers les commandes Tauri Rust parce qu'elles :
- Manipulent des fichiers binaires lourds (PDF bytes, ZIP archives).
- Nécessitent l'accès au keychain OS (lecture clé privée RSA).
- Nécessitent un plugin Tauri OS (dialog save, shell open).
- Sont locales au process desktop (jamais utilisées en mode 2/3 serveur).

### Liste des 10 commandes Rust conservées

| Command Rust | Rôle | Plugin Tauri requis |
|---|---|---|
| `render_pdf` | Subprocess Typst → PDF bytes | `tauri-plugin-shell` (déjà) |
| `generate_cert` | Génération cert X.509 RSA 4096 + stockage keychain | `keyring` crate |
| `get_cert_info` | Lecture métadonnées cert depuis keychain | `keyring` |
| `rotate_cert` | Rotation cert (génère nouveau + archive ancien) | `keyring` |
| `sign_document` | PAdES B-T orchestration (clé privée keychain → hash doc → CMS → TSA → PDF signé) | `keyring` + `reqwest` TSA |
| `verify_signature` | Parse CMS PAdES dans PDF + vérif crypto RSA + TSA | aucun (local) |
| `store_signed_pdf` | Écrit le PDF signé sur disque (filesystem) | `tauri-plugin-fs` (à ajouter) |
| `get_signed_pdf` | Lit le PDF signé depuis disque et retourne bytes | `tauri-plugin-fs` |
| `open_email_draft` | Génère .eml + ouvre client mail OS | `tauri-plugin-fs`, `tauri-plugin-path` |
| `open_mailto_fallback` | Fallback `mailto:` | `tauri-plugin-shell` |
| `build_workspace_zip` | Génère ZIP workspace (CSV + PDFs signés + README) | crate `zip` + `tauri-plugin-dialog` (save path) |

**NB** : après création ZIP, le handler Rust appelle `POST /api/backups` via `reqwest` → l'entrée DB est créée côté api-server. Même pattern pour `sign_document` qui appelle `POST /api/signature-events` + `POST /api/signed-documents` + `POST /api/quotes/:id/mark-signed`.

### Commandes Rust à supprimer ou remplacer

Ces commandes deviennent obsolètes dès que l'api-server est en place :

| Command | Remplacée par |
|---|---|
| `mark_quote_invoiced` (stub `cycle.rs:41`) | `POST /api/quotes/:id/mark-invoiced` |
| `mark_invoice_sent` (stub `cycle.rs:52`) | `POST /api/invoices/:id/issue` |
| `update_invoice` (stub `cycle.rs:70`) | `PATCH /api/invoices/:id` |
| `delete_invoice` (stub `cycle.rs:82`) | `DELETE /api/invoices/:id` |
| `numbering_next_quote`, `numbering_next_invoice` | `POST /api/numbering/next` |
| `append_signature_event` | `POST /api/signature-events` |
| `get_signature_events` | `GET /api/signature-events` |
| `update_workspace` (ajouté ce matin) | `PATCH /api/workspace` |
| `get_workspace` | `GET /api/workspace` |

### Commandes Rust à ajouter

Aucune. Les 11 commandes Rust conservées couvrent toute la surface « OS / crypto / binaires ».

---

## Annexe A — Cartographie queries → endpoints

| Drizzle query (packages/db/src/queries/) | Endpoint api-server |
|---|---|
| `getWorkspace` | GET /api/workspace |
| `updateWorkspace` | PATCH /api/workspace |
| **nouveau** `createWorkspace` | POST /api/workspace |
| `getSetting` | GET /api/settings/:key |
| `getAllSettings` | GET /api/settings |
| `setSetting` | PUT /api/settings/:key |
| `listClients` | GET /api/clients |
| `getClient` | GET /api/clients/:id |
| `createClient` | POST /api/clients |
| `updateClient` | PATCH /api/clients/:id |
| `softDeleteClient` | DELETE /api/clients/:id |
| `searchClients` | GET /api/clients/search |
| **nouveau** `restoreClient` | POST /api/clients/:id/restore |
| `listPrestations` | GET /api/services |
| `getPrestation` | GET /api/services/:id |
| `createPrestation` | POST /api/services |
| `updatePrestation` | PATCH /api/services/:id |
| `softDeletePrestation` | DELETE /api/services/:id |
| `searchPrestations` | GET /api/services/search |
| **nouveau** `restorePrestation` | POST /api/services/:id/restore |
| `nextQuoteNumber` / `nextInvoiceNumber` | POST /api/numbering/next |
| `peekNextNumber` | GET /api/numbering/peek |
| `listQuotes` | GET /api/quotes |
| `getQuote` | GET /api/quotes/:id |
| `createQuote` | POST /api/quotes |
| `updateQuote` | PATCH /api/quotes/:id |
| `deleteQuote` | DELETE /api/quotes/:id |
| `updateQuoteStatus` | POST /api/quotes/:id/issue, /expire, /cancel, /mark-signed, /mark-invoiced |
| `searchQuotes` | GET /api/quotes/search |
| `listInvoices` | GET /api/invoices |
| `getInvoice` | GET /api/invoices/:id |
| `createInvoice` | POST /api/invoices |
| `createInvoiceFromQuote` | POST /api/invoices/from-quote |
| `updateInvoice` | PATCH /api/invoices/:id |
| **nouveau** `deleteInvoice` | DELETE /api/invoices/:id |
| `markInvoicePaid` (étendu notes) | POST /api/invoices/:id/mark-paid |
| **nouveau** `updateInvoiceStatus` | POST /api/invoices/:id/issue, /mark-overdue, /cancel |
| **nouveau** `archiveInvoice` | POST /api/invoices/:id/archive |
| **nouveau** `searchInvoices` | GET /api/invoices/search |
| `appendSignatureEvent` | POST /api/signature-events |
| `getSignatureChain` | GET /api/signature-events |
| **nouveau** (activity.ts) `listActivity`, `insertActivity` | GET /api/activity, POST /api/activity |
| **nouveau** (signed-documents.ts) `getSignedDocument`, `upsertSignedDocument` | GET, POST /api/signed-documents |
| **nouveau** (backups.ts) `listBackups`, `insertBackup`, `deleteBackup` | GET, POST, DELETE /api/backups |

## Annexe B — Décompte total endpoints

| Section | Endpoints |
|---|---|
| Healthcheck | 1 |
| Workspace | 3 |
| Settings | 3 |
| Clients | 7 |
| Services | 7 |
| Numbering | 2 |
| Quotes | 10 |
| Invoices | 12 |
| Activity | 2 |
| Signature events | 3 |
| Signed documents | 2 |
| Backups | 3 |
| **Total** | **55** |

55 endpoints REST au total. 11 commandes Tauri Rust conservées hors scope. 7 nouvelles queries Drizzle à ajouter (`createWorkspace`, `restoreClient`, `restorePrestation`, `deleteInvoice`, `updateInvoiceStatus`, `archiveInvoice`, `searchInvoices`) + 3 nouveaux fichiers queries (`activity.ts`, `signed-documents.ts`, `backups.ts`) + 1 migration (`0002_payment_notes.sql`).
