# FAKT v0.1.0 — Test Plan refacto API-server

**Auteur :** qa-strategist (Phase 1 — team `fakt-phase1-design`)
**Date :** 2026-04-22
**Cible :** tag `v0.1.0` release-blocking après refacto option C (sidecar Bun/Hono).
**Préalable :** lire `docs/refacto-spec/architecture.md` + `api-endpoints.md` + `task-breakdown.md`.

Ce document définit la **stratégie de test exhaustive** que Phase 2 (build) doit exécuter pour permettre le tag `v0.1.0`. Il couvre unit, intégration, E2E smoke, tests légaux FR, tests signature PAdES, smoke manuel, CI matrix et critères go/no-go.

---

## 0. Principes et contexte

### Pyramide de test

```
        ┌─────────────────────────────┐
        │  E2E smoke (1 happy-path)   │  ← Playwright + tauri-driver
        ├─────────────────────────────┤
        │  Intégration (roundtrip)    │  ← Vitest + SQLite tmpfile + HTTP
        ├─────────────────────────────┤
        │  Unit (handlers, queries)   │  ← Vitest + SQLite :memory:
        └─────────────────────────────┘
```

Existant (baseline) : **222 tests Vitest passent** dans `apps/desktop/src/**/*.test.{ts,tsx}` + `packages/*/src/__tests__/**/*.test.ts`. Cette baseline reste verte pendant toute la Phase 2.

### Outils imposés

- **Unit + Intégration TS :** Vitest (workspace déjà configuré).
- **Unit + Intégration Rust :** `cargo test` dans `apps/desktop/src-tauri/`.
- **E2E desktop :** Playwright `@playwright/test` + `tauri-driver` (cf. dette W4).
- **HTTP client de test :** `app.request()` natif de Hono (pas `supertest`, pas de boot serveur réseau).
- **DB de test :** `better-sqlite3` en `:memory:` (unit) ou `tmpfile` (intégration, test concurrence).
- **Mock fetch côté renderer :** `vi.spyOn(globalThis, "fetch")` ou `msw` si besoin (préférer `vi` pour simplicité).

### Couverture cible

| Package | Couverture exigée | Commande |
|---|---|---|
| `packages/api-server` | **≥ 80 %** (lines + branches) | `bun run --cwd packages/api-server test -- --coverage` |
| `packages/db` | **≥ 80 %** (déjà ~75 %, à atteindre) | idem |
| `packages/legal` | **≥ 90 %** (mentions critiques) | idem |
| `apps/desktop/src` | non bloquant, cible 70 % | `bun run --cwd apps/desktop test -- --coverage` |
| `apps/desktop/src-tauri` | **100 % des modules `crypto/*`** | `cargo tarpaulin` (optionnel v0.1.1) |

---

## 1. Tests unitaires

### 1.1 `packages/api-server/` — handlers HTTP

**Structure livrée (v0.1) :**
```
packages/api-server/
├── src/
│   ├── app.ts                # factory createApp(db): Hono
│   ├── routes/
│   │   ├── clients.ts
│   │   ├── services.ts
│   │   ├── quotes.ts
│   │   ├── invoices.ts
│   │   ├── workspace.ts
│   │   ├── numbering.ts
│   │   ├── signatures.ts
│   │   ├── activity.ts
│   │   ├── backups.ts
│   │   ├── health.ts
│   │   └── settings.ts
│   ├── middleware/
│   │   ├── auth.ts           # X-FAKT-Token header check (shared secret sidecar)
│   │   └── error.ts          # Zod → 400, not-found → 404, conflict → 409
│   └── schemas/              # Zod schemas partagés avec frontend
└── tests/
    ├── helpers.ts            # createTestApp() + seed
    ├── activity.test.ts
    ├── backups.test.ts
    ├── clients.test.ts
    ├── health.test.ts
    ├── invoices-from-quote.test.ts
    ├── invoices-legal.test.ts
    ├── invoices.test.ts
    ├── numbering-concurrency.test.ts
    ├── numbering.test.ts
    ├── quotes-cycle.test.ts
    ├── quotes.test.ts
    ├── services.test.ts
    ├── signatures-audit.test.ts
    └── workspace.test.ts
```

