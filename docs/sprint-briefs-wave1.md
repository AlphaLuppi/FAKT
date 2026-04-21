# Sprint Briefs — Wave 1 · FAKT v0.1.0

**Date :** 2026-04-21
**Contexte :** Wave 0 (Fondations) en cours. Les 5 briefs ci-dessous sont à lancer **en parallèle** dès que W0 est mergé sur `main`.
**Stratégie :** 5 agents simultanés dans des worktrees isolés, 1 commit atomique par track (ou par sub-track pour D). Référence maître : `docs/sprint-plan.md` section "Wave 1".

---

## Règles de lancement

1. **Lancer en parallèle dans un seul message** — utiliser plusieurs `Agent()` tool calls dans le même tool use pour maximiser la concurrence.
2. **Prérequis** : `main` contient le commit W0 mergé avec tous les packages socle (`packages/shared`, `packages/design-tokens`, `packages/core`, `packages/legal`, `packages/db`, `packages/config`, `apps/desktop`). Les agents partent de main HEAD en worktree isolé.
3. **Model mix :** opus uniquement pour Track D (crypto complexe). Sonnet pour A, B, C, E.
4. **Isolation :** `worktree` obligatoire pour tous (collisions fichiers minimes mais réelles).
5. **Au bout de ~5 jours calendaires**, Tom merge les 5 worktrees séquentiellement dans main après review de chaque rapport agent + tests locaux. Si merge conflict → résolution humaine, jamais délégué agent.
6. **Track D est le chemin critique.** Si l'agent D remonte un blocker crypto cross-OS à J+3, escalader immédiatement (fallback wrapper OpenSSL C# via P/Invoke).

### Signature Agent() commune

```ts
Agent({
  subagent_type: "<type>",
  model: "<sonnet|opus>",
  isolation: "worktree",
  name: "<slug>",
  description: "<short>",
  prompt: "<voir brief ci-dessous>"
})
```

---

## Track A — UI Components Brutal Invoice (13 pts)

**Agent type :** `feature-dev:code-architect`
**Model :** `sonnet`
**Name :** `w1-track-a-ui`
**Description :** UI primitives Brutal Invoice

### Prompt

