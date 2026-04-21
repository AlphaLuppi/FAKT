# Sprint Plan FAKT v0.1.0 — Agent Team Parallèle

**Date :** 2026-04-21
**Scrum Master :** Claude agent (synthèse from Tom Andrieu / AlphaLuppi)
**Projet :** FAKT (AlphaLuppi/FAKT)
**Niveau :** 3
**Stratégie :** 4 Waves × tracks parallèles · 3 milestones livrables indépendants
**Objectif principal :** livrer une ALPHA utilisable en ≤ 2 semaines qui remplace les skills `/devis-freelance` et `/facture-freelance`, puis itérer vers BETA (signature) puis v0.1.0 publique.

---

## Executive summary

FAKT est un projet L3 de 28 stories que Tom va exécuter via une **équipe d'agents Claude Code parallèles**. La contrainte dominante n'est pas la capacité individuelle d'un agent mais **le sérialisme des dépendances**. Ce sprint plan est optimisé pour :

1. **Réduire Wave 0 (fondations bloquantes) à 1-2 jours max** — tout le reste doit pouvoir se débloquer en vagues parallèles.
2. **Identifier le chemin critique** (PAdES POC = le plus long techniquement) et **le kicker en Wave 1 même s'il ne sera consommé qu'en Wave 3** pour masquer sa latence.
3. **Livrer une ALPHA** (remplace les skills sans signature) **avant** de construire la signature — Tom bénéficie de FAKT à J+10 environ, pas J+21.
4. **Briefings agents prêts-à-coller** — chaque track a sa section avec inputs, outputs, DoD, et prompt de kick-off que Tom peut lancer en `Agent({subagent_type, prompt})` directement.

### Métriques clés

| Métrique | Valeur |
|---|---|
| Total stories | 28 |
| Total story points | ~170 |
| Sprints classiques | 3 (Alpha / Beta / Release) |
| Waves parallèles | 4 (W0 fondations, W1 tracks, W2 features alpha, W3+W4 signature+release) |
| Tracks parallèles max simultanés | 5 (Wave 1) |
| Calendrier cible avec 3-5 agents en parallèle | ~3 semaines (21 jours calendaires) |
| Milestone ALPHA (remplace skills) | J+10 |
| Milestone BETA (+ signature) | J+17 |
| Milestone v0.1.0 public | J+21 (avant 2026-05-12) |

### Les 3 milestones

- **🟡 ALPHA J+10** — FAKT installable en dev local. Tom peut saisir clients + prestations, créer devis + facture, rendre PDF conforme CGI, numérotation séquentielle, dashboard basique. **Signature, email .eml, installers signés = pas encore.** **But : Tom arrête d'utiliser les skills à ce moment.**
- **🟠 BETA J+17** — + Signature PAdES B-T avec audit trail + UI complète Brutal Invoice (dashboard KPIs, composer IA sidebar, vue détail timeline).
- **🟢 v0.1.0 J+21** — + Email .eml multi-OS + archive ZIP + installers code-signés Win/Mac + landing page + release GitHub publique.

### Règles d'exécution agent team

1. **Un track = un agent autonome.** Chaque track est self-contained avec brief, inputs files à lire, outputs à produire, DoD.
2. **Worktree isolé par track** quand possible (`Agent({isolation: "worktree"})`) — évite les collisions de fichiers entre tracks parallèles.
3. **Le track-leader humain (Tom) merge les worktrees** en fin de wave dans `main` après revue rapide.
4. **Tests avant merge** : chaque track doit faire passer `bun run typecheck && bun run test` sur son périmètre avant de valider.
5. **Un track bloqué n'en bloque pas un autre** — les dépendances amont sont explicites dans chaque brief. Si amont non prêt, l'agent travaille sur stubs/mocks et note la dette dans `TODO.md` du track.
6. **Pas de scope creep** — si un agent découvre un besoin hors-track, il ouvre une note dans `docs/sprint-notes/{track}-{date}.md`, n'élargit pas son scope.
7. **UN COMMIT ATOMIQUE par agent** (non-négociable). À la fin de son travail, l'agent produit un seul commit conventional + sign-off DCO : `feat(track-<ID>): <description>` via `git commit -s`. Si un track est split en sub-tracks (ex H1/H2/H3), 1 commit atomique par sub-track. Permet rollback/revert propre track par track, blame lisible, merge queue clean. **Aucun commit intermédiaire sauf instruction contraire.** Si blocker à mi-chemin, l'agent commit en `wip(track-XX): <description>` avec note dans le body et escalade.

---

## Stratégie de parallélisation

### Chemin critique identifié

```
W0 Fondations (bloque tout) → 1-2 j
  ↓
  ├── Track A UI prims ────────────┐
  ├── Track B DB queries ──────────┤
  ├── Track C PDF Typst ───────────┼─→ W2 Features Alpha (3 tracks) ─→ ALPHA J+10
  ├── Track D Crypto PAdES (LONG) ─┤                                    ↓
  └── Track E AI Claude CLI ───────┘                                    ↓
                                                                        ↓
                                    Track I Signature flow ←────────────┤
                                    Track J Dashboard+UI avancé ────────┼─→ BETA J+17
                                                                        ↓
                                                                        ↓
                                    Track K Email + Archive ────────────┤
                                    Track L CI + Release + Docs ────────┴─→ v0.1.0 J+21
```

**Track D (Crypto PAdES)** est le **chemin critique technique** : POC obligatoire semaine 1 (PRD Appendix B, complexité haute). Il **démarre dès J+3** (W1) même si ses outputs ne sont consommés qu'en W3. Cela évite que la signature devienne le goulot qui repousse v0.1.0.

### Découpage par agent type

Recommandation `subagent_type` pour chaque track :

| Track | Agent type | Model | Raison |
|---|---|---|---|
| W0 Fondations | `general-purpose` | sonnet | Beaucoup de scaffolding, peu de décisions créatives |
| A UI primitives | `feature-dev:code-architect` | sonnet | Design system → composants, besoin d'architecture cohérente |
| B DB queries | `general-purpose` | sonnet | CRUD standard, TDD simple |
| C PDF Typst | `feature-dev:code-explorer` puis `feature-dev:code-architect` | sonnet | Besoin d'analyser templates skills legacy d'abord |
| D Crypto PAdES | `general-purpose` | opus | Complexité haute, risque technique, demander le modèle le plus capable |
| E AI Claude CLI | `general-purpose` | sonnet | Wrapper subprocess standard |
| F Onboarding | `feature-dev:code-architect` | sonnet | Flow multi-étapes + intégration cert |
| G Clients/Prestations | `general-purpose` | sonnet | CRUD UI standard |
| H Devis+Facture | `feature-dev:code-architect` | opus | Cœur métier, logique numérotation + PDF + edit = critique |
| I Signature flow | `feature-dev:code-architect` | opus | Intégration UI ↔ crypto Rust complexe |
| J Dashboard avancé | `feature-dev:code-architect` | sonnet | UI riche avec KPIs + composer + timeline |
| K Email + Archive | `general-purpose` | sonnet | Implémentation standard |
| L CI + Release | `general-purpose` | sonnet | DevOps classique, mais besoin secrets Apple/Windows |