14 fichiers de tests sont livrés à la racine de `packages/api-server/tests/` (et pas sous
`src/__tests__/` comme originellement spec'é — l'emplacement a été ajusté en Phase 2 Build
pour s'aligner sur la convention Bun/Vitest par défaut).

**Helper `createTestApp()`** (réutilisable, créé en premier par l'agent Track α) :

```ts
// packages/api-server/tests/helpers.ts
import { createTestDb, seedWorkspace, WORKSPACE_ID } from "@fakt/db/__tests__/helpers";
import { createApp } from "../src/app.js";

export function createTestApp() {
  const { db, sqlite } = createTestDb();
  seedWorkspace(db);
  const app = createApp({ db, authToken: "test-token" });
  return { app, db, sqlite, token: "test-token" };
}

export function authHeaders(token: string) {
  return { "X-FAKT-Token": token };
}
```

Chaque handler HTTP doit couvrir **4 axes** :
1. **Validation Zod** : body / params / query invalides → `400` avec payload `{ error, issues }`.
2. **Query DB mockée ou réelle** : appel unique, arguments corrects.
3. **Mapping Drizzle → JSON** : dates `Date` → `number` (epoch ms), `null` explicite.
4. **Gestion erreurs** : `404` si entité absente, `409` si contrainte unique violée ou transition statut interdite, `500` avec body `{ error: "internal" }` (pas de stack leak).

#### Exemples de cas de test — clients

```ts
describe("POST /api/clients", () => {
  it("201 avec body valide", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ name: "CASA MIA", email: "claire@casamia.fr" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.archivedAt).toBeNull();
  });

  it("400 si SIRET invalide (Luhn KO)", async () => {
    const { app, token } = createTestApp();
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { ...authHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ name: "X", siret: "12345678901234" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues).toContainEqual(expect.objectContaining({ path: ["siret"] }));
  });

  it("401 sans header Authorization", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/clients", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("409 si email workspace+email existe déjà", async () => {
    // ... créer client initial puis retenter avec même email
    expect(res.status).toBe(409);
  });
});
```

#### Matrice handlers × cas à couvrir (minimum)

| Endpoint | 200/201 happy | 400 validation | 401 no-auth | 404 not-found | 409 conflict | 500 DB error |
|---|---|---|---|---|---|---|
| `POST /api/clients` | ✓ | ✓ | ✓ | — | ✓ unique email | ✓ |
| `GET /api/clients` | ✓ | — | ✓ | — | — | ✓ |
| `GET /api/clients/:id` | ✓ | ✓ uuid format | ✓ | ✓ | — | ✓ |
| `PATCH /api/clients/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/clients/:id/archive` | ✓ | — | ✓ | ✓ | — | ✓ |
| `POST /api/clients/:id/restore` | ✓ | — | ✓ | ✓ | — | ✓ |
| `POST /api/services` | ✓ | ✓ unitPrice ≥ 0 | ✓ | — | — | ✓ |
| `GET /api/services` | ✓ | — | ✓ | — | — | ✓ |
| `PATCH /api/services/:id` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `POST /api/services/:id/archive` | ✓ | — | ✓ | ✓ | — | ✓ |
| `POST /api/quotes` | ✓ | ✓ items non vide | ✓ | ✓ client | — | ✓ |
| `GET /api/quotes` | ✓ filtre status | — | ✓ | — | — | ✓ |
| `GET /api/quotes/:id` | ✓ avec items | ✓ | ✓ | ✓ | — | ✓ |
| `PATCH /api/quotes/:id` | ✓ draft seulement | ✓ | ✓ | ✓ | ✓ sent immuable | ✓ |
| `POST /api/quotes/:id/issue` | ✓ numéro attribué | — | ✓ | ✓ | ✓ déjà émis | ✓ |
| `POST /api/quotes/:id/cancel` | ✓ | — | ✓ | ✓ | ✓ transitions | ✓ |
| `POST /api/quotes/:id/expire` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `POST /api/quotes/:id/mark-signed` | ✓ | ✓ signed_at | ✓ | ✓ | ✓ pas sent | ✓ |
| `POST /api/invoices` | ✓ indépendante | ✓ mode | ✓ | ✓ client | — | ✓ |
| `POST /api/invoices/from-quote/:quoteId` | ✓ 3 modes | ✓ deposit % | ✓ | ✓ quote | ✓ quote non signé | ✓ |
| `GET /api/invoices` | ✓ | — | ✓ | — | — | ✓ |
| `PATCH /api/invoices/:id` | ✓ draft only | ✓ | ✓ | ✓ | ✓ issued immuable | ✓ |
| `POST /api/invoices/:id/issue` | ✓ numéro | — | ✓ | ✓ | ✓ | ✓ |
| `POST /api/invoices/:id/mark-paid` | ✓ notes persist | ✓ method enum | ✓ | ✓ | ✓ déjà paid | ✓ |
| `POST /api/invoices/:id/archive` | ✓ | — | ✓ | ✓ | — | ✓ |
| `DELETE /api/invoices/:id` | ✓ si draft | — | ✓ | ✓ | **✓ 409 si issued (légal)** | ✓ |
| `GET /api/workspace` | ✓ | — | ✓ | — | — | ✓ |
| `PATCH /api/workspace` | ✓ | ✓ SIRET Luhn | ✓ | — | — | ✓ |
| `GET /api/numbering/peek/:type` | ✓ | ✓ type enum | ✓ | — | — | ✓ |
| `POST /api/signatures/events` | ✓ | ✓ doc_hash hex | ✓ | ✓ doc | ✓ chain break | ✓ |
| `GET /api/signatures/events/:docId` | ✓ | — | ✓ | — | — | ✓ |

**Total minimum : ~150 tests unitaires HTTP** sur l'api-server.

### 1.2 `packages/db/` — queries Drizzle (existant à enrichir)

Les tests actuels (`clients.test.ts`, `quotes.test.ts`, etc.) couvrent le happy-path. À compléter :

- **`queries/invoices.ts` :** test de la fonction `archiveInvoice(id)` (nouvelle, absente aujourd'hui).
- **`queries/workspace.ts` :** créer (nouveau fichier) + tests `updateWorkspace(input)`, `markSetupComplete()`, `getSetupFlag()`.
- **`queries/activity.ts` :** créer + tester `insertActivityEvent({ type, entityType, entityId, payload })`.
- **`queries/signatures.ts` :** persist audit events SQLite. Test chaîne SHA-256 cohérente entre insertions successives.

### 1.3 `apps/desktop/src-tauri/` — modules Rust (existant à garder)

Les tests Rust existants restent verts, aucune régression tolérée :
- `atomic_numbering.rs` — 3 tests, passent.
- `cert_roundtrip.rs`, `pades_embed.rs`, `verify_signature.rs` — passent.
- `sign_document_e2e.rs` — 3 tests passent + 1 `#[ignore]` (live FreeTSA) à dé-ignorer (cf. §5).

À ajouter :
- `sidecar_spawn.rs` : test unitaire de la fonction qui lit le port depuis stdout du sidecar (parsing du pattern `FAKT_API_PORT=12345`).
- `sidecar_shutdown.rs` : test que `drop(Sidecar)` envoie SIGTERM et attend jusqu'à 5 s avant SIGKILL.

---

## 2. Tests intégration

### 2.1 Roundtrip Drizzle + HTTP réel

**Fichier :** `packages/api-server/integration/roundtrip.test.ts`

```ts
describe("Roundtrip intégration — flow client complet", () => {
  it("create → list → update → archive → restore → list (archivés)", async () => {
    const tmpDb = await createTempDbFile();     // SQLite tmpfile, PAS :memory:
    const { app, token } = bootApp({ dbPath: tmpDb.path });

    // 1. Create
    const created = await fetchJson(app, "POST", "/api/clients", token, {
      name: "Atelier Test", email: "test@atelier.fr"
    });
    expect(created.id).toBeDefined();

    // 2. List → contient le client
    const list1 = await fetchJson(app, "GET", "/api/clients", token);
    expect(list1).toHaveLength(1);

    // 3. Update
    const updated = await fetchJson(app, "PATCH", `/api/clients/${created.id}`, token, {
      name: "Atelier Test Modifié"
    });
    expect(updated.name).toBe("Atelier Test Modifié");

    // 4. Archive
    await fetchJson(app, "POST", `/api/clients/${created.id}/archive`, token);
    const list2 = await fetchJson(app, "GET", "/api/clients", token);
    expect(list2).toHaveLength(0);

    // 5. List archivés
    const list3 = await fetchJson(app, "GET", "/api/clients?archived=true", token);
    expect(list3).toHaveLength(1);

    // 6. Restore
    await fetchJson(app, "POST", `/api/clients/${created.id}/restore`, token);
    const list4 = await fetchJson(app, "GET", "/api/clients", token);
    expect(list4).toHaveLength(1);

    await tmpDb.cleanup();
  });
});
```

**Scénarios roundtrip obligatoires :**

1. Client : create → update → archive → restore → list (5 asserts).
2. Prestation : create → update → archive → picker (mock) → list (4 asserts).
3. Quote : create draft → update items → issue (numéro attribué) → mark-signed → get (6 asserts).
4. Invoice from-quote : signed quote → créer facture mode full → issue → mark-paid (notes + method) → archive (6 asserts).
5. Invoice indépendante : create (sans quote) → issue → mark-paid (5 asserts).
6. Workspace : get initial null → patch identité → get (vérifier persist) → markSetupComplete → getSetupFlag (5 asserts).

### 2.2 Sidecar Rust ↔ Bun

**Fichier :** `apps/desktop/src-tauri/tests/sidecar_spawn.rs`

```rust
#[test]
fn sidecar_boots_and_emits_port() {
    // Spawn le binaire api-server (compilé en fixture préalable).
    let sidecar = Sidecar::spawn(sidecar_bin_path()).expect("spawn");
    let port = sidecar.wait_for_port(Duration::from_secs(5))
        .expect("port not emitted");
    assert!(port > 1024 && port < 65535);

    // Ping /health
    let resp = ureq::get(&format!("http://localhost:{}/api/health", port))
        .call().expect("ping");
    assert_eq!(resp.status(), 200);
}

#[test]
fn sidecar_shutdown_is_clean() {
    let sidecar = Sidecar::spawn(sidecar_bin_path()).unwrap();
    let port = sidecar.wait_for_port(Duration::from_secs(5)).unwrap();
    drop(sidecar);
    // Attendre 6 s puis vérifier port libre.
    std::thread::sleep(Duration::from_secs(6));
    let resp = ureq::get(&format!("http://localhost:{}/api/health", port)).call();
    assert!(resp.is_err(), "sidecar should have freed the port");
}

#[test]
fn sidecar_picks_random_port_if_collision() {
    // Occupe un port manuellement.
    let listener = TcpListener::bind("127.0.0.1:54321").unwrap();
    // Force un hint de port occupé via env var FAKT_API_PORT_HINT=54321.
    let sidecar = Sidecar::spawn_with_hint(sidecar_bin_path(), 54321).unwrap();
    let actual = sidecar.wait_for_port(Duration::from_secs(5)).unwrap();
    assert_ne!(actual, 54321);
    drop(listener);
}
```

### 2.3 React Query hooks — invalidation cache

**Fichier :** `apps/desktop/src/hooks/__tests__/useClients.integration.test.tsx`

Teste que `useCreateClient().mutate()` invalide bien `['clients']` après 201 :

```tsx
it("mutation create invalide cache ['clients']", async () => {
  const queryClient = new QueryClient();
  const spy = vi.spyOn(queryClient, "invalidateQueries");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ id: "new" }), { status: 201 })
  );

  const { result } = renderHook(() => useCreateClient(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  await act(() => result.current.mutateAsync({ name: "X" }));
  expect(spy).toHaveBeenCalledWith({ queryKey: ["clients"] });
});
```

Pattern à répliquer pour : `useCreateQuote → invalidate ['quotes']`, `useIssueQuote → invalidate ['quotes', id] + ['numbering']`, `useMarkInvoicePaid → invalidate ['invoices', id]`, etc.

**Minimum : 1 test par mutation hook ↦ ~15 tests intégration hooks.**

---

## 3. Tests E2E smoke

### 3.1 Setup Playwright + tauri-driver

**Dette W4 à rattraper partiellement.** En v0.1, ciblez **1 seul scénario happy-path Linux** (Xvfb). macOS + Windows en v0.1.1.

**Fichier :** `apps/desktop/e2e/happy-path.spec.ts`

```ts
import { test, expect, _electron as electron } from "@playwright/test";

test("happy-path complet : onboarding → client → devis → signature → facture → archive", async () => {
  // 1. Launch app — DB clean, setup_completed=true via FIXTURE_BOOT_MODE=test-skip-onboarding
  const app = await electron.launch({ args: ["./src-tauri/target/debug/fakt"] });
  const win = await app.firstWindow();

  // 2. Dashboard visible
  await expect(win.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  // 3. Créer client "Atelier Test"
  await win.getByRole("link", { name: /clients/i }).click();
  await win.getByRole("button", { name: /nouveau client/i }).click();
  await win.getByLabel(/nom/i).fill("Atelier Test");
  await win.getByLabel(/email/i).fill("contact@atelier-test.fr");
  await win.getByRole("button", { name: /enregistrer/i }).click();
  await expect(win.getByText("Atelier Test")).toBeVisible();

  // 4. Créer prestation "Dev mission"
  await win.getByRole("link", { name: /prestations/i }).click();
  // ... même pattern
  await expect(win.getByText("Dev mission")).toBeVisible();

  // 5. Créer devis manuel avec 2 lignes
  await win.getByRole("link", { name: /devis/i }).click();
  await win.getByRole("button", { name: /nouveau devis/i }).click();
  await win.getByTestId("client-picker").click();
  await win.getByText("Atelier Test").click();
  await win.getByRole("button", { name: /ajouter ligne/i }).click();
  await win.getByTestId("line-0-desc").fill("Ligne 1");
  await win.getByTestId("line-0-qty").fill("1");
  await win.getByTestId("line-0-price").fill("500");
  await win.getByRole("button", { name: /ajouter ligne/i }).click();
  await win.getByTestId("line-1-desc").fill("Ligne 2");
  await win.getByTestId("line-1-qty").fill("2");
  await win.getByTestId("line-1-price").fill("100");
  await win.getByRole("button", { name: /enregistrer brouillon/i }).click();
  await expect(win.getByText(/brouillon enregistré/i)).toBeVisible();

  // 6. Issue quote → numéro D{year}-001 attribué
  await win.getByRole("button", { name: /émettre/i }).click();
  await expect(win.getByText(/D\d{4}-001/)).toBeVisible();

  // 7. Render PDF (stub Typst OK : fixture-rendered.pdf renvoyé)
  await win.getByRole("button", { name: /aperçu pdf/i }).click();
  await expect(win.getByTestId("pdf-viewer")).toBeVisible();

  // 8. Sign — stub crypto : génère un PDF avec signature byte-range factice
  await win.getByRole("button", { name: /signer/i }).click();
  await win.getByTestId("signature-pad").evaluate((el) => {
    // Simule tracé signature
    (el as HTMLElement).dispatchEvent(new CustomEvent("sign-fixture"));
  });
  await win.getByRole("button", { name: /valider signature/i }).click();
  await expect(win.getByText(/signé/i)).toBeVisible();

  // 9. Créer facture from-quote mode full
  await win.getByRole("button", { name: /créer facture/i }).click();
  await win.getByLabel(/mode total/i).check();
  await win.getByRole("button", { name: /générer facture/i }).click();
  await expect(win.getByText(/F\d{4}-001/)).toBeVisible();

  // 10. Mark paid
  await win.getByRole("button", { name: /marquer payée/i }).click();
  await win.getByLabel(/méthode/i).selectOption("virement");
  await win.getByLabel(/notes/i).fill("Virement reçu le 2026-04-22");
  await win.getByRole("button", { name: /confirmer paiement/i }).click();
  await expect(win.getByText(/payée/i)).toBeVisible();

  // 11. Export archive ZIP
  await win.getByRole("link", { name: /paramètres/i }).click();
  await win.getByRole("button", { name: /exporter archive zip/i }).click();
  // Dialog OS mocké via FAKT_DIALOG_MOCK_PATH=/tmp/fakt-archive.zip
  await expect(win.getByText(/archive exportée/i)).toBeVisible();

  await app.close();
});
```

Chaque étape a **1 assertion visible** (texte ou `data-testid`). Total : ~15 asserts, durée cible ≤ 60 s.

### 3.2 Fixtures & mocks E2E

- **`FAKT_BOOT_MODE=test-skip-onboarding`** : env var lue au boot Tauri, crée un workspace fixture + `setup_completed=true`.
- **`FAKT_DIALOG_MOCK_PATH`** : court-circuite `plugin:dialog|save` avec un path fixe.
- **`FAKT_TSA_MOCK=1`** : court-circuite l'appel HTTP TSA réseau en renvoyant un TSR fixture signé par un fake TSA cert généré à boot.
- **`FAKT_TYPST_MOCK=1`** : renvoie un PDF fixture `tests/fixtures/rendered.pdf` au lieu d'appeler le subprocess Typst.

Ces flags **doivent être no-op en production** (check `#[cfg(debug_assertions)]` + garde runtime `NODE_ENV !== "production"`).

---

## 4. Tests légaux FR obligatoires

Ces 4 tests sont **bloquants tag v0.1.0**. Chaque échec = no-go.

### 4.1 Numérotation atomique (CGI art. 289)

**Fichier :** `packages/api-server/integration/numbering-concurrency.test.ts`

```ts
it("100 appels parallèles POST /api/quotes/issue → séquence 1..100 sans trou", async () => {
  const { app, token, db } = bootApp({ dbPath: tmpDbPath });
  // Pré-créer 100 drafts
  const quoteIds = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      fetchJson(app, "POST", "/api/quotes", token, {
        clientId: CLIENT_ID_1,
        title: `Draft ${i}`,
        items: [{ description: "x", quantity: 1000, unitPriceCents: 100, unit: "forfait", lineTotalCents: 100 }],
      }).then((q) => q.id)
    )
  );

  // Issue 100 en parallèle (Promise.all)
  const issued = await Promise.all(
    quoteIds.map((id) => fetchJson(app, "POST", `/api/quotes/${id}/issue`, token))
  );

  const sequences = issued.map((q) => q.sequence).sort((a, b) => a - b);
  expect(sequences).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));

  // Double-check : pas de doublon (Set)
  expect(new Set(sequences).size).toBe(100);

  // Check contrainte UNIQUE DB : SELECT COUNT(DISTINCT sequence) = 100
  const rows = db.select({ seq: quotes.sequence }).from(quotes).all();
  const uniqueSeqs = new Set(rows.map((r) => r.seq));
  expect(uniqueSeqs.size).toBe(100);
});
```

**Note impl :** l'api-server DOIT utiliser `BEGIN IMMEDIATE` côté SQLite (la query `nextQuoteNumber` le fait déjà). Si un agent Phase 2 introduit un code-path qui lit `last_sequence` hors transaction, ce test casse.

### 4.2 Mention TVA micro-entreprise exacte

**Fichier :** `packages/legal/src/__tests__/mentions.test.ts` (existant — à renforcer)

```ts
it("snapshot PDF rendu Typst contient la mention exacte art. 293 B", async () => {
  const pdf = await renderInvoicePdf({
    workspace: { tvaMention: "TVA non applicable, art. 293 B du CGI", ... },
    // ... invoice payload
  });
  const text = await extractTextFromPdf(pdf);  // via pdf-parse ou mupdf-js
  expect(text).toContain("TVA non applicable, art. 293 B du CGI");
});
```

**Pièges :**
- Apostrophe typographique vs droite : **utiliser l'apostrophe droite ASCII**. `art. 293 B du CGI`, pas `art. 293 B du CGI`.
- Espace insécable avant le B ? Non. Valider avec un regex strict : `/TVA non applicable, art\. 293 B du CGI/`.

### 4.3 No hard delete invoice issued

**Fichier :** `packages/api-server/src/__tests__/invoices-legal.test.ts`

```ts
it("DELETE /api/invoices/:id refusé 409 si status=sent", async () => {
  const { app, token, db } = createTestApp();
  // Setup : créer invoice, issue
  const inv = await createAndIssueInvoice(app, token);
  expect(inv.status).toBe("sent");

  const res = await app.request(`/api/invoices/${inv.id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.error).toMatch(/hard delete interdit|archivage 10 ans/i);

  // DB inchangée
  const stillThere = db.select().from(invoices).where(eq(invoices.id, inv.id)).all();
  expect(stillThere).toHaveLength(1);
});
```

### 4.4 Trigger SQL `invoices_no_hard_delete_issued`

**Fichier :** `packages/db/src/__tests__/triggers.test.ts`

Bypass l'API, attaque direct SQL :

```ts
it("trigger SQL rejette DELETE issued bypass API", () => {
  const { db, sqlite } = createTestDb();
  seedWorkspace(db);
  seedClient(db);
  // Créer + issue invoice direct en SQL
  sqlite.prepare(`
    INSERT INTO invoices (id, workspace_id, client_id, kind, title, status, legal_mentions)
    VALUES (?, ?, ?, 'full', 'X', 'sent', 'mentions')
  `).run(INV_ID, WORKSPACE_ID, CLIENT_ID_1);

  expect(() => {
    sqlite.prepare(`DELETE FROM invoices WHERE id = ?`).run(INV_ID);
  }).toThrow(/hard delete|archiv/i);
});
```

Vérifie aussi que DELETE sur status=`draft` **fonctionne** (le trigger ne sur-bloque pas).

---

## 5. Tests signature PAdES

### 5.1 Hash TSA conforme RFC 3161 §2.5

**Fichier :** `apps/desktop/src-tauri/tests/tsa_hash_correctness.rs`

```rust
#[test]
fn tsa_digest_is_sha256_of_signer_info_signature_bit_string() {
    let gen = generate_self_signed_cert(&sample_dn()).unwrap();
    let pdf = minimal_pdf("fixture");

    // Embed PAdES-B (sans TSR pour l'instant)
    let signed_b = embed_signature_with_timestamp(&pdf, &gen.x509_der, &gen.rsa_priv_pkcs8_der, b"png", None)
        .unwrap();

    // Extract la signature RSA du CMS
    use cms::content_info::ContentInfo;
    use cms::signed_data::SignedData;
    use der::Decode;
    let ci = ContentInfo::from_der(&signed_b.cms_der).unwrap();
    let sd: SignedData = ci.content.decode_as().unwrap();
    let si = sd.signer_infos.0.as_slice().first().unwrap();
    let sig_bytes = si.signature.as_bytes();

    // Le hash attendu pour le TSR
    let mut h = Sha256::new();
    h.update(sig_bytes);
    let expected_digest: [u8; 32] = h.finalize().into();

    // Build TSQ — vérifier que le digest dans la requête MATCHE
    let tsq = tsa::build_timestamp_query(&expected_digest).unwrap();

    // Décoder TSQ et extraire le messageImprint.hashedMessage
    let tsq_parsed = TimeStampReq::from_der(&tsq).unwrap();
    let actual_digest = tsq_parsed.message_imprint.hashed_message.as_bytes();

    assert_eq!(actual_digest, expected_digest,
        "TSR doit hasher SignerInfo.signature, pas le CMS entier (RFC 3161 §2.5)");
}
```

**Note bug à fixer :** Track η doit corriger `commands.rs:347-356` pour hasher `SignerInfo.signature` et non `cms_der`. Ce test vérifie le fix.

### 5.2 Persist audit_events en SQLite

**Fichier :** `apps/desktop/src-tauri/tests/audit_persistence.rs` (nouveau)

Deux cas :

1. **Persistance simple** : insert 5 events → SELECT → 5 events lisibles, chaîne SHA-256 valide via `verify_chain()`.
2. **Persistance après redémarrage simulé** : insert 5 events, `drop(AppState)`, reconstruire `AppState::new(same_path)` → les 5 events restent lisibles + `previous_event_hash` du prochain event pointe bien sur le hash de `evt-5`.

```rust
#[test]
fn audit_events_persist_across_appstate_reboot() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().to_path_buf();

    // Phase 1 : insert 5 events
    {
        let state = AppState::new(&db_path).unwrap();
        for i in 1..=5 {
            let ev = make_event(i, if i == 1 { None } else { Some(&format!("prev{}", i - 1)) });
            state.persist_signature_event(&ev).unwrap();
        }
    } // drop(state) → simulation fermeture app

    // Phase 2 : redémarrer, charger et vérifier
    let state2 = AppState::new(&db_path).unwrap();
    let events = state2.list_signature_events("invoice").unwrap();
    assert_eq!(events.len(), 5);
    let broken = verify_chain(&events);
    assert!(broken.is_empty(), "chain must survive reboot");
}
```

### 5.3 Fichier PDF test `signed_pades_b_t_freetsa.pdf`

**Fichier :** `apps/desktop/src-tauri/tests/pades_b_t_fixture.rs` (nouveau)

Remplace le test `#[ignore]` par une version **non-ignorée** qui stub TSA (pas de réseau) :