```
Tu construis **packages/ui** pour FAKT — la bibliothèque de composants Brutal Invoice. Tu tournes dans un worktree isolé depuis main HEAD. W0 est mergé : les packages socle existent.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles design Brutal Invoice non-négociables.
2. `docs/sprint-plan.md` section **"Track A — UI Components Brutal Invoice"** — liste composants + DoD.
3. `docs/architecture.md` section 10 (UI architecture, choix libs React 19 + shadcn ou pas).
4. `packages/design-tokens/` (livré W0) — importer `tokens.ts` pour toutes les valeurs.
5. `.design-ref/gestion-de-facture-et-devis/project/components/*.jsx` — sources visuelles de référence :
   - `atoms.jsx` — primitives Button, Input, Card, Chip, Avatar
   - `shell.jsx` — Sidebar + Topbar layout
   - `lists.jsx` — Table sortable/filterable
   - `dashboard.jsx` — StatusPill, Sparkline
   - `detail-signature.jsx` — Canvas signature primitive
   - `composer.jsx` — Modal + Overlay + CommandPalette
   - `mobile.jsx` + `ios-frame.jsx` — pour responsive patterns

## Composants à livrer (liste complète, sprint-plan Track A)

- **Primitives :** `Button` (variants primary/secondary/ghost/danger, sizes sm/md/lg, hover inversion #000↔#FFFF00, press translate(3px,3px) + shadow none), `Input` (text/number/date/textarea), `Select`, `Checkbox`, `Radio`.
- **Layout :** `Card` (bordures 2.5px, shadows variantes 3/5/8px), `Sidebar`, `Topbar`, shell layout complet (depuis `shell.jsx`).
- **Overlays :** `Modal`, `Overlay`, `CommandPalette` (⌘K, fuzzy search stub).
- **Data display :** `Table` (sortable, filterable, virtualized pour > 100 rows, lib au choix type `@tanstack/react-table` ou maison léger), `StatusPill` (cycle vie devis/facture), `Chip`, `Avatar`, `Sparkline`, `Breadcrumb`.
- **Feedback :** `Toast` via `sonner` avec styling Brutal override.
- **Specialized :** `Canvas` (HTML5 canvas signature primitive, export PNG dataURL via `toDataURL`).

## Règles absolues (non-négociables)

- **Zéro border-radius** partout. Seule exception tolérée : loaders circulaires (spinners).
- **Bordures :** 2.5px sur Cards, 2px sur Buttons/Inputs, 1.5px sur Chips.
- **Shadows plates** uniquement : `3px 3px 0 #000`, `5px 5px 0 #000`, `8px 8px 0 #000`. **Jamais de blur.**
- **Hover** : inversion couleurs (#000 ↔ #FFFF00).
- **Press** (`:active`) : `transform: translate(3px, 3px)` + `box-shadow: none`.
- **Palette stricte :** noir `#000`, papier `#F5F5F0`, jaune `#FFFF00`, blanc `#FFF`. Pas de gris subtils, pas de transparence (sauf scrims modals).
- **Typo :** Space Grotesk 700-800 UPPERCASE pour titres, 500 body. JetBrains Mono pour numériques.
- **Dark mode = NON** (canvas papier forcé, design non-négociable). Pas de classe `dark:` ni de theming runtime.
- **Interdits :** gradients, blur, drop-shadow filters, border-radius > 0.
- **TS strict** : `any` interdit → `unknown` + type guards. Toutes props typées.

## Règles de production

- Tu réécris les JSX sources en **TS strict typé** avec tokens depuis `@fakt/design-tokens`. Tu **match le visuel**, pas la structure JSX interne ligne-à-ligne.
- Chaque composant : export nommé + `examples/<Component>.tsx` consommable pour preview visuelle.
- Tests Vitest + `@testing-library/react` : au minimum smoke render + snapshot + 1 interaction clé (click, keyboard) par composant.
- Pas de commentaires évidents. Un commentaire = une contrainte cachée uniquement.

## DoD Track A

- [ ] Tous composants listés livrés, typés strict.
- [ ] Exemples `packages/ui/examples/*.tsx` consommables pour preview visuelle.
- [ ] Snapshots Vitest + tests d'interaction passent.
- [ ] `bun run typecheck` et `bun run test` passent sur `packages/ui`.
- [ ] Aucun `border-radius > 0` (sauf loaders), aucun gradient, aucun blur, aucune transparence non-scrim.
- [ ] Hover/press states visibles dans les exemples.
- [ ] Import `@fakt/design-tokens` utilisé partout (pas de valeurs hex hardcodées dans les composants).

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin, pas de commits intermédiaires.
- **Message exact :** `feat(track-a): UI components Brutal Invoice primitives`
- **DCO sign-off obligatoire :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-a): UI components Brutal Invoice primitives

  - Primitives : Button, Input, Select, Checkbox, Radio
  - Layout : Card, Sidebar, Topbar, shell
  - Overlays : Modal, Overlay, CommandPalette (⌘K)
  - Data : Table, StatusPill, Chip, Avatar, Sparkline, Breadcrumb
  - Feedback : Toast (sonner + override Brutal)
  - Canvas signature primitive (HTML5 + export PNG)
  - Examples + snapshots Vitest + tests d'interaction
  - Tokens via @fakt/design-tokens, zéro hex hardcodé

  Stories: socle US-001/005/006/008/009/025/026/027/028
  FRs: FR-023, FR-025
  Wave: 1 · Track: A · Points: 13
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` doivent passer.
- **Ne pas push.** Tom merge lui-même après review.

## Rapport final (< 300 mots, français)

- Livrables : checklist des composants (✅/🟡 stub/❌ skip) avec raison si non-✅.
- DoD : checklist des 7 gates (OK/KO).
- Commit : hash + branche worktree.
- Blockers : ce qui a été stubé (avec rationale).
- Risques conso W2 : composants ambigus à clarifier avec Tom avant features Alpha.
```

---

## Track B — DB Queries + Adapters (8 pts)

**Agent type :** `general-purpose`
**Model :** `sonnet`
**Name :** `w1-track-b-db`
**Description :** CRUD queries Drizzle typées

### Prompt

```
Tu construis les queries CRUD de **packages/db** pour FAKT. Tu tournes dans un worktree isolé depuis main HEAD. W0 est mergé : le schema Drizzle et les migrations existent dans `packages/db/src/schema.ts` + `packages/db/migrations/`.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles légal FR + sécurité.
2. `docs/sprint-plan.md` section **"Track B — DB Queries + Adapters"** — liste queries + DoD.
3. `docs/architecture.md` sections 5 (DB layer complet : schema, indexes, triggers, migrations).
4. `docs/prd.md` FR-005 à FR-022 (pour comprendre les cas d'usage métier derrière chaque query).
5. `packages/db/src/schema.ts` (livré W0) — source de vérité des tables.
6. `packages/core/src/` (livré W0) — DTOs Zod à réutiliser pour les retours typés.

## Queries à livrer (sprint-plan Track B)

Fichiers dans `packages/db/src/queries/` :

- `clients.ts` : `list({ workspaceId, search?, includeSoftDeleted?, limit?, offset? })`, `get(id)`, `create(data)`, `update(id, data)`, `softDelete(id)`, `search(q)`.
- `prestations.ts` : même signature.
- `quotes.ts` : `list`, `get(id)` **avec items joined**, `create(data + items)`, `update(id, data + items)`, `delete(id)` **draft-only**, `updateStatus(id, status)`, `search(q)`.
- `invoices.ts` : `list`, `get(id)` **avec items joined**, `create(data + items)`, `createFromQuote(quoteId, mode: 'deposit30' | 'balance' | 'full')`, `update(id, data + items)`, `markPaid(id, date, method)`, `cannotDeleteIssued` (guard function + DB trigger côté SQL).
- `numbering.ts` : `nextQuoteNumber(workspaceId)` + `nextInvoiceNumber(workspaceId)`.
  - **v0.1 Track B : stub TS simple non-atomique** qui fait `SELECT MAX + 1` en transaction avec warning dans `packages/db/TODO.md` : "Track D fournira l'implémentation atomique via `BEGIN IMMEDIATE` Tauri command — à migrer en W2 intégration Track H".
- `signatures.ts` : `appendSignatureEvent(data)` (insert append-only), `getSignatureChain(docType, docId)` retourne la chaîne complète triée.
- `settings.ts` : `getWorkspace()`, `updateWorkspace(data)`.

## Règles critiques

- **Tous les retours typés** avec les DTOs Zod depuis `packages/core` (pas de types ad hoc).
- **Pas d'écriture brute** : passer par Drizzle query builder pour bénéficier du typage + prepared statements (sécurité anti-SQL-injection).
- **Soft delete** : update `deleted_at` au lieu de DELETE sur `clients` et `prestations`.
- **Hard delete interdit** sur `invoices` avec statut ≠ 'draft' (deja un trigger SQL en W0.4, la query doit aussi throw côté TS avant d'appeler le DB).
- **Audit signature append-only** : `signatures.ts` n'expose **aucune** méthode update ou delete, uniquement `append` et lectures.
- **Numérotation sans trous** (CGI art. 289) : ton stub doit documenter que l'atomicité finale viendra de Track D, mais tes tests doivent déjà valider le cas "10 créations séquentielles → séquence 001-010 continue".

## Tests obligatoires

- Fixtures SQLite **in-memory** (pas de filesystem) via `better-sqlite3` + `:memory:` string.
- Coverage Vitest **≥ 80%** sur `packages/db/src/queries/`.
- Tests par query : happy path + edge cases (entité inexistante, soft-deleted, status invalide pour la transition).
- Test d'intégrité numérotation : créer 10 quotes puis 10 invoices, vérifier séquences continues.
- Test append-only signatures : tenter un UPDATE ou DELETE doit échouer (trigger SQL).

## DoD Track B

- [ ] Toutes les queries listées livrées, typées avec DTOs Zod.
- [ ] `bun run typecheck` et `bun run test` passent sur `packages/db`.
- [ ] Coverage ≥ 80% sur `queries/`.
- [ ] Stub numbering documenté dans `packages/db/TODO.md` avec migration path vers Track D.
- [ ] Aucune query n'expose du SQL brut (tout via Drizzle builder).

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-b): DB queries CRUD Drizzle typées`
- **DCO sign-off obligatoire :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-b): DB queries CRUD Drizzle typées

  - queries/clients, prestations (CRUD + soft delete + search)
  - queries/quotes (CRUD + items joined + updateStatus)
  - queries/invoices (CRUD + createFromQuote + markPaid + guard issued)
  - queries/numbering (stub TS non-atomique, TODO migration Track D)
  - queries/signatures (append-only uniquement)
  - queries/settings (workspace get/update)
  - Fixtures SQLite :memory: + tests Vitest ≥ 80% coverage

  Stories: socle US-005/006/010/011/014/015/017/024
  FRs: FR-005, FR-006, FR-010, FR-011, FR-015, FR-022
  Wave: 1 · Track: B · Points: 8
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Ne pas push.**

## Rapport final (< 300 mots, français)

- Livrables : checklist queries (✅/🟡/❌).
- DoD : OK/KO par gate.
- Commit : hash + branche.
- Dettes identifiées (notamment numbering stub → atomique).
- Risques conso W2 : cas d'usage métier non couverts par les queries actuelles.
```

---

## Track C — PDF Typst + Templates (13 pts)

**Agent type :** `feature-dev:code-architect`
**Model :** `sonnet`
**Name :** `w1-track-c-pdf`
**Description :** Rendu PDF Typst devis+facture

### Prompt

```
Tu construis **packages/pdf** pour FAKT — rendu PDF via Typst (jamais Puppeteer, jamais headless Chrome, décision archi non-négociable). Tu tournes dans un worktree isolé depuis main HEAD. W0 est mergé.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles design + légal FR (mentions obligatoires).
2. `docs/sprint-plan.md` section **"Track C — PDF Typst + Templates"** — 4 étapes détaillées.
3. `docs/architecture.md` section 9 (rendu PDF : embedded crate `typst` vs CLI externe, arbitrage bundle size).
4. `docs/prd.md` FR-012 (rendu PDF) + FR-016 (mentions légales).
5. `packages/core/src/models/*` (livré W0) — DTOs quote/invoice à consommer.
6. `packages/legal/src/mentions.ts` (livré W0) — mentions à injecter dans le PDF.

## Phase 1 — Exploration skills legacy (CRITIQUE)

Les skills `/devis-freelance` et `/facture-freelance` **actuellement utilisés par Tom** sont les sources de vérité des templates. Ils sont packagés dans :

- `.design-ref/gestion-de-facture-et-devis/project/uploads/devis-freelance.skill` (ZIP)
- `.design-ref/gestion-de-facture-et-devis/project/uploads/facture-freelance.skill` (ZIP)

**Actions :**

1. Extraire les 2 ZIP dans un dir temporaire (`_tmp/skills-legacy/`).
2. Lire `SKILL.md` + `references/template.md` dans chaque.
3. Noter : charte couleur **bleu principale #2E5090**, typo Arial-like, formats numérotation D2026-XXX / F2026-XXX, mentions FR légales (micro-entreprise art. 293 B CGI).
4. Lister les blocs structurels : header workspace, header client, table prestations, bloc totaux, mentions légales, zone signature.

## Phase 2 — Portage Typst

Fichiers dans `packages/pdf/templates/` :

- `base.typ` : macros communs (couleurs via `let`, helpers format EUR fr-FR, helpers date dd/MM/yyyy, fonts locaux ou web-safe fallback).
- `partials/header-workspace.typ`, `partials/header-client.typ`, `partials/items-table.typ`, `partials/totals.typ`, `partials/legal-mentions.typ`, `partials/signature-block.typ`.
- `quote.typ` : compose les partials pour un devis, numéro **D2026-XXX** en haut à droite.
- `invoice.typ` : compose les partials pour une facture, numéro **F2026-XXX** en haut à droite, injecte mentions légales via `legal-mentions.typ` (consomme data JSON serialisé depuis `@fakt/legal`).

**Liberté créative** sur typo+layout tant que la charte reste reconnaissable (bleu #2E5090, structure globale respectée).

## Phase 3 — Wrapper Rust + TS

- **Rust :** `apps/desktop/src-tauri/src/pdf/render.rs`
  - Tauri command `render_pdf(doc_type: String, data_json: String) -> Result<Vec<u8>, String>`.
  - Utilise crate **`typst`** embedded (décision archi).
  - **Fallback documenté** : si bundle final > 15 MB (NFR-003 seuil), flipper sur Typst CLI externe via `std::process::Command::new("typst")` + `which typst` health check. Décision finale à la fin du POC J3-J5.
- **TS :** `packages/pdf/src/index.ts`
  - Wrapper `renderPdf(dto: QuoteDto | InvoiceDto): Promise<Uint8Array>` via `invoke('render_pdf', ...)`.
  - Serialisation JSON depuis DTOs Zod.

## Phase 4 — Tests + validation

- Fixtures `packages/pdf/tests/fixtures/` : 3 quotes + 3 invoices en JSON (cas nominal, cas long avec 20 lignes, cas international hors-UE).
- Snapshot tests sur **hash byte-perfect SHA-256** du Vec<u8> (Typst est déterministe à inputs identiques — confirmer avec options de compilation adéquates).
- **Validation visuelle manuelle obligatoire par Tom** sur 1 devis + 1 facture avant merge du Track C. Générer les 2 PDFs en fin de track et les laisser dans `packages/pdf/tests/output/` pour review Tom.

## DoD Track C

- [ ] PDF généré **< 3s** pour devis 10 lignes (NFR-002, benchmark local).
- [ ] Toutes mentions légales obligatoires présentes dans le PDF facture (FR-016, croisé avec `packages/legal`).
- [ ] Numéro D2026-XXX / F2026-XXX visible en haut à droite.
- [ ] Charte reconnaissable (bleu #2E5090 dominant, structure skills legacy respectée).
- [ ] Snapshots déterministes (hash identique entre 2 runs).
- [ ] Bundle size Tauri mesuré et documenté dans rapport (si > 15 MB, activer fallback CLI).
- [ ] `bun run typecheck` et `bun run test` passent sur `packages/pdf`.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-c): rendu PDF Typst devis+facture`
- **DCO sign-off obligatoire :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-c): rendu PDF Typst devis+facture

  - templates/base.typ + partials (header, items, totals, mentions, signature)
  - quote.typ + invoice.typ avec numérotation D2026-XXX / F2026-XXX
  - Charte reconnaissable skills legacy (bleu #2E5090)
  - Wrapper Rust Tauri command render_pdf via crate typst embedded
  - Wrapper TS renderPdf(dto) via invoke
  - Fixtures 3 quotes + 3 invoices + snapshots byte-perfect
  - Bundle size documenté (fallback CLI si > 15 MB)

  Stories: US-012
  FRs: FR-012, FR-016
  Wave: 1 · Track: C · Points: 13
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent. PDFs de validation générés dans `tests/output/`.
- **Ne pas push.** Tom valide visuellement les PDFs avant merge.

## Rapport final (< 300 mots, français)

- Livrables : checklist 4 phases (exploration / Typst / wrapper / tests).
- DoD : 7 gates OK/KO.
- Commit : hash + branche.
- **Décision bundle :** crate embedded ou CLI fallback (avec taille mesurée).
- Blockers : polices manquantes, skills mal parsés, snapshots non-déterministes.
- Risques conso W2 : charte validée par Tom ou à ajuster avant Track H.
```

---

## Track D — Crypto PAdES POC (21 pts · CHEMIN CRITIQUE)

**Agent type :** `general-purpose`
**Model :** `opus` (complexité haute)
**Name :** `w1-track-d-crypto`
**Description :** POC PAdES B-T cross-OS
**Split :** 3 sub-tracks D1 (7 pts) → D2 (7 pts) → D3 (7 pts) séquentiels par le même agent, **1 commit atomique par sub-track** (donc 3 commits pour Track D).

### Prompt

```
Tu es en charge du **Track D — Crypto PAdES POC** de FAKT. C'est le **CHEMIN CRITIQUE TECHNIQUE** du projet : ton travail débloque la signature PAdES (BETA J+17). Budget **7 jours calendaires**, pas 3. Si à J+3 tu n'as pas de POC D1 validé ou si D2 embed PAdES échoue à J+5, **escalade immédiatement à Tom** via rapport intermédiaire.

Tu tournes dans un worktree isolé depuis main HEAD. W0 est mergé.

Le Track D est **split en 3 sub-tracks séquentiels** (D1 → D2 → D3). Tu les enchaînes dans le même worktree mais avec **1 commit atomique par sub-track** (3 commits signés DCO au total).

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles sécurité + légal FR (signature avancée AdES-B-T, jamais "qualifiée").
2. `docs/sprint-plan.md` section **"Track D — Crypto PAdES POC"** — flow 13 étapes + sub-tracks détaillés.
3. `docs/architecture.md` section 7 intégrale (signature PAdES : Appendix B du PRD inclus).
4. `docs/prd.md` FR-002 (cert X.509 auto-généré), FR-017 (signature AdES-B-T), FR-018 (TSA RFC 3161 + audit chain).
5. Crates Rust à utiliser : `lopdf` (PDF mutation), `rsa` (4096), `x509-cert` (builder DER), `cms` (SignedData wrapper), `sha2`, `keyring` (cross-platform), `reqwest` (TSA).

---

## Sub-track D1 — Cert X.509 + Keychain (7 pts)

### Livrables

Dans `apps/desktop/src-tauri/src/crypto/` :

- `cert.rs` :
  - `pub fn generate_self_signed_cert(subject_dn: SubjectDn) -> Result<(Vec<u8> /* x509_der */, Vec<u8> /* rsa_priv_der */), CryptoError>`.
  - Utilise `x509-cert` builder + `rsa::RsaPrivateKey::new(&mut rng, 4096)`, validité 10 ans.
  - `SubjectDn` : `{ common_name, organization?, country: "FR", email? }`.
- `keychain.rs` :
  - Wrapper `keyring` crate avec `service_name = "fakt"` + `account = "cert-main"`.
  - Store `rsa_priv_der` en base64 (value field) + stocker password séparément si configuré.
  - **Fallback AES-256-GCM** : si `keyring::set_password` retourne `PlatformFailure` ou `NoEntry` impossible à écrire, flipper sur chiffrement fichier (path `{tauri_data_dir}/cert-fallback.enc`) avec clé dérivée d'un password user (PBKDF2-SHA256 100k iters). UI doit émettre un warning.
- Tauri commands exposées :
  - `generate_cert(subject_dn) -> Result<CertInfo>`
  - `get_cert_info() -> Result<CertInfo>`
  - `rotate_cert(subject_dn) -> Result<CertInfo>` (garde ancien cert + archive pour audit trail)
- Tests cargo (unit) dans `crypto/tests/cert_roundtrip.rs` :
  - Round-trip store/retrieve sur l'OS courant.
  - CI matrix Windows + macOS + Linux dans `.github/workflows/ci.yml` (à esquisser, pas définitif — Track L le finalise).

### DoD D1

- [ ] Round-trip store/retrieve OK sur Windows + macOS + Linux en tests locaux ou CI.
- [ ] Cert validité 10 ans vérifiée.
- [ ] `SubjectDn` configurable par l'utilisateur (nom workspace).
- [ ] Benchmark : génération < 5s (RSA 4096 lent mais acceptable, premier onboarding uniquement).
- [ ] Fallback AES-256-GCM documenté et testé.

### Commit D1 (atomique)

- Message : `feat(track-d1): cert X.509 RSA 4096 + keychain cross-OS`
- DCO : `git commit -s`
- Body :
  ```
  feat(track-d1): cert X.509 RSA 4096 + keychain cross-OS

  - crypto/cert.rs : generate_self_signed_cert (10y validity, SubjectDn FR)
  - crypto/keychain.rs : wrapper keyring + fallback AES-256-GCM file
  - Tauri commands : generate_cert, get_cert_info, rotate_cert
  - Tests round-trip store/retrieve Windows/macOS/Linux

  Stories: socle US-002
  FRs: FR-002
  Wave: 1 · Track: D1 · Points: 7
  ```

---

## Sub-track D2 — PAdES B-T embed (7 pts)

### Livrables

Dans `apps/desktop/src-tauri/src/crypto/` :

- `pades.rs` :
  - `pub fn embed_signature(pdf_bytes: &[u8], cert_der: &[u8], priv_key_der: &[u8], signature_png: &[u8]) -> Result<Vec<u8> /* signed_pdf */, CryptoError>`.
  - Flow 6 étapes (architecture.md section 7) :
    1. Parse PDF via `lopdf::Document::load_mem`.
    2. Ajouter AcroForm + SigField avec widget annotation (position configurable, signature_png visible).
    3. Calculer `/ByteRange` en excluant la signature dict.
    4. Hash SHA-256 des 2 segments byte range.
    5. Sign hash via `rsa::pkcs1v15::SigningKey::<Sha256>::new(priv_key).try_sign(&hash)`.
    6. Wrapper signature en **CMS SignedData** (DER-encoded) via crate `cms`.
    7. Embedder CMS dans `/Contents` en hex, pad avec zéros jusqu'à taille réservée.
- Tests cargo + fixture : signer un PDF minimaliste, écrire le résultat dans `crypto/tests/output/signed.pdf`.

### DoD D2

- [ ] PDF signé ouvre dans **Adobe Acrobat Reader** avec signature verte "valide, cert self-signed non-trusted" (acceptable pour AdES-B-T sans qualification).
- [ ] Validation manuelle obligatoire par Tom (ou toi-même si Adobe Reader dispo) — screenshot dans rapport.
- [ ] Hash `/ByteRange` cohérent avec la signature (pas de drift).
- [ ] Benchmark : embed signature < 500 ms (NFR-002).

### Commit D2 (atomique)

- Message : `feat(track-d2): PAdES B-T embed via lopdf + cms`
- DCO : `git commit -s`
- Body :
  ```
  feat(track-d2): PAdES B-T embed via lopdf + cms

  - crypto/pades.rs : embed_signature (parse, AcroForm, ByteRange, hash, sign, CMS, embed)
  - Fixture PDF signé validé Adobe Reader (signature verte AdES-B-T)
  - Benchmark embed < 500ms

  Stories: socle US-019
  FRs: FR-017
  Wave: 1 · Track: D2 · Points: 7
  ```

---

## Sub-track D3 — TSA RFC 3161 + Audit trail (7 pts)

### Livrables

Dans `apps/desktop/src-tauri/src/crypto/` :

- `tsa.rs` :
  - Client RFC 3161 via `reqwest`.
  - Endpoint primaire : **FreeTSA** (`https://freetsa.org/tsr`).
  - Fallbacks ordonnés : DigiCert (`http://timestamp.digicert.com`), Sectigo (`http://timestamp.sectigo.com`).
  - Timeout 10s par endpoint, retry 1 fois chacun avant fallback suivant.
  - Retourne `TimestampToken` DER à embedder dans le CMS SignedAttributes (Signature Timestamp).
