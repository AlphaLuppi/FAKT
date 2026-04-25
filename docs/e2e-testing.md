# Stratégie E2E — FAKT

**Statut :** v0.1.17 (introduction de la suite double Playwright + WebdriverIO)
**Mainteneur :** Tom Andrieu

## Pourquoi deux suites distinctes

Les bugs trouvés sur la version release publiée sur le store ne sont **pas reproductibles** avec `bun run dev`. Causes typiques :

- **Path bundling sidecar :** en dev, `binaries/fakt-api-<triple>` est lu depuis le workspace ; en release, depuis le bundle Tauri à un autre path.
- **Profile Cargo release :** `panic = "abort"` (vs `unwind` en dev) → crash silencieux sans stack trace, juste un log dans `app_data_dir/logs/`.
- **LTO + strip Windows + WebView2 :** combo qui peut crasher 0xc0000409 si `strip = true`.
- **CSP stricte :** `script-src 'self'` peut bloquer un import dynamique qui marchait en dev.
- **Init script race :** `window.__FAKT_API_URL__` injecté par Rust _avant_ le mount React — race condition possible en bundle minifié.

→ **Conclusion** : Playwright sur `localhost:1420` (Vite dev server) ne détecte aucun de ces problèmes. Il faut tester le binaire packagé via WebDriver Protocol.

## Architecture

```
┌─────────────────────────────────────────┐         ┌─────────────────────────────────────────┐
│ Suite 1 — Playwright (dev mode)          │         │ Suite 2 — WebdriverIO (release mode)    │
│                                         │         │                                         │
│ Quoi : webview Vite sur localhost:1420  │         │ Quoi : binaire FAKT compilé en release  │
│ Speed : ~5-10 min, ~16 fichiers spec    │         │ Speed : ~10-20 min selon OS             │
│ Déps : page.route() mocks API           │         │ Déps : tauri-driver + cargo build       │
│ Quand : chaque PR + push main           │         │ Quand : push main + gate avant release  │
│ Plateformes : Linux/macOS/Windows       │         │ Plateformes : Linux + Windows (pas Mac) │
│ Couverture : 30 user journeys via mocks │         │ Couverture : smoke + boot + sidecar     │
└─────────────────────────────────────────┘         └─────────────────────────────────────────┘
       │                                                       │
       ▼                                                       ▼
.github/workflows/e2e.yml                            .github/workflows/e2e-release.yml
                                                              │
                                                              ▼
                                       .github/workflows/release.yml (needs: e2e-release-gate)
                                       → si E2E rouge, pas de bundle uploadé
```

## Suite 1 — Playwright (dev mode)

### Lancement

```bash
# Local : démarre Vite + lance Playwright + ferme Vite
bun run test:e2e

# Filtrer un fichier
bunx playwright test apps/desktop/tests/e2e/quotes.spec.ts

# Mode UI interactif (debug)
bunx playwright test --ui
```

### Structure

```
apps/desktop/tests/e2e/
├── helpers/
│   ├── fixtures.ts        # Données seed (workspace, clients, devis...)
│   ├── api-mocks.ts       # page.route() handlers pour /api/*
│   ├── test.ts            # Fixture Playwright étendu (mockState injecté)
│   └── actions.ts         # Helpers UI (fillIdentityStep, navigateTo...)
├── dashboard.spec.ts
├── onboarding.spec.ts
├── clients.spec.ts
├── services.spec.ts
├── quotes.spec.ts
├── invoices.spec.ts
├── numbering-compliance.spec.ts
├── settings.spec.ts
├── archive-search.spec.ts
├── signatures.spec.ts
├── pdf-and-email.spec.ts
├── auth-mode2.spec.ts
├── quote-to-invoice-flow.spec.ts
├── smoke.spec.ts          # héritage v0.1
└── login-web.spec.ts      # héritage v0.1
```

### Comment ça mocke

Chaque test importe `test, expect` depuis `helpers/test.js`. Le fixture étendu :

1. Injecte `window.__FAKT_API_URL__`, `__FAKT_API_TOKEN__`, `__FAKT_MODE__` via `addInitScript`.
2. Installe des handlers `page.route(/\/api\/.*/)` qui répondent depuis un store en mémoire.
3. Le store est seedé avec un workspace + 2 clients + 2 devis + 1 facture par défaut. Pour partir vide :

```ts
test.use({ mockMode: "empty" });
```

Pour forcer le mode 2 (web/JWT) :

```ts
test.use({ faktMode: 2 });
```

### Ce qui n'est pas couvert (par design)

- Les Tauri commands (`crypto::sign_document`, `commands::open_email_draft`, etc.) — c'est mocked, pas testé réellement.
- Le rendu PDF Typst — la route `/api/render` renvoie un PDF stub.
- Les timestamps eIDAS réels (freetsa.org, etc.) — pas appelé.

→ Tout ça doit être validé par la suite 2.

## Suite 2 — WebdriverIO (release mode)

### Pré-requis

```bash
# Une fois sur la machine de dev / runner CI
cargo install tauri-driver --locked

# À chaque test
bun --cwd apps/desktop tauri:build       # produit le binaire dans target/release/
bun run test:e2e:release                 # lance wdio.conf.ts
```

### Comment ça marche