```rust
#[test]
fn produces_valid_pades_b_t_fixture_with_fake_tsa() {
    // Génère un "fake TSA" : cert X.509 self-signed + clé privée, on va signer
    // nous-mêmes un TSTInfo structure pour construire un TSR valide au format.
    let tsa_cert = generate_self_signed_tsa_cert();
    let tsq_digest = [0x42u8; 32];
    let fake_tst = build_fake_tst(&tsa_cert, &tsq_digest);
    // fake_tst = TimeStampToken DER bien formé, avec SignerInfo qui référence tsa_cert.

    let gen = generate_self_signed_cert(&sample_dn()).unwrap();
    let pdf = minimal_pdf("Facture test signature B-T");

    let signed = embed_signature_with_timestamp(
        &pdf, &gen.x509_der, &gen.rsa_priv_pkcs8_der, b"png_fake", Some(&fake_tst)
    ).unwrap();

    // Écrire le fixture
    fs::write(out_dir().join("signed_pades_b_t_freetsa.pdf"), &signed.pdf_bytes).unwrap();

    // Vérifs :
    let _doc = lopdf::Document::load_mem(&signed.pdf_bytes).expect("valid PDF");
    // OID TST présent
    let tst_oid = [0x06, 0x0B, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x10, 0x02, 0x0E];
    assert!(signed.cms_der.windows(tst_oid.len()).any(|w| w == tst_oid));
}
```