- `audit.rs` :
  - `pub fn append_signature_event(prev_hash: [u8; 32], event_data: SignatureEvent) -> Result<[u8; 32] /* new_hash */>`.
  - SHA-256 chaîné : `new_hash = sha256(prev_hash || serialize(event_data))`.
  - Insert en DB via Tauri event `db.signature_events.insert` (appel TS côté consumer — évite coupling Rust→TS direct).
- Tauri commands :
  - `sign_document(doc_id: String, signature_png: Vec<u8>) -> Result<Vec<u8> /* signed_pdf */>` **orchestre D1 (retrieve cert) + D2 (embed signature) + D3 (TSA timestamp + audit)**.
- Tests cargo + E2E : fixture PDF + sign → vérifie signature valide + TSA timestamp embedded + audit event inséré avec hash chaîné correct.

### DoD D3

- [ ] Timestamp TSA visible dans les signature properties d'Adobe Reader.
- [ ] Audit event inséré avec hash chaîné SHA-256 correct (vérif : 2 signatures consécutives → chaîne cohérente).
- [ ] Cross-OS : CI verte matrix Windows + macOS + Linux (mock TSA endpoint en CI pour déterminisme, le vrai TSA reste pour E2E locaux).
- [ ] Benchmark : signature complète (D1+D2+D3) < 1.5s (dont < 500 ms embed + < 1s TSA round-trip tolérable).