---

## Wave 0 — Fondations (J1-J2) · 25 pts · SÉQUENTIEL

**But :** tout doit être prêt pour que W1 puisse paralléliser sans collisions. **Un seul agent** (general-purpose sonnet) pour assurer la cohérence.

### W0.1 Scaffold monorepo Bun (5 pts)

- `package.json` racine avec Bun workspaces : `apps/*`, `packages/*`.
- `turbo.json` ou scripts Bun natifs pour orchestration (choix doc archi = Turborepo 2.x).
- `biome.json` config lint+format global.
- `tsconfig.base.json` strict + paths mapping.
- `.gitignore`, `.editorconfig`, `.gitattributes`.
- `CODEOWNERS`, `CONTRIBUTING.md` (DCO), `LICENSE` (BSL 1.1).

### W0.2 packages/design-tokens (3 pts)

- Port de `.design-ref/gestion-de-facture-et-devis/project/colors_and_type.css` → CSS vars typed.
- Export `tokens.ts` avec constantes Brutal Invoice (couleurs, shadows, radii=0, typo, spacing).
- Plugin Tailwind v4 (`tailwind-plugin.ts`) consommant les tokens.
- DoD : `import { tokens } from '@fakt/design-tokens'` marche.

### W0.3 packages/shared (2 pts)

- `types/ipc.ts` : types TS des commandes Tauri (à étoffer par chaque track).
- `types/domain.ts` : types domain communs (Id, Money, Percentage, DateIso, LocaleFr).
- `i18n/fr.ts` : dictionnaire complet FR (toutes strings UI, messages erreurs, mentions légales) — **source de vérité**.
- `utils/money.ts` : format FR EUR, conversion cents.
- `utils/date.ts` : format FR, calculs échéances.

### W0.4 packages/db (5 pts)

- Drizzle schema depuis `docs/architecture.md` section 5.3 (13 tables).
- `drizzle.config.ts` pointant SQLite (solo) + PostgreSQL (commented v0.2).
- `migrations/0000_initial.sql` générée via `drizzle-kit generate`.
- `src/index.ts` export `createDb(adapter)` factory.
- `src/seed.ts` pour dev (1 workspace, 3 clients démo, 5 prestations démo).
- Triggers SQL append-only + immutable numbers + no hard-delete (architecture.md section 5.4).

### W0.5 packages/core (3 pts)

- `src/models/quote.ts`, `src/models/invoice.ts`, `src/models/client.ts`, `src/models/prestation.ts`, `src/models/numbering.ts`.
- Fonctions pures : `computeQuoteTotal(items)`, `computeInvoiceTotal(items, discount, deposit)`, `formatQuoteNumber(year, seq)`, `formatInvoiceNumber(year, seq)`.
- Validation Zod pour chaque DTO.
- Tests Vitest coverage ≥ 80% (domaine pur facile à tester).

### W0.6 packages/legal (2 pts)

- `src/mentions.ts` : `getMandatoryMentions({ regime, type, amount })` retourne array de mentions FR.
- `src/siret.ts` : validator + formatter SIRET.
- `src/vat.ts` : `isVatExempt(regime)` + message "TVA non applicable, art. 293 B du CGI" hardcodé.
- `src/penalties.ts` : mention indemnité 40€ + taux pénalités.

### W0.7 apps/desktop scaffold Tauri 2 (3 pts)

- `apps/desktop/src-tauri/` avec `Cargo.toml` minimal + `tauri.conf.json`.
- Stub Tauri command `ping` + `get_version`.
- `apps/desktop/src/` avec React 19 + Vite 6 + Tailwind v4 + router v7 skeleton.
- Layout vide avec sidebar + topbar issu de `.design-ref/.../shell.jsx` (placeholder).
- `bun run dev` lance Vite HMR + `tauri dev` en parallèle.
- `bun run tauri build` produit un binaire local non-signé (smoke test).

### W0.8 packages/config (2 pts)

- `src/workspace.ts` : lecture/écriture workspace settings (nom, SIRET, adresse, IBAN, logo path).
- `src/keychain.ts` : wrapper `keyring` (appelle Tauri command Rust side) pour stocker cert X.509 + password.
- Types partagés avec `@fakt/shared`.

**DoD Wave 0 :**
- [ ] `bun install` à la racine réussit sans warning bloquant.
- [ ] `bun run typecheck` global passe sur tous les packages.
- [ ] `bun run dev` démarre Vite + tauri dev en parallèle, fenêtre s'ouvre.
- [ ] `bun run test` passe sur packages/core + packages/legal.
- [ ] Commit conventionnel avec sign-off DCO.

**Output Wave 0 :** squelette monorepo mergeable. **Tous les autres tracks peuvent démarrer.**

---

## Wave 1 — 5 Tracks parallèles (J3-J7) · 63 pts · FULL PARALLÈLE

**But :** construire en parallèle les 5 piliers techniques qui alimentent les features Alpha. **5 agents simultanés**, worktrees isolées.

### Track A — UI Components Brutal Invoice (13 pts)

**Agent type :** `feature-dev:code-architect` sonnet
**Inputs :** `packages/design-tokens/` · `.design-ref/gestion-de-facture-et-devis/project/components/*.jsx` · `docs/architecture.md` section 10.
**Outputs :** `packages/ui/` avec composants React 19 typés, indexés.

**Stories couvertes :** socle pour US-001, US-005, US-006, US-008, US-009, US-023, US-025, US-026, US-027, US-028.

**Composants à livrer :**