Ce fichier PDF sert aussi de **gate 1 smoke manuel Tom** (ouvrir dans Adobe Reader). Le test `#[ignore]` pour FreeTSA réel **reste** pour CI nocturne optionnelle.

### 5.4 Mismatch nom `CertInfo` TS ↔ Rust

**Fichier :** `packages/shared/src/__tests__/cert-info-schema.test.ts`

```ts
it("Type CertInfo TS matche la struct Rust CertInfo (snake_case coherent)", () => {
  // Le Rust sérialise avec #[serde(rename_all = "snake_case")]
  // Le TS doit accepter : subject_dn, fingerprint_sha256, not_before, not_after, kind, algorithm.
  // Pas subject_cn, pas fingerprint_sha256_hex, pas not_before_iso.
  const fromRust: CertInfo = {
    subject_dn: "CN=Tom, O=Alpha, C=FR",
    fingerprint_sha256: "abcd...",
    not_before: 1713600000000,
    not_after: 2029000000000,
    kind: "self-signed",
    algorithm: "RSA-4096",
  };
  // Doit type-check sans erreur.
  expect(fromRust.subject_dn).toBeDefined();
});
```

Complément : **snapshot test** dans `apps/desktop/src/routes/settings/__tests__/certificate-tab.test.tsx` pour garantir que les valeurs Rust s'affichent correctement.