### Commit D3 (atomique)

- Message : `feat(track-d3): TSA RFC 3161 + audit trail chaîné`
- DCO : `git commit -s`
- Body :
  ```
  feat(track-d3): TSA RFC 3161 + audit trail chaîné

  - crypto/tsa.rs : client FreeTSA + fallbacks DigiCert/Sectigo
  - crypto/audit.rs : append_signature_event (SHA-256 chaîné)
  - Tauri command sign_document orchestre D1+D2+D3
  - Tests E2E mock TSA + audit chain verification

  Stories: socle US-020
  FRs: FR-018
  Wave: 1 · Track: D3 · Points: 7
  ```

---

## Règles globales Track D

- **Ne pas push.** Tom review les 3 commits avant merge.
- Si blocage à mi-sub-track, commit en `wip(track-dX): ...` avec body explicatif et escalade.
- **Escalade obligatoire** si J+3 D1 pas passé, ou J+5 D2 pas validé Adobe Reader.
- Ne pas écrire de code crypto "approximatif". Préférer vendor bien établi (crates `ring`, `rsa`, `cms`, `x509-cert` maintenus par RustCrypto) plutôt que rolling own crypto.

## Rapport final (< 500 mots, français, plus long car 3 sub-tracks)

- Livrables D1 / D2 / D3 : checklist détaillée.
- Validation Adobe Reader : screenshot ou description précise du résultat.
- Benchmarks : génération cert / embed signature / full sign.
- Blockers cross-OS : problèmes spécifiques à un OS, workarounds appliqués.
- Commits : 3 hashes + branche worktree.
- Risques conso W3 Track I : api signature exposée aux consumers TS, format stable ?
```

---

## Track E — AI Claude CLI wrapper (8 pts)

**Agent type :** `general-purpose`
**Model :** `sonnet`
**Name :** `w1-track-e-ai`
**Description :** AiProvider + ClaudeCliProvider subprocess

### Prompt

```
Tu construis **packages/ai** pour FAKT — wrapper subprocess autour de Claude Code CLI (jamais SDK embarqué en MVP, décision archi non-négociable : le user fournit son propre token Anthropic). Tu tournes dans un worktree isolé depuis main HEAD. W0 est mergé.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles IA : subprocess uniquement, jamais SDK en MVP.
2. `docs/sprint-plan.md` section **"Track E — AI Claude CLI wrapper"** — livrables + DoD.
3. `docs/architecture.md` section 11 (AI layer : interface abstraite swapable v0.2 vers SDK).
4. `docs/prd.md` FR-003 (health check CLI), FR-009 (composer extraction devis), FR-025 (composer sidebar).
5. **Doc CLI Claude** : lancer `claude --help` en local pour identifier les flags disponibles (format de sortie, streaming, non-interactive mode).
6. `.design-ref/chats/chat1.md` (si existe) pour le prompt template d'extraction devis testé manuellement par Tom.