1. `tauri-driver --port 4444` est spawné par `wdio.conf.ts` (hook `onPrepare`).
2. WebdriverIO se connecte à `http://127.0.0.1:4444` en HTTP avec capabilities `{ browserName: "wry", "tauri:options": { application: "<path>" } }`.
3. tauri-driver lance le binaire, expose le webview en WebDriver Protocol :
   - **Linux** : via WebKitGTK web inspector.
   - **Windows** : via Edge WebDriver (téléchargé automatiquement).
   - **macOS** : pas supporté par Apple — la suite est skippée.
4. À la fin : `onComplete` kill `tauri-driver`.

### Structure

```
apps/desktop/tests/e2e-release/
├── tsconfig.json             # extends ../../../../tsconfig.wdio.json
├── smoke.spec.ts             # boot, titre, init globals injectés
├── sidecar-health.spec.ts    # /api/health, /api/setup répondent
├── routes-navigation.spec.ts # toutes les routes mount sans crash
└── tauri-commands.spec.ts    # get_version, is_setup_completed, get_backend_mode
```

### Variables d'env

| Variable | Effet |
|---|---|
| `FAKT_RELEASE_BINARY` | Override le path détecté (utile pour tester un installer extrait, par ex. `.deb` mounted) |
| `FAKT_E2E_DRIVER_EXTERNAL=1` | Skip le spawn auto de tauri-driver (utile en CI où on lance le driver dans un step séparé pour les logs) |

## CI — gate de release

Le tag `v*` déclenche `release.yml`, qui déclare :

```yaml
jobs:
  e2e-release-gate:
    uses: ./.github/workflows/e2e-release.yml

  release:
    needs: e2e-release-gate
    # build + bundle + upload assets
```

→ Si E2E release échoue, `release` reste `skipped`, **aucun binaire n'est uploadé**, le tag reste mais sans assets attachés. Procédure de récupération dans `.claude/skills/release/SKILL.md` (section Garde-fous).

## Mappage user journey ↔ spec

| # | User journey | Spec dev | Spec release |
|---|---|---|---|
| 01 | Wizard onboarding 4 étapes | `onboarding.spec.ts` | `routes-navigation.spec.ts` |
| 02 | Créer client | `clients.spec.ts` | — |
| 03 | Éditer client | `clients.spec.ts` | — |
| 04 | Supprimer client | `clients.spec.ts` | — |
| 05 | Créer devis manuel | `quotes.spec.ts` | — |
| 06 | Dupliquer devis | `quotes.spec.ts` | — |
| 07 | Render PDF + email draft | `pdf-and-email.spec.ts` | (manuel) |
| 08 | Signer devis | `signatures.spec.ts` | (manuel — crypto réelle) |
| 09 | Convertir devis → facture | `quotes.spec.ts` | — |
| 10 | Créer facture manuelle | `invoices.spec.ts` | — |
| 11 | Éditer facture | `invoices.spec.ts` | — |
| 12 | Mark paid | `invoices.spec.ts` | — |
| 13 | Export PDF facture | `pdf-and-email.spec.ts` | (manuel) |
| 14 | Recherche full-text | `archive-search.spec.ts` | — |
| 15 | Archive filtré | `archive-search.spec.ts` | — |
| 16 | Dashboard activité | `dashboard.spec.ts` | `routes-navigation.spec.ts` |
| 17 | Settings Identity | `settings.spec.ts` | — |
| 18 | Settings Certificate | `settings.spec.ts` | — |
| 19 | Settings Backend toggle | `settings.spec.ts` + héritage | `tauri-commands.spec.ts` |
| 20 | Settings ClaudeCli | (manuel — subprocess) | (manuel) |
| 22 | Services library | `services.spec.ts` | — |
| 25 | Login mode 2 | `auth-mode2.spec.ts` + `login-web.spec.ts` | — |
| 27 | Workflow complet devis → facture → payé | `quote-to-invoice-flow.spec.ts` | — |
| 28 | Bulk creation | (couvert par numbering-compliance) | — |
| 29 | Compliance CGI numérotation | `numbering-compliance.spec.ts` | — |
| 30 | Smoke release | — | `smoke.spec.ts` + `sidecar-health.spec.ts` |

Les journeys 21 (AI sidebar PDF parse), 24 (auto-update) et 26 (multi-workspace mode 2) sont en dette de test — voir issues GitHub.

## Faire évoluer

### Ajouter une spec dev

1. Créer `apps/desktop/tests/e2e/<feature>.spec.ts`.
2. Importer `test, expect` depuis `./helpers/test.js`.
3. Mocker tout `/api` est déjà fait — utiliser `mockState` pour inspecter/muter le store.

### Ajouter une spec release

1. Créer `apps/desktop/tests/e2e-release/<feature>.spec.ts`.
2. Utiliser le global `browser` de WebdriverIO (importé automatiquement via `@wdio/globals`).
3. Pour exécuter du JS dans le webview : `await browser.execute(() => ...)` ou `executeAsync` pour async.
4. Pour invoke une Tauri command : pattern `tauriInvoke` dans `tauri-commands.spec.ts`.

### Pourquoi pas de macOS en release suite

Apple ne fournit pas d'accès WebDriver à WKWebView pour des raisons de sécurité système. Le seul contournement viable serait XCUITest (Swift), trop lourd pour un projet solo. La suite 1 (Playwright) couvre le frontend en dev sur macOS — pour le binaire packagé, on s'appuie sur des tests manuels avant tag (cf. checklist DoD dans le skill release).