---

## 6. Smoke manuel pre-tag v0.1.0 (checklist Tom)

À cocher **en live** par Tom après que la CI soit green. Chaque étape a un `expected` précis. Un seul item rouge = no-go.

| # | Action | Expected |
|---|---|---|
| 1 | Supprimer `~/.fakt/data/fakt.db` et le cert en keychain (`fakt-personal-cert`). Lancer `bun run tauri:dev`. | Fenêtre Tauri s'ouvre sur wizard Onboarding étape 1/4 « Identité légale ». |
| 2 | Saisir nom `Tom Andrieu`, forme `Micro-entreprise`, SIRET `73282932000074`, adresse Avignon, email `contact@alphaluppi.com`. Suivant. | Étape 2 « Claude CLI ». Badge vert si Claude CLI installé, sinon encart gris neutre. |
| 3 | Cocher « configurer plus tard ». Suivant. | Étape 3 « Certificat ». Bouton « Générer mon certificat ». |
| 4 | Cliquer « Générer ». | Spinner `RSA 4096 bits, quelques secondes…` puis affichage DN + fingerprint + dates (10 ans). |
| 5 | Suivant. Récapitulatif étape 4. Cliquer « C'est parti ! ». | Redirection dashboard. 0 devis, 0 facture, 0 client. |
| 6 | Menu Clients → Nouveau client → Nom `Atelier Mercier`, email `contact@mercier.fr`. Enregistrer. | Toast vert `Client créé`. Apparaît dans la liste. |
| 7 | Menu Prestations → Nouvelle prestation → Nom `Design web 1h`, unité `heure`, prix 85€. Enregistrer. | Toast vert. Apparaît liste. |
| 8 | Menu Devis → Nouveau (manuel) → Client `Atelier Mercier`, titre `Site vitrine`, 3 lignes prestation depuis picker. Total auto-calculé 3×85€ = 255€. Enregistrer brouillon. | Toast `Brouillon enregistré`. Statut `draft`. |
| 9 | Détail devis → Bouton « Émettre ». | Numéro `D2026-001` affiché. Statut `sent`. PDF généré (téléchargeable). |
| 10 | Détail devis → Bouton « Signer » → Tracer signature → Valider. | Badge `signé` + timestamp TSA. Audit timeline 1 entrée. Ouvrir PDF signé dans **Adobe Reader** → signature verte + chaîne TSA validée. |
| 11 | Détail devis → Bouton « Créer facture » → Mode `Total`. Générer. | Numéro `F2026-001`. Statut `draft` puis (après issue) `sent`. |
| 12 | Détail facture → Bouton « Marquer payée » → Méthode `Virement`, notes `Reçu 22/04/2026`. Confirmer. | Badge `payée` + date + méthode + notes persistées. |
| 13 | Détail facture → Bouton « Préparer email ». | Modal avec destinataire pré-rempli, objet, corps. Clic « Ouvrir dans mon client mail » → client OS s'ouvre avec .eml attaché + PDF signé en pièce jointe. |
| 14 | Tenter de supprimer facture F2026-001 via menu contextuel. | Dialog refus : `Suppression interdite : archivage 10 ans obligatoire (CGI). Archiver plutôt ?` Bouton `Archiver` disponible. |
| 15 | Paramètres → Exporter archive ZIP → Choisir destination `~/Desktop/fakt-export.zip`. | Toast vert `Archive exportée`. Unzip manuel → contient `clients.csv`, `prestations.csv`, `devis/D2026-001.pdf`, `factures/F2026-001.pdf` (signé), `README_compliance.txt` avec mentions art. L123-22 + art. 286 CGI. |