## Livrables (sprint-plan Track E)

Dans `packages/ai/src/` :

- `provider.ts` — interface abstraite :
  ```ts
  export interface AiProvider {
    extractQuoteFromBrief(brief: string, opts?: ExtractOpts): AsyncIterable<AiStreamEvent<ExtractedQuote>>;
    draftEmail(context: EmailContext, opts?: DraftOpts): AsyncIterable<AiStreamEvent<string>>;
    healthCheck(): Promise<CliInfo>;
  }
  export type AiStreamEvent<T> =
    | { type: 'delta', data: Partial<T> }
    | { type: 'done', data: T }
    | { type: 'error', message: string };
  ```
  L'interface doit être **totalement swapable** vers un futur `AgentSdkProvider` v0.2. Aucun consumer n'importe `ClaudeCliProvider` concret.

- `providers/claude-cli.ts` — implémentation :
  - Appelle Tauri command `spawn_claude` avec un `Channel<AiStreamEvent>` (pattern Tauri 2 streaming).
  - Parse stdout line-by-line en `AiStreamEvent`.

- `prompts/` — templates markdown :
  - `extract_quote.md` : prompt + variables `{{brief}}`, `{{workspace_context}}`, output schema JSON.
  - `draft_email.md` : prompt relance/envoi, variables `{{client_name}}`, `{{amount}}`, `{{due_date}}`, `{{tone: formal|friendly}}`.
  - `reminder.md` : relance impayée 30j+.