- `Button` (primary/secondary/ghost/danger, sizes sm/md/lg, hover inversion #000↔#FFFF00).
- `Input` (text, number, date, textarea), `Select`, `Checkbox`, `Radio`.
- `Card` (borders 2.5px, shadow 3px/5px/8px variants).
- `Table` (sortable columns, filterable, virtualized for > 100 rows).
- `Sidebar` + `Topbar` + shell layout (issu `shell.jsx`).
- `Modal` + `Overlay` + `CommandPalette` (⌘K).
- `Chip`, `Avatar`, `Sparkline`, `Breadcrumb`.
- `Toast` via sonner (avec styling Brutal).
- `Canvas` signature primitive (HTML5 canvas avec export PNG dataURL).
- `StatusPill` pour cycle vie devis/facture.

**DoD :**
- [ ] Tous composants typés strict.
- [ ] Story/example dans `packages/ui/examples/` pour chaque composant.
- [ ] Snapshot tests Vitest + @testing-library/react.
- [ ] Aucun `border-radius > 0` sauf loaders. Aucun gradient. Aucun blur.
- [ ] Dark mode = non (canvas papier `#F5F5F0` forcé, design non-négociable).

### Track B — DB Queries + Adapters (8 pts)

**Agent type :** `general-purpose` sonnet
**Inputs :** `packages/db/` (schema W0) · `docs/architecture.md` section 5.
**Outputs :** `packages/db/queries/*.ts` (CRUD typés par entité) + tests.

**Stories couvertes :** socle pour US-005, US-006, US-010, US-011, US-014, US-015, US-017, US-024.

**À livrer :**

- `queries/clients.ts` : list, get, create, update, softDelete, search.
- `queries/prestations.ts` : idem.
- `queries/quotes.ts` : list, get (with items), create, update, delete(draft-only), updateStatus, search.
- `queries/invoices.ts` : list, get, create, createFromQuote, update, markPaid, cannotDeleteIssued.
- `queries/numbering.ts` : `nextQuoteNumber(workspaceId)` + `nextInvoiceNumber(workspaceId)` appelant atomique Rust (command Tauri `numbering_next`).
- `queries/signatures.ts` : `appendSignatureEvent` (append-only), `getSignatureChain(docId)`.
- `queries/settings.ts` : get/update workspace.
- Tests : fixtures SQLite in-memory, coverage ≥ 80%.

**Note atomique numbering :** track B expose l'API TS, track D fournit l'implémentation Rust atomique. En W1 track B utilise stub TS simple (non-atomique) en attendant, note la dette dans `TODO.md`.

### Track C — PDF Typst + Templates (13 pts)

**Agent type :** `feature-dev:code-explorer` puis `feature-dev:code-architect` sonnet
**Inputs :** `.design-ref/gestion-de-facture-et-devis/project/uploads/devis-freelance.skill` + `facture-freelance.skill` (ZIP à ouvrir, contient SKILL.md + references/template.md = **source de vérité** des templates legacy). `docs/architecture.md` section 9. Memory `design_bundle_path.md`.
**Outputs :** `packages/pdf/` avec wrapper Typst + templates `.typ` + Tauri command `render_pdf`.

**Stories couvertes :** US-012, FR-012 + socle pour EPIC-004.

**Étape 1 (exploration) :**
- Extraire les 2 ZIP skills dans un temp dir.
- Lire `SKILL.md` + `references/template.md` pour chaque.
- Noter la charte : couleur principale #2E5090 (bleu), Arial-like, numérotation F2026-XXX, mentions FR.
- Lister les blocs (header workspace, header client, table prestations, totaux, mentions légales, signature zone).

**Étape 2 (portage Typst) :**
- `packages/pdf/templates/base.typ` : macros communs (couleurs, typo, spacing, helpers format EUR/date FR).
- `packages/pdf/templates/partials/` : `header-workspace.typ`, `header-client.typ`, `items-table.typ`, `totals.typ`, `legal-mentions.typ`, `signature-block.typ`.
- `packages/pdf/templates/quote.typ` : compose les partials pour un devis.
- `packages/pdf/templates/invoice.typ` : compose les partials pour une facture.
- **Liberté créative** sur typographie et layout, mais la charte doit rester reconnaissable (bleu #2E5090, structure globale).

**Étape 3 (wrapper Rust + TS) :**
- `apps/desktop/src-tauri/src/pdf/render.rs` : Tauri command `render_pdf(doc_type, data_json) → Vec<u8>`. Utilise **crate `typst`** embarqué (pas CLI — décision archi).
- `packages/pdf/src/index.ts` : wrapper TS `renderPdf(dto: QuoteDto | InvoiceDto): Promise<Uint8Array>` via `invoke`.
- Fallback : si crate Typst trop lourde en binary size, flipper vers Typst CLI avec `which typst` check (décision à valider en POC J3-J5).

**Étape 4 (tests) :**
- Fixtures : 3 quotes + 3 invoices en JSON.
- Snapshot tests sur hash byte-perfect (Typst est déterministe à inputs identiques).
- Validation visuelle manuelle obligatoire par Tom sur 1 devis + 1 facture avant merge.

**DoD :**
- [ ] PDF généré < 3s pour devis 10 lignes (NFR-002).
- [ ] Toutes mentions légales obligatoires présentes (FR-016).
- [ ] Numéro D2026-XXX / F2026-XXX visible en haut à droite.
- [ ] Reconnaissable comme FAKT-made par Tom (pas juste "Typst default").

### Track D — Crypto PAdES POC (21 pts → split en 3 sub-tracks de 7 pts) · CHEMIN CRITIQUE

**Agent type :** `general-purpose` **opus** (complexité haute, risque technique)
**Inputs :** `docs/architecture.md` section 7 (PAdES flow complet 13 étapes) · crates Rust identifiées : `lopdf`, `rsa`, `x509-cert`, `cms`, `sha2`, `keyring`, `reqwest`.
**Outputs :** `apps/desktop/src-tauri/src/crypto/` complet avec POC validé Adobe Reader.

**Stories couvertes :** FR-002, FR-017, FR-018. Socle pour EPIC-005 (consommé en W3).

**Sub-track D1 — Cert X.509 + Keychain (7 pts) :**

- `cert.rs` : `generate_self_signed_cert(subject_dn) → (x509_der, rsa_priv_der)` via `x509-cert` builder + `rsa::RsaPrivateKey::new(4096, 10y validity)`.
- `keychain.rs` : wrapper `keyring` crate avec service name `fakt` + account `cert-main`. Store `rsa_priv_der` en value (base64) + password stockable.
- Fallback AES-256-GCM si keyring indispo sur target OS (détection auto + UI warning).
- Tauri commands : `generate_cert`, `get_cert_info`, `rotate_cert`.
- Tests cargo : round-trip store/retrieve sur les 3 OS en CI.

**Sub-track D2 — PAdES B-T embed (7 pts) :**

- `pades.rs` : fonction `embed_signature(pdf_bytes, cert_der, priv_key_der, signature_png) → signed_pdf_bytes`.
- Flow (architecture.md section 7) :
  1. Parse PDF via `lopdf`.
  2. Ajouter AcroForm + SigField.
  3. Calculer hash `/ByteRange` exclusion de la signature dict.
  4. Signer hash via `rsa::pkcs1v15::SigningKey<Sha256>`.
  5. Wrapper en CMS SignedData via crate `cms`.
  6. Embedder dans /Contents.
- Tests cargo : signer PDF fixture, vérifier avec Adobe Reader **manuellement** (critère DoD critique).

**Sub-track D3 — TSA RFC 3161 + Audit trail (7 pts) :**

- `tsa.rs` : client RFC 3161 via `reqwest`. Endpoints primaire FreeTSA + fallbacks DigiCert + Sectigo. Timeout 10s avec retry.
- `audit.rs` : fonction `append_signature_event(prev_hash, event_data) → new_hash`. SHA-256 chaîné. Insert via Drizzle (appel TS depuis Rust via Tauri event `db.signature_events.insert`).
- Tauri commands : `sign_document(doc_id, signature_png) → signed_pdf_bytes` (orchestre D1+D2+D3).
- Tests cargo + E2E : fixture PDF + sign → valid signature + TSA timestamp embedded + audit event inserted.

**DoD Track D (toute la signature intégrée) :**
- [ ] PDF signé ouvre dans Adobe Reader avec signature verte "valide, cert self-signed non-trusted" (acceptable pour AdES-B-T).
- [ ] Timestamp TSA visible dans les signature properties.
- [ ] Audit event inséré avec hash chaîné SHA-256 correct.
- [ ] Benchmark : signature embed < 500 ms.
- [ ] Cross-OS : CI verte sur Windows + macOS + Linux (mock TSA en CI pour déterminisme).

### Track E — AI Claude CLI wrapper (8 pts)

**Agent type :** `general-purpose` sonnet
**Inputs :** `docs/architecture.md` section 11 · Claude CLI docs (local `claude --help` pour flags disponibles) · memory `design_bundle_path.md` pour le prompt d'extraction depuis `chats/chat1.md`.
**Outputs :** `packages/ai/` avec `AiProvider` interface + `ClaudeCliProvider` implémentation + Tauri command streaming.

**Stories couvertes :** FR-003, FR-009. Socle pour US-028 (composer IA sidebar).

**À livrer :**

- `packages/ai/src/provider.ts` : interface `AiProvider` avec méthodes `extractQuoteFromBrief(brief: string): AsyncIterable<ExtractedQuote>` et `draftEmail(context: EmailContext): AsyncIterable<string>` + `healthCheck(): Promise<CliInfo>`.
- `packages/ai/src/providers/claude-cli.ts` : implémentation via Tauri command `spawn_claude` avec `Channel<AiStreamEvent>`.
- `apps/desktop/src-tauri/src/ai/cli.rs` : `tokio::process::Command::new("claude")`, pipe stdout line-by-line, `channel.send(AiStreamEvent::Delta { text })`.
- `packages/ai/src/prompts/` : fichiers markdown `extract_quote.md`, `draft_email.md`, `reminder.md` avec templates + variables.
- `packages/ai/src/health.ts` : détecte `claude --version`, renvoie `{ installed, version, path }` pour FR-003.
- Mode mock CI : `MockAiProvider` lit fixtures `tests/fixtures/ai/*.json` pour tests déterministes.

**DoD :**
- [ ] `healthCheck` détecte Claude CLI installé sur les 3 OS.
- [ ] Streaming marche en dev (brief → ExtractedQuote visible en UI temps réel).
- [ ] Tests unitaires avec MockAiProvider > 80% coverage.
- [ ] Interface `AiProvider` est complètement swapable vers un futur `AgentSdkProvider` v0.2 (aucun import concret du CLI exposé côté consumers).

---

## Wave 2 — 3 Tracks features ALPHA (J7-J12) · 50 pts · PARALLÈLE max

**But :** empiler les features sur les fondations W1 pour livrer **l'ALPHA que Tom utilise à la place de ses skills**. **3 agents simultanés.**

**Dépendances :** Wave 1 terminée (tracks A, B, C, E). Track D peut encore être en cours (signature = W3).

### Track F — Onboarding + Settings (8 pts)

**Agent type :** `feature-dev:code-architect` sonnet
**Stories :** US-001, US-002, US-003, US-004 (EPIC-001)
**Inputs :** W1 outputs (ui, db, ai, crypto pour génération cert). `docs/prd.md` FR-001 à FR-004.
**Outputs :** `apps/desktop/src/routes/onboarding/*` + `routes/settings/*`.

**À livrer :**

- Wizard first-launch multi-étapes :
  1. Identité (nom workspace, SIRET + validation, adresse, IBAN + validation).
  2. Claude CLI check (healthCheck via `packages/ai`, installer helper si absent).
  3. Génération cert X.509 (spinner pendant 2s, appelle `generate_cert`).
  4. Récap + "C'est parti" → redirige dashboard.
- Condition d'affichage : `workspace.setupCompletedAt IS NULL` → wizard, sinon dashboard.
- Settings page : 4 tabs (Identité, Claude CLI, Certificat, Télémétrie/Avancé).
- Onglet Certificat : afficher DN + validité + bouton "Régénérer" (avec warning perte audit trail historique).
- Onglet Télémétrie : Plausible opt-in désactivé par défaut (NFR respect).

**DoD :**
- [ ] Wizard se complète en < 3 min (US-001 AC).
- [ ] Cert généré + stocké + récupérable (FR-002 AC via track D).
- [ ] Settings update persist correctement via `@fakt/config`.
- [ ] Tests Playwright E2E du flow complet.

### Track G — Clients + Prestations (8 pts)

**Agent type :** `general-purpose` sonnet
**Stories :** US-005, US-006, US-007 (EPIC-002)
**Inputs :** W1 outputs (ui, db). Design ref `.design-ref/.../project/components/lists.jsx` pour tables.
**Outputs :** `apps/desktop/src/routes/clients/*`, `routes/prestations/*`, `components/command-palette/*`.

**À livrer :**

- Route `/clients` : liste Table (tri + filtre + recherche), bouton "Nouveau client" → Modal form.
- Route `/prestations` : idem.
- Form client : nom, contact, email, téléphone, adresse, SIRET (opt), notes. Zod validation.
- Form prestation : nom, description, prix unitaire, unité (heure/jour/forfait), catégorie.
- Soft delete avec confirmation + vue "Corbeille" accessible via filtre.
- Command palette ⌘K (US-007) : search cross-entity (clients + prestations + devis + factures) avec fuzzy matching via `fuzzysort`.

**DoD :**
- [ ] CRUD complet fonctionnel sur les 2 entités.
- [ ] ⌘K ouvre en < 100ms (NFR-001 UI responsive).
- [ ] Tests Playwright E2E : add → edit → delete → restore.

### Track H — Devis + Factures (le cœur alpha) (34 pts → split en H1/H2/H3)

**Agent type :** `feature-dev:code-architect` **opus**
**Stories :** EPIC-003 (US-008 à US-013) + EPIC-004 (US-014 à US-017)
**Inputs :** W1 complet (ui, db, pdf, ai). Legacy skills templates pour référence. Design `.design-ref/.../project/components/composer.jsx` + `detail-signature.jsx` + `doc-preview.jsx`.
**Outputs :** `apps/desktop/src/routes/quotes/*`, `routes/invoices/*`, `components/composer/*`, `components/doc-editor/*`.

#### Sub-track H1 — Devis création + édition + PDF (13 pts)

Stories : US-008, US-009, US-010, US-011, US-012.

- Route `/quotes` liste + bouton "Nouveau devis".
- Route `/quotes/new?mode=manual` : form avec client picker + items editor (add/remove lignes, recalcul live TTC).
- Route `/quotes/new?mode=ai` : composer IA (textarea paste brief → streaming extraction Claude CLI) → ExtractedCard avec items pré-remplis → validation manuelle → create quote.
- Numérotation atomique : à la création, appelle `numbering.next_quote_number` (track D2 atomique ou stub track B).
- Route `/quotes/:id/edit` : même form + statut (draft/sent/viewed/signed) read-only selon cycle vie.
- Route `/quotes/:id` (détail) : preview PDF embedded (via Tauri drag-drop PDF viewer) + actions [Éditer, PDF, Signer (→ track I), Envoyer].
- Download PDF : `renderPdf(quoteDto)` + save via Tauri dialog.

#### Sub-track H2 — Facture from scratch + from quote (13 pts)

Stories : US-014, US-015, US-016.

- Route `/invoices` liste + bouton "Nouvelle facture" → options [From Quote, From Scratch].
- From Quote : picker devis signed/sent → options [Acompte 30%, Solde, Total] → pré-remplit items + montants.
- From Scratch : idem devis, sans lien quote_id.
- Mentions légales auto via `@fakt/legal` `getMandatoryMentions({ regime: 'micro', type: 'invoice', amount })`.
- Numérotation F2026-XXX via `numbering.next_invoice_number`.
- **Protection soft-delete** : table invoices refuse DELETE si status != 'draft' (trigger SQL W0.4 + UI cache le bouton Delete pour issued).

#### Sub-track H3 — Cycle vie + statut paiement (8 pts)

Stories : US-013 (devis) + US-017 (facture).

- StatusPill composant pour chaque statut avec couleurs Brutal.
- Cycle devis : draft → sent (manuel via bouton ou auto quand .eml ouvert) → viewed (v0.2 pixel tracker, skip v0.1) → signed (auto quand track I signature finalisée) → invoiced (auto quand facture créée from quote).
- Cycle facture : draft → sent → paid (manuel avec date paiement + méthode).
- Action "Marquer payée" : modal avec date picker + radio méthode (Virement, CB, Espèces, Chèque, Autre).
- Dashboard widgets basiques (vrai dashboard = Track J) : "Devis en attente signature", "Factures en retard > 30j".

**DoD Track H complet :**
- [ ] Un devis peut être créé manuel OU via IA, édité, numéroté, rendu en PDF, marqué sent/signed.
- [ ] Une facture peut être créée from devis signé OU from scratch, numérotée, rendue en PDF, marquée paid.
- [ ] Toutes mentions légales obligatoires présentes dans PDF.
- [ ] Numérotation sans trous validée (test : créer 10 devis + 10 factures, vérifier séquence 001-010).
- [ ] Tests Playwright E2E complets des 2 user flows (création devis manuel + facture from quote).

### 🟡 MILESTONE ALPHA (J+10)

À ce point, **Tom a une version debug non-signée de FAKT qu'il installe localement via `bun tauri build`**. Il peut :

- ✅ Onboarder (wizard, cert généré)
- ✅ Créer clients + prestations
- ✅ Créer devis (manuel + IA) avec numérotation FR + PDF Typst
- ✅ Créer facture (from quote + from scratch) avec mentions légales
- ✅ Marquer factures comme payées
- ✅ Dashboard basique avec listes

**Tom désinstalle les skills Claude Code à ce moment.** FAKT devient son outil de référence.

Ce qui manque encore :
- ❌ Signature PAdES (en cours track D + track I à venir)
- ❌ Email .eml avec pièce jointe (track K à venir)
- ❌ Archive ZIP (track K à venir)
- ❌ Installers code-signés (track L à venir)
- ❌ Dashboard complet + composer IA sidebar avancé (track J à venir)

---

## Wave 3 — Signature + UI avancée (J10-J17) · 34 pts · 2 tracks parallèles

**But :** ajouter la signature PAdES (différenciateur clé vs skills) + pousser l'UI jusqu'à la qualité Brutal Invoice complète.

**Dépendances :** Wave 2 Alpha livrée (H complet) + Wave 1 Track D complet.

### Track I — Signature flow intégré (13 pts)

**Agent type :** `feature-dev:code-architect` **opus**
**Stories :** US-018, US-019, US-020 (EPIC-005)
**Inputs :** Track D (crypto) + Track H (quotes/invoices existent). Design `.design-ref/.../components/detail-signature.jsx` avec 3 variantes (checkbox / dessin canvas / page Yousign-like) — choisir variante **dessin canvas** (principale v0.1).
**Outputs :** `apps/desktop/src/routes/quotes/:id/sign`, `components/signature-modal/*`, intégration audit trail UI.

**À livrer :**

- Modal `SignatureModal` déclenché depuis vue détail devis avec status draft|sent.
- 2 onglets : [Dessiner au trackpad / Taper nom au clavier → police cursive].
- Canvas HTML5 avec capture pointer events + smoothing bezier + export PNG base64.
- Bouton "Signer définitivement" → appelle `invoke('sign_document', { docId, signaturePng })`.
- Loading state : "Embedding crypto (~500ms)" → toast succès + update status to 'signed'.
- Vue détail devis/facture affiche timeline audit events (vertical line design Brutal, avec events `created`, `sent`, `signed`, `viewed`, `paid`).
- Each signature event affiche : timestamp, signer, hash doc before/after, TSA provider used, IP (local "localhost").
- Bouton "Vérifier signature" → ouvre `/signatures/:eventId/verify` avec détails crypto + cert chain.

**DoD :**
- [ ] Signature marche end-to-end : clic "Signer" → PDF signé téléchargé qui s'ouvre dans Adobe Reader avec validation verte.
- [ ] Audit trail affiche la chaîne complète, hashes cohérents.
- [ ] Tests Playwright E2E : create quote → sign → verify signature exists in audit.
- [ ] Performance : signature embed < 500ms (NFR-002).

### Track J — Dashboard + UI avancée Brutal Invoice (21 pts)

**Agent type :** `feature-dev:code-architect` sonnet
**Stories :** US-025, US-026, US-027, US-028 (EPIC-008)
**Inputs :** Wave 2 Alpha complet. Design `.design-ref/.../project/components/dashboard.jsx` + `composer.jsx` + tout le bundle proto HTML.
**Outputs :** `apps/desktop/src/routes/dashboard/*`, refonte `routes/quotes|invoices/list/*` avec filtres, `components/composer-sidebar/*`.

**À livrer :**

- Dashboard plein écran (route `/`) avec :
  - KPIs top : CA émis ce mois, CA encaissé ce mois, Devis en attente signature (count), Factures impayées retard (count + somme).
  - Pipeline horizontal Brutal avec stages : Draft → Sent → Signed → Invoiced → Paid.
  - Activity feed vertical avec events récents (signatures, paiements, créations).
  - Suggestions IA (optional, nice-to-have) : bloc "Relances recommandées" avec boutons quick-action.
- Listes devis + factures : 
  - Filtres multi : statut (chips multi-select), client (combobox), date range (picker), text search.
  - Tri sur toutes colonnes.
  - Quick actions inline (éditer, signer, dupliquer).
- Vue détail (refonte) : split-pane [PDF preview à gauche | Timeline + infos + actions à droite].
- Composer IA sidebar (US-028, NON modal persistent) :
  - Bouton toggle dans topbar.
  - Input multiline + send button.
  - Historique session (conserver pendant session, reset on refresh — pas de persistance v0.1).
  - Contexte auto : si vue détail devis ouverte, injecte contextId dans le prompt.
  - Cas d'usage : "Rédige une relance pour cette facture", "Ajoute 2 jours de dev sur ce devis", "Résume l'activité cette semaine".
- Raccourcis clavier : ⌘K palette, ⌘N nouveau devis, ⌘⇧N nouvelle facture, ⌘/ toggle composer.

**DoD :**
- [ ] Dashboard charge en < 2s (NFR-001) avec 100 quotes + 100 invoices fixtures.
- [ ] Filtres listes fonctionnent et persist en URL params (deep linking).
- [ ] Composer IA répond via Claude CLI streaming.
- [ ] Design conforme Brutal Invoice : aucun radius, bordures 2.5px, shadows plates, inversion hover.
- [ ] Validation visuelle manuelle Tom obligatoire avant merge.

### 🟠 MILESTONE BETA (J+17)

Tom a une FAKT quasi-complète :
- ✅ Tout ALPHA
- ✅ Signature PAdES avec audit trail + Adobe Reader validé
- ✅ Dashboard pro avec KPIs, pipeline, activity
- ✅ Composer IA sidebar pour relances + éditions
- ✅ Filtres puissants sur listes

Reste pour v0.1.0 publique :
- ❌ Email .eml multi-OS (track K)
- ❌ Archive ZIP + compliance 10y (track K)
- ❌ Installers signés Windows + macOS (track L)
- ❌ Landing page + docs + release notes (track L)

---

## Wave 4 — Release (J17-J21) · 21 pts · 2 tracks parallèles

### Track K — Email + Archive (8 pts)

**Agent type :** `general-purpose` sonnet
**Stories :** US-021, US-022, US-023, US-024 (EPIC-006 + EPIC-007)
**Inputs :** Wave 3 BETA. `docs/architecture.md` sections email + archive.
**Outputs :** `packages/email/` + `apps/desktop/src/routes/archive/*`.

**À livrer :**

- `packages/email/src/eml-builder.ts` : build `.eml` RFC 5322 compliant avec headers + body HTML/plain + attachment PDF base64.
- `packages/email/src/templates/` : 4 templates (`quote_sent.md`, `invoice_sent.md`, `reminder.md`, `thanks.md`) avec placeholders `{{client}}`, `{{amount}}`, `{{dueDate}}`.
- Tauri command `open_email_draft(emlPath)` qui lance OS default handler (`xdg-open` Linux / `open` macOS / `start` Windows).
- Fallback : si aucun handler trouvé, ouvre `mailto:` URL avec body encodé.
- Bouton "Préparer email" sur vue détail devis/facture → génère .eml dans temp dir + ouvre.
- Route `/archive` : liste documents + bouton "Export ZIP workspace" → dialog save → ZIP structure :
  ```
  fakt-workspace-{date}.zip
  ├── clients.csv
  ├── prestations.csv
  ├── quotes/
  │   ├── D2026-001.pdf
  │   └── ...
  ├── invoices/
  │   ├── F2026-001.pdf
  │   └── ...
  └── README.txt (mentions compliance 10y)
  ```
- Enforce no-hard-delete sur invoices issued (déjà DB trigger en W0 + UI cache bouton Delete) + message explicatif.

**DoD :**
- [ ] Bouton "Préparer email" ouvre Mail/Outlook avec PDF attaché sur Windows + macOS.
- [ ] Fallback mailto marche si aucun handler.
- [ ] Export ZIP complet avec CSV + PDFs.
- [ ] Tests E2E : créer facture issued → tenter delete → voir message d'erreur conforme.

### Track L — CI/CD + Code-signing + Landing + Docs (13 pts)

**Agent type :** `general-purpose` sonnet
**Stories :** NFR-003, NFR-010, NFR-011 + livrables release.
**Inputs :** Wave 3 BETA + secrets Apple Developer + Windows OV cert (à commander par Tom **dès J+1** pour avoir les certs à temps, délai Windows OV peut être 3-7 jours).
**Outputs :** `.github/workflows/*.yml`, installers dans GitHub Releases, `fakt.alphaluppi.com` live.

**À livrer :**

- `.github/workflows/ci.yml` : on every PR → typecheck + lint + test unitaire + build.
- `.github/workflows/e2e.yml` : on main → Playwright E2E avec Tauri en headless sur matrix (ubuntu, macos, windows).
- `.github/workflows/release.yml` : on tag `v*` → `tauri-apps/tauri-action@v2` avec secrets Apple Dev ID + Windows .pfx → produce signed installers → upload GitHub Release.
- Configuration Tauri `bundle.identifier = com.alphaluppi.fakt`, icons, target all OS.
- Landing page statique (Next.js ou Astro, minimum) déployée sur Vercel ou Dokploy :
  - Hero "FAKT — Facturez et signez en local. Open source."
  - 3 features (1. Signature PAdES maison, 2. 100% offline-first, 3. Skills Claude intégrés).
  - CTA "Télécharger v0.1.0" → GitHub Releases.
  - Domaine : `fakt.alphaluppi.com` (fallback `fakt.dev` si le sub-domaine pose problème DNS).
- README.md FR complet (quickstart, install, build from source, contribute DCO).
- CONTRIBUTING.md avec DCO sign-off instructions.
- Mintlify docs minimum viable : intro, install, premier devis, premier facture, signature, architecture overview.
- Message launch rédigé pour Product Hunt + Hacker News + Twitter + LinkedIn (sans poster — Tom valide le timing).

**DoD v0.1.0 (gate release publique) :**
- [ ] GitHub Release v0.1.0 publié.
- [ ] Installers Windows .msi (Authenticode) + macOS .dmg (notarized) + Linux .AppImage attachés.
- [ ] CI verte matrix 3 OS.
- [ ] Tom a émis ≥ 5 vrais devis + 5 vraies factures via FAKT.
- [ ] 72h utilisation continue sans bug bloquant signalé.
- [ ] Coverage ≥ 70% sur packages/core et packages/pdf.
- [ ] `bun audit` + `cargo audit` = 0 vuln haute.
- [ ] Landing live sur domaine choisi.

### 🟢 MILESTONE v0.1.0 PUBLIC (J+21, avant 2026-05-12)

Release publique. Tom poste sur PH/HN/Twitter/LinkedIn. Repo `AlphaLuppi/FAKT` passe public.

---

## Traceability complète : Story → Track → Wave → Milestone

| US | FR couverts | Epic | Track | Wave | Milestone |
|---|---|---|---|---|---|
| US-001 | FR-001 | EPIC-001 | Track F | W2 | ALPHA |
| US-002 | FR-002 | EPIC-001 | Track F + Track D1 | W2 (UI) + W1 (crypto) | ALPHA |
| US-003 | FR-003 | EPIC-001 | Track F + Track E | W2 + W1 | ALPHA |
| US-004 | FR-004 | EPIC-001 | Track F | W2 | ALPHA |
| US-005 | FR-005 | EPIC-002 | Track G + Track B | W2 + W1 | ALPHA |
| US-006 | FR-006 | EPIC-002 | Track G + Track B | W2 + W1 | ALPHA |
| US-007 | FR-007 | EPIC-002 | Track G | W2 | ALPHA |
| US-008 | FR-008, FR-009 | EPIC-003 | Track H1 + Track E | W2 + W1 | ALPHA |
| US-009 | FR-008 | EPIC-003 | Track H1 | W2 | ALPHA |
| US-010 | FR-010 | EPIC-003 | Track H1 + Track D2 numbering | W2 + W1 | ALPHA |
| US-011 | FR-011 | EPIC-003 | Track H1 | W2 | ALPHA |
| US-012 | FR-012 | EPIC-003 | Track H1 + Track C | W2 + W1 | ALPHA |
| US-013 | FR-012 | EPIC-003 | Track H3 | W2 | ALPHA |
| US-014 | FR-013 | EPIC-004 | Track H2 | W2 | ALPHA |
| US-015 | FR-014 | EPIC-004 | Track H2 | W2 | ALPHA |
| US-016 | FR-016 | EPIC-004 | Track H2 + Track C | W2 + W1 | ALPHA |
| US-017 | FR-015 | EPIC-004 | Track H3 | W2 | ALPHA |
| US-018 | FR-016 | EPIC-005 | Track I | W3 | BETA |
| US-019 | FR-017 | EPIC-005 | Track I + Track D2 | W3 + W1 | BETA |
| US-020 | FR-018 | EPIC-005 | Track I + Track D3 | W3 + W1 | BETA |
| US-021 | FR-019 | EPIC-006 | Track K | W4 | v0.1.0 |
| US-022 | FR-020 | EPIC-006 | Track K | W4 | v0.1.0 |
| US-023 | FR-021 | EPIC-007 | Track K | W4 | v0.1.0 |
| US-024 | FR-022 | EPIC-007 | Track K + W0.4 trigger | W4 + W0 | v0.1.0 |
| US-025 | FR-023 | EPIC-008 | Track J | W3 | BETA |
| US-026 | FR-024 | EPIC-008 | Track J | W3 | BETA |
| US-027 | FR-025 | EPIC-008 | Track J | W3 | BETA |
| US-028 | FR-025 | EPIC-008 | Track J + Track E | W3 + W1 | BETA |

**Couverture FRs :** 25/25 ✅ · **Couverture NFRs :** 12/12 (adressés transversalement dans les tracks pertinents).

---

## Risques & mitigation

| # | Risque | Track(s) concerné(s) | Probabilité | Impact | Mitigation |
|---|---|---|---|---|---|
| R1 | POC PAdES cross-OS échoue ou > 3j | Track D | Moyenne | Haut (bloque BETA+v0.1) | Démarrer J+3 dès W0 terminé, budget 7j non 3j, fallback C# via P/Invoke si Rust ne passe pas |
| R2 | Windows OV cert delay (3-7j processus) | Track L | Haute | Moyen (bloque release signée) | Tom commande **J+1 ou J+2 max**, avant même le code |
| R3 | Apple Dev Program setup (notarization complexe) | Track L | Moyenne | Moyen | Tester workflow Tauri action sur repo test mirror en parallèle W1 |
| R4 | Typst templates fidélité charte skills | Track C | Moyenne | Moyen | Validation visuelle Tom obligatoire fin W1, budget 2j retouche si pas bon |
| R5 | Claude CLI streaming latency > 10s | Track E | Basse | Moyen | UX : loading state clair + bouton "Annuler" + cache résultats similaires |
| R6 | Bundle size Typst crate > 15MB NFR-003 | Track C | Moyenne | Moyen | Fallback Typst CLI external (user install) si crate trop gros |
| R7 | Drizzle migrations SQLite ↔ PG parité | W0.4 + v0.2 | Basse | Bas (v0.2 scope) | Schema compatible mais tests PG déférés v0.2 |
| R8 | Conflits merge entre worktrees tracks // | W1+W2 | Haute | Moyen | Boundaries strictes par package, interfaces via shared/types, Tom fait merge queue |
| R9 | Tom a un bug bloquant pendant 72h test ALPHA | post-ALPHA | Moyenne | Haut (retarde BETA) | Buffer +2j avant BETA si régression |
| R10 | Scope creep composer IA | Track J | Moyenne | Moyen | Strict : composer ne persiste pas la session v0.1 (flag dans doc, pas négociable) |

---

## Definition of Done par milestone

### DoD ALPHA (J+10)

- [ ] Wave 0 + Wave 1 (tracks A, B, C, E minimum) + Wave 2 (F, G, H) merged sur `main`.
- [ ] `bun run dev` lance FAKT local sans erreur console.
- [ ] Tom réussit : onboarding → ajout 1 client → ajout 1 prestation → créer 1 devis manuel → créer 1 facture from quote → PDF téléchargé conforme.
- [ ] Zéro crash sur les 3 OS (ou au moins macOS si Tom est sur Mac).
- [ ] Tom désinstalle les 2 skills Claude Code.
- [ ] Pas encore de public release, pas encore GitHub repo public.

### DoD BETA (J+17)

- [ ] + Wave 3 (I + J) merged.
- [ ] Track D complet intégré (signature opérationnelle avec Adobe Reader validation).
- [ ] Tom a signé au moins 3 devis réels et ouvert les PDFs dans Adobe Reader pour valider.
- [ ] Dashboard pro avec KPIs réels (CA, pipeline).
- [ ] Composer IA marche pour au moins 2 use-cases (relance, édition devis).
- [ ] Pas encore de release publique.

### DoD v0.1.0 (J+21, hard deadline 2026-05-12)

Tous les critères listés dans `docs/prd.md` "Definition of Done — v0.1.0" + :

- [ ] Wave 4 (K + L) merged.
- [ ] GitHub Release tag `v0.1.0` créée avec 3 installers signés attachés.
- [ ] Landing live.
- [ ] Repo public.
- [ ] Message launch publié sur au moins 2 canaux (Product Hunt + Hacker News OU Twitter + LinkedIn).
- [ ] Tom a émis ≥ 5 devis + 5 factures réels.
- [ ] CI verte matrix 3 OS.

---

## Briefings agents — prompts prêts à coller

Chaque brief est formaté pour être passé directement à `Agent({ subagent_type, prompt, isolation: "worktree" })`. Tom peut lancer plusieurs briefings en parallèle (un par tool call dans un même message).

### Brief W0 — Fondations monorepo

```
Agent(
  subagent_type: "general-purpose",
  description: "Scaffold monorepo FAKT fondations",
  isolation: "worktree",
  prompt: "
Tu es en charge de la Wave 0 (Fondations) du projet FAKT (facturation freelance desktop open-source).

Lis en entier : docs/architecture.md, docs/sprint-plan.md section 'Wave 0', CLAUDE.md, memory/design_bundle_path.md.

Livrables W0.1 à W0.8 listés dans sprint-plan.md. Stack non-négociable : Tauri 2, Bun workspaces, Drizzle, React 19, Tailwind v4, Biome, TypeScript strict, Turborepo 2.x.

Ordre recommandé :
1. W0.1 scaffold monorepo + LICENSE BSL 1.1.
2. W0.3 packages/shared (types + i18n FR).
3. W0.2 packages/design-tokens (port depuis .design-ref/gestion-de-facture-et-devis/project/colors_and_type.css).
4. W0.5 packages/core (modèles purs + Zod).
5. W0.6 packages/legal (mentions FR, SIRET, art. 293 B).
6. W0.4 packages/db (schema Drizzle depuis architecture section 5.3 + triggers section 5.4).
7. W0.8 packages/config.
8. W0.7 apps/desktop scaffold Tauri + React.

DoD global : bun install + bun run typecheck + bun run test passent. bun run dev ouvre fenêtre Tauri vide avec shell layout.

Commits : conventional + DCO sign-off. Ne pas committer secrets. Pas de README dans sous-dossiers.

À la fin, rapport < 300 mots : ce qui est fait, ce qui bloque, estimation restant.
"
)
```

### Brief Track A — UI primitives

```
Agent(
  subagent_type: "feature-dev:code-architect",
  description: "Components UI Brutal Invoice",
  isolation: "worktree",
  prompt: "
Tu construis packages/ui pour FAKT (design system Brutal Invoice).

Inputs obligatoires à lire en premier :
- docs/sprint-plan.md section 'Track A'
- .design-ref/gestion-de-facture-et-devis/project/components/*.jsx (atoms, shell, dashboard, lists, composer, detail-signature, doc-preview, mobile, ios-frame)
- packages/design-tokens/ (déjà prêt par W0)
- CLAUDE.md (règles design Brutal non-négociables)

Livrables : tous les composants listés en sprint-plan Track A. Pour chaque composant :
- TS strict, typé avec les tokens design
- Exemples d'utilisation dans packages/ui/examples/<Component>.tsx
- Test Vitest @testing-library/react snapshot

Règles absolues : zéro border-radius, bordures 2.5px/2px/1.5px selon composant, shadows plates #000 3/5/8px, hover inversion #000↔#FFFF00, press translate(3px,3px) + shadow none. Pas de gradient ni blur jamais.

Tu réécris les composants en TS typé depuis les JSX sources mais tu match le VISUEL pas la structure JSX interne.

À la fin, rapport < 300 mots. Si un composant est ambigu, stub-le et note dans TODO.md.
"
)
```

### Brief Track D1 — Cert X.509 + Keychain

```
Agent(
  subagent_type: "general-purpose",
  model: "opus",
  description: "POC Cert X.509 + Keychain FAKT",
  isolation: "worktree",
  prompt: "
Tu construis le sub-track D1 de FAKT : génération cert X.509 RSA 4096 auto-signé + stockage keychain OS cross-platform.

CHEMIN CRITIQUE : ton travail débloque la signature PAdES (bloque BETA). Budget 3j. Si à J3 tu n'as pas de POC validé, escalader immédiatement.

Inputs :
- docs/architecture.md section 7 (signature PAdES, flow complet)
- docs/sprint-plan.md section 'Track D1'
- Crates : keyring (cross-platform), x509-cert (builder DER), rsa (4096), ring ou sha2

Livrables :
- apps/desktop/src-tauri/src/crypto/cert.rs : generate_self_signed_cert(subject_dn) -> (x509_der, rsa_priv_der)
- apps/desktop/src-tauri/src/crypto/keychain.rs : store/retrieve avec fallback AES-256-GCM si keyring indispo
- Tauri commands exposées : generate_cert, get_cert_info, rotate_cert
- Tests cargo passing sur Windows + macOS + Linux CI

DoD :
- Round-trip store/retrieve réussit sur les 3 OS
- Cert validité 10 ans
- subject DN configurable (utilisateur workspace)
- Benchmark : génération < 5s (RSA 4096 est lent, acceptable)

À la fin, rapport : ce qui marche, ce qui bloque cross-OS, besoin d'alternative crate si blocage.
"
)
```

### Brief Track H — Devis + Facture

```
Agent(
  subagent_type: "feature-dev:code-architect",
  model: "opus",
  description: "Cœur métier FAKT - devis + factures",
  isolation: "worktree",
  prompt: "
Tu construis le cœur métier de FAKT : EPIC-003 (Devis) + EPIC-004 (Factures). C'est ce qui permet à Tom de remplacer ses skills Claude à J+10.

Inputs obligatoires :
- docs/prd.md sections FR-008 à FR-017
- docs/sprint-plan.md section 'Track H' (sub-tracks H1, H2, H3)
- docs/architecture.md sections 5 (DB) + 9 (PDF) + 11 (AI)
- .design-ref/gestion-de-facture-et-devis/project/components/composer.jsx + detail-signature.jsx + doc-preview.jsx + lists.jsx
- packages/ui, packages/db/queries, packages/pdf, packages/ai (tous livrés par W1)

Livrables :
- H1 (13 pts) : routes /quotes (list + new manual + new via AI + edit + detail + PDF download) ; numérotation atomique via Tauri command
- H2 (13 pts) : routes /invoices (list + from quote + from scratch + mentions auto + edit + detail + PDF)
- H3 (8 pts) : StatusPills + cycle vie + Marquer payée + widgets dashboard basique

Règles critiques :
- Numérotation sans trous (CGI art. 289) — commande Tauri atomique avec BEGIN IMMEDIATE
- Mentions légales depuis packages/legal (art. 293 B CGI si micro)
- Soft delete interdite sur invoice issued (trigger DB + UI hide bouton)
- Tests Playwright E2E : flow complet création devis manuel + facture from quote

DoD : Tom peut créer 1 devis + 1 facture conforme via l'UI sans toucher à la CLI. PDFs rendus < 3s.

À la fin, rapport : stories complétées vs. stub/TODO.
"
)
```

### Briefs tracks E, F, G, I, J, K, L

Pattern identique : inputs explicites (sprint-plan section + architecture + design-ref) + livrables en checklist + DoD + rapport final. Suivre le même template. Tom peut utiliser ces briefs comme templates et les étendre.

---

## Sprint cadence agent team

**Pas de sprint planning hebdomadaire classique** — on n'a pas 3 mois devant nous, on a 3 semaines.

**Rituels recommandés :**

- **Daily async (10 min)** : Tom revoit `docs/sprint-status.yaml` + rapport de chaque agent track. Update statuses. Identifier blockers.
- **Wave-end sync (30 min)** : Tom merge toutes les worktrees de la wave sur `main`, résout conflits, runs full test suite, tag `alpha-wX-done`.
- **Milestone review (1h)** : à chaque milestone (ALPHA, BETA, v0.1.0), Tom fait un tour utilisateur complet de 30 min + rédige un rapport bref dans `docs/milestone-notes/`.

**Agents to spawn per wave (max parallel) :**

- Wave 0 : 1 agent
- Wave 1 : 5 agents (A, B, C, D, E) simultanés
- Wave 2 : 3 agents (F, G, H) simultanés + Track D continue en background
- Wave 3 : 2 agents (I, J) simultanés
- Wave 4 : 2 agents (K, L) simultanés

**Coût budget estimé (opus pour D + H + I, sonnet sinon) :**
Tom gère son token Anthropic, ordre de grandeur à benchmarker après Wave 0. Budget mental : < 50€ total si les waves convergent sans retries massifs.

---

## Next Steps immédiats

1. **Tom lance immédiatement** : commande du Windows OV Code Signing cert (délai 3-7 jours) et inscription Apple Developer Program (99 USD/an, immédiat). **Bloquant Track L donc à faire en J+1.**
2. **Tom invoque `/create-story`** pour générer les user stories détaillées (optional, car sprint-plan.md contient déjà les briefs agents prêts à consommer).
3. **Tom lance `Agent({subagent_type: "general-purpose", ...})` avec le brief W0** (fondations). Un seul agent, séquentiel.
4. **À la fin de W0 (1-2j)** : Tom merge, puis **lance simultanément 5 agents Wave 1** (tracks A, B, C, D, E) dans un même message multi-tool-call.
5. **Progression en waves parallèles** selon ce document.

---

**Document créé selon BMAD Method v6 — Phase 4 (Implementation Planning) adapté pour agent team parallèle.**

*Source de vérité pour l'orchestration des agents dev sur FAKT v0.1.0. Toute décision structurelle (nouveaux tracks, réassignation stories) doit se refléter ici + dans `docs/sprint-status.yaml`.*