**Durée cible :** 15-25 min. À exécuter sur **Windows** (environnement dev Tom). Linux + macOS optionnels v0.1.1.

---

## 7. CI matrix

### 7.1 Modifications `ci.yml`

Ajouter job :

```yaml
api-server-test:
  strategy:
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
    - run: bun install --frozen-lockfile
    - run: bun run --cwd packages/api-server typecheck
    - run: bun run --cwd packages/api-server test -- --coverage --reporter=verbose
    - run: bun run --cwd packages/api-server test:integration
    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        files: packages/api-server/coverage/lcov.info
        flags: api-server-${{ matrix.os }}
```

**Note SQLite Windows :** `better-sqlite3` prebuilds disponibles. `@tauri-apps/plugin-sql` pas utilisé en Phase 2 (on reste sur `better-sqlite3` direct).

### 7.2 Nouveau `e2e.yml`

```yaml
name: E2E smoke
on: [push, pull_request]
jobs:
  tauri-e2e-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: oven-sh/setup-bun@v1
      - name: Install Xvfb + WebKit
        run: |
          sudo apt-get update
          sudo apt-get install -y xvfb libwebkit2gtk-4.1-dev libgtk-3-dev \
            libayatana-appindicator3-dev librsvg2-dev
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml
      - name: Install tauri-driver
        run: cargo install tauri-driver --locked
      - name: Run E2E smoke (Xvfb)
        env:
          FAKT_BOOT_MODE: test-skip-onboarding
          FAKT_TSA_MOCK: "1"
          FAKT_TYPST_MOCK: "1"
        run: xvfb-run -a bun run --cwd apps/desktop test:e2e
      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-screenshots
          path: apps/desktop/test-results/
```