- `health.ts` :
  - `healthCheck(): Promise<CliInfo>` → exécute `claude --version` + `which claude`, renvoie `{ installed: boolean, version?: string, path?: string, installHint?: string }`.
  - `installHint` donne instruction selon OS (ex: "Installer Claude Code : https://claude.ai/code").

- `providers/mock.ts` — `MockAiProvider` qui lit fixtures `tests/fixtures/*.json` pour tests déterministes en CI.

Dans `apps/desktop/src-tauri/src/ai/cli.rs` :

- `spawn_claude(prompt_path: String, vars_json: String, channel: Channel<AiStreamEvent>) -> Result<()>`.
- Utilise `tokio::process::Command::new("claude")` avec flags non-interactifs + stdin = prompt rendu + vars.
- Pipe stdout line-by-line, parse lignes JSON (format CLI à vérifier avec `claude --help`), `channel.send(AiStreamEvent::Delta { text })`.
- Timeout 60s par stream avant erreur.

## Règles critiques

- **Pas de SDK embarqué** (décision archi). Subprocess uniquement.
- **Mode mock CI obligatoire** : `FAKT_AI_PROVIDER=mock` dans tests CI → lit fixtures au lieu de spawner CLI.
- **Streaming correct** : le composer UI consomme en temps réel, chaque événement rend le partial `ExtractedQuote` à l'écran. Pas de blocage "tout ou rien".
- **Pas de fuite** du token Anthropic : jamais log les args CLI en clair. Le token est géré par `claude` CLI, pas par FAKT.
- **Gestion erreur CLI manquant** : `healthCheck` retourne `installed: false` + UI affiche `installHint` lien vers https://claude.ai/code, **ne crash pas** l'app.

## DoD Track E

- [ ] `healthCheck` détecte Claude CLI installé sur les 3 OS (Windows + macOS + Linux).
- [ ] `extractQuoteFromBrief` streaming marche en dev (test manuel avec un brief simple → voir `ExtractedQuote` en streaming).
- [ ] `MockAiProvider` utilisable en tests sans CLI présent.
- [ ] Coverage Vitest ≥ 80% sur `packages/ai` (via mock).
- [ ] Interface `AiProvider` 100% swapable : aucun consumer externe n'importe `ClaudeCliProvider` directement.
- [ ] `bun run typecheck` et `bun run test` passent sur `packages/ai`.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-e): AI Claude CLI wrapper subprocess + streaming`
- **DCO sign-off obligatoire :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-e): AI Claude CLI wrapper subprocess + streaming

  - AiProvider interface swapable (vers SDK v0.2)
  - ClaudeCliProvider via Tauri command spawn_claude + Channel streaming
  - MockAiProvider pour tests déterministes CI
  - Prompts markdown : extract_quote, draft_email, reminder
  - healthCheck cross-OS avec installHint si CLI absent
  - Rust side : tokio process + stdout pipe line-by-line

  Stories: socle US-003/008/028
  FRs: FR-003, FR-009
  Wave: 1 · Track: E · Points: 8
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Ne pas push.**

## Rapport final (< 300 mots, français)

- Livrables : checklist composants (AiProvider, ClaudeCliProvider, MockAiProvider, prompts, healthCheck, Rust spawn).
- DoD : 6 gates OK/KO.
- Commit : hash + branche.
- **Test manuel streaming** : brief fourni + résultat (capture rapide).
- Blockers : format de sortie CLI non stable, CLI manquant sur OS X.
- Risques conso W2 Track H : interface suffisante pour composer sidebar (US-028) ?
```