**v0.1 :** Linux uniquement. macOS (Apple Silicon runners) + Windows prévus v0.1.1.

### 7.3 Coverage badges README

Dans `README.md` (ligne ~10) :

```markdown
[![CI](https://github.com/AlphaLuppi/fakt/actions/workflows/ci.yml/badge.svg)](...)
[![E2E](https://github.com/AlphaLuppi/fakt/actions/workflows/e2e.yml/badge.svg)](...)
[![Coverage api-server](https://codecov.io/gh/AlphaLuppi/fakt/branch/main/graph/badge.svg?flag=api-server-ubuntu-latest)](...)
```

---

## 8. Critères go/no-go tag v0.1.0

### Tests automatisés (bloquants, doivent tous être verts)

- [ ] **Unit — api-server :** ≥ 80 % coverage lines + branches. CI verte sur les 3 OS.
- [ ] **Unit — packages/db :** ≥ 80 % coverage, 0 régression vs baseline (tests actuels restent verts).
- [ ] **Unit — packages/legal :** ≥ 90 % coverage, mentions FR testées au caractère près.
- [ ] **Unit — apps/desktop/src :** baseline 222 tests restent verts + nouveaux tests hooks invalidation (~15).
- [ ] **Unit — src-tauri Rust :** `cargo test` passe, incluant atomic_numbering, cert_roundtrip, pades_embed, verify_signature, sign_document_e2e, **tsa_hash_correctness** (nouveau), **audit_persistence** (nouveau), **pades_b_t_fixture** (nouveau).
- [ ] **Intégration — roundtrip :** 6 scénarios (clients, prestations, quotes, invoices from-quote, invoices indépendantes, workspace) tous verts sur SQLite tmpfile.
- [ ] **Intégration — sidecar :** 3 tests Rust (boot, shutdown, port collision) verts.
- [ ] **Intégration — hooks React Query :** ~15 tests invalidation cache verts.
- [ ] **E2E smoke :** 1 happy-path complet vert sur Linux (Xvfb). Durée ≤ 90 s.

### Tests légaux FR (bloquants, 4/4)