---

## Merge strategy fin de Wave 1

Quand les 5 tracks A/B/C/D ont produit leurs commits :

1. Tom pull chaque worktree, fait un `bun install && bun run typecheck && bun run test` sur la branche merge candidate.
2. Review rapide du rapport agent + diff principal.
3. Merge séquentiel dans `main` via `git merge --ff-only` (ou `--no-ff` si volonté de conserver branche). Ordre suggéré : **B → A → E → C → D** (B débloque le plus, D commit séparé par sub-track donc mergeable indépendamment si D1 prêt avant D2/D3).
4. Tag `wave-1-done` sur main après les 5 merges.
5. Update `docs/sprint-status.yaml` : statuses `W1 tracks A/B/C/D/E = completed`, `current_wave: 2`.
6. Lancer immédiatement Wave 2 : tracks F (Onboarding), G (Clients+Prestations), H (Devis+Factures split H1/H2/H3).

---

## Escalade

Si un track remonte un blocker majeur :
- **Track D (chemin critique)** : escalade immédiate via rapport intermédiaire, Tom décide fallback wrapper OpenSSL C# via P/Invoke.
- **Autres tracks** : commit `wip(track-X): ...` avec note dans body + ouvrir un `docs/sprint-notes/<track>-<date>.md` avec détails.