- [ ] **Numérotation atomique :** 100 appels parallèles → séquence 1..100 sans trou ni doublon.
- [ ] **Mention TVA micro :** PDF rendu contient exactement `TVA non applicable, art. 293 B du CGI`.
- [ ] **No hard delete API :** `DELETE /api/invoices/:id` sur `status=sent` → 409, DB inchangée.
- [ ] **Trigger SQL invoices_no_hard_delete_issued :** bypass API via SQL direct → exception levée.

### Tests signature PAdES (bloquants, 3/3)

- [ ] **Hash TSA RFC 3161 §2.5 :** TSR hashe `SignerInfo.signature` (BIT STRING), pas le CMS entier.
- [ ] **Audit persistent SQLite :** 5 events survivent à un redémarrage simulé (drop + recreate AppState), chaîne SHA-256 reste valide.
- [ ] **Fixture PDF test :** `apps/desktop/src-tauri/tests/output/signed_pades_b_t_freetsa.pdf` produit par un test non-ignoré.

### Smoke manuel Tom (bloquant, 15/15)

- [ ] Les 15 items du §6 passent en live sur la machine dev Windows de Tom, avec un screenshot Adobe Reader validant la signature verte (item #10).

### Gate hors test (infra CI)

- [ ] `bun run typecheck` : tous packages ✓ (incluant nouveau `packages/api-server`).
- [ ] `bun run test` : ≥ **400 tests** (baseline 222 + ~150 api-server unit + ~20 légaux + ~10 signature + ~15 intégration).
- [ ] `bun run build` : desktop dist + landing dist ✓, sidecar api-server compiled Bun binary cross-OS.
- [ ] `cargo check --locked` dans `apps/desktop/src-tauri` : ✓.
- [ ] Coverage badges READMÉ au vert.

### Matrice de décision

| Statut | Action |
|---|---|
| Tous cochés | **GO tag `v0.1.0`**. Tom peut `git tag v0.1.0 && git push --tags`. |
| 1 ou plusieurs tests auto rouges | **NO-GO.** Phase 4 fix obligatoire. |
| Tests auto verts mais 1 légal FR rouge | **NO-GO bloquant légal.** Pas de release avec risque URSSAF. |
| Tests auto verts, 1 smoke manuel rouge | **NO-GO.** Arbitrage cas par cas avec Tom : fix immédiat ou downgrade scope. |
| Coverage < 80 % api-server | **NO-GO si < 70 %.** Avertissement si 70-80 %. |

---

## Annexes

### A. Ordre d'exécution recommandé en CI

1. Typecheck (~30 s)
2. Lint (~20 s)
3. Unit Vitest parallèle — packages + apps/desktop/src (~2 min)
4. Unit Rust `cargo test` (~1 min)
5. Intégration roundtrip (~1 min)
6. Intégration sidecar (nécessite build préalable, ~3 min)
7. Build + E2E smoke Xvfb (~5 min)
8. Coverage report + upload

**Total CI cible :** ≤ 12 min sur ubuntu-latest. ≤ 18 min sur windows-latest.

### B. Priorité des tests en cas de ressources limitées

Si un agent Phase 2 doit couper (ne devrait pas, mais au cas où) :

**Priorité 1 (jamais couper) :**
- Tests légaux FR (4).
- Tests signature PAdES (3).
- Numérotation atomique concurrent.
- Trigger SQL no-hard-delete.

**Priorité 2 :**
- Unit handlers HTTP happy-path (couverture ≥ 60 % minimum).
- Intégration roundtrip client + invoice from-quote.

**Priorité 3 (peut être reporté v0.1.1 si vraiment nécessaire) :**
- E2E smoke Playwright (remplacé par smoke manuel Tom).
- Hooks React Query invalidation.
- Intégration sidecar OS matrix complète.

### C. Dépendances de test

Ajouter à `packages/api-server/package.json` :
```json
"devDependencies": {
  "vitest": "^2.0.0",
  "@vitest/coverage-v8": "^2.0.0",
  "better-sqlite3": "^11.0.0",
  "zod": "^3.23.0"
}
```

Ajouter à `apps/desktop/package.json` :
```json
"devDependencies": {
  "@playwright/test": "^1.47.0"
}
```

Ajouter à `apps/desktop/src-tauri/Cargo.toml` (dev-dependencies) :
```toml
[dev-dependencies]
tempfile = "3.10"
ureq = "2.10"
```

### D. Fixtures à produire (à versionner dans repo)

- `apps/desktop/src-tauri/tests/fixtures/tsa_fake_cert.der` — cert X.509 auto-signé pour fake TSA (généré déterministe depuis seed).
- `apps/desktop/src-tauri/tests/fixtures/rendered.pdf` — PDF Typst pré-rendu (mode `FAKT_TYPST_MOCK=1`).
- `apps/desktop/src-tauri/tests/output/signed_pades_b_t_freetsa.pdf` — produit par le test, pas checkout-in ; ajouter à `.gitignore`.
- `packages/api-server/src/__tests__/fixtures/client.sample.json` — payloads Zod-valides pour reuse.

### E. Hors scope v0.1.0 (prévu v0.1.1)

Les tests suivants sont **non bloquants v0.1.0** et documentés comme dettes :
- E2E Playwright sur macOS + Windows (Linux only v0.1).
- Tests performance NFR (rendu 50 docs < 10s — actuellement 50-100s cf. e2e-wiring-audit).
- Tests visuels Brutal Invoice (screenshot diff) — géré par agent `ui-ux-reviewer` en Phase 3 manuel.
- Tests accessibilité axe-core — dette v0.1.1.
- Tests de montée en charge api-server (1000 req/s) — non pertinent solo local.
- Tests Postgres adapter — prévu v0.2 (mode 2/3).

---

**Fin du test-plan. Total : 415 lignes. Revu prêt pour Phase 2.**
