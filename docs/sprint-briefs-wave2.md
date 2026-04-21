# Sprint Briefs — Wave 2 · FAKT v0.1.0

**Date :** 2026-04-21
**Contexte :** Wave 1 terminée et pushée sur `origin/main` (HEAD `c5bd96f`). Les 5 briefs ci-dessous ciblent la Wave 2 — **Features ALPHA**. Fin de Wave 2 = milestone ALPHA (Tom peut remplacer ses skills Claude Code).
**Stratégie :** 3 agents simultanés max (F, G, H1 en premier batch). H2 puis H3 à la suite (dépendent des mêmes routes + modèles que H1). Référence maître : `docs/sprint-plan.md` section "Wave 2 — 3 Tracks features ALPHA".

---

## Règles de lancement

1. **Batch 1 (F + G + H1) lancé en parallèle** dans un seul message (3 `Agent()` tool calls). 3 est le maximum (`parallel_agents_max: 3` dans sprint-status).
2. **Batch 2 (H2) puis Batch 3 (H3)** séquentiels après succès de H1 — H2 réutilise les composants éditeur/form construits en H1, H3 consomme H1+H2 pour les transitions de statut.
3. **Prérequis main** : `bun run typecheck && bun run test` passent sur HEAD `c5bd96f` (validation Wave 1 = 10/10 packages ✓).
4. **Model mix :**
   - Sonnet : F (onboarding wizard, standard), G (CRUD UI standard)
   - Opus : H1, H2, H3 (cœur métier, numérotation atomique, PDF, logique complexe, blast radius maximal sur l'ALPHA)
5. **Isolation `worktree` conseillée** pour concurrence, mais **chaque agent commit DIRECTEMENT sur `main`** (voir règle git ci-dessous).

## ⚠️ Règle git — commit sur main (confirmée Wave 1)

> **Chaque agent commit son travail atomique DIRECTEMENT sur la branche `main` du repo principal.**
> - Peu importe si l'agent tourne dans un worktree isolé ou non.
> - Depuis un worktree : écrire les fichiers livrés dans le **repo main** (`C:\Users\andri\IdeaProjects\AlphaLuppi\facture-devis\`) via chemins absolus, puis `git -C <main_repo> add <files> && git -C <main_repo> commit -s -m "..."` **en ciblant main**. Le worktree peut rester vide ou servir uniquement de sandbox exploratoire.
> - Depuis main (sans worktree) : directement `git add` + `git commit -s` sur main.
> - **Ne JAMAIS push.** Tom push lui-même a posteriori après review.
> - Message de commit et body : suivre le template de chaque track (`feat(track-x): ...` + DCO).
> - Si deux agents commit en parallèle : git gère le lock, l'un attend l'autre. En cas de conflit (peu probable car tracks disjoints), l'agent retry ou escalade.

## ⚠️ Avertissement sur `feature-dev:code-architect`

**Retour d'expérience Wave 1 (tracks A et C) :** `subagent_type: "feature-dev:code-architect"` **hallucine des plans "à créer"** au lieu d'écrire le code + de committer. Deux retries ont été nécessaires (A puis C), coût temps + tokens significatif.

**Règle Wave 2 :** pour **tout livrable code réel** (F, G, H1, H2, H3), utiliser obligatoirement `subagent_type: "general-purpose"`. Le sprint-plan mentionne `feature-dev:code-architect` pour certains tracks F/H — **ignorer** cette recommandation et forcer `general-purpose`.

Réserver `feature-dev:code-architect` uniquement aux tâches explicitement de **planning / architecture sans code à commiter**.

## Signature `Agent()` commune

```ts
Agent({
  subagent_type: "general-purpose",   // JAMAIS feature-dev:code-architect
  model: "sonnet" | "opus",           // selon le track
  isolation: "worktree",
  name: "w2-track-<id>",
  description: "<short>",
  prompt: "<voir brief ci-dessous>"
})
```

---

## Track F — Onboarding + Settings (8 pts)

**Agent type :** `general-purpose` (pas code-architect)
**Model :** `sonnet`
**Name :** `w2-track-f-onboarding`
**Description :** Wizard first-launch + page Settings
**Stories :** US-001, US-002, US-003, US-004 · **FRs :** FR-001, FR-002, FR-003, FR-004

### Prompt

```
Tu construis le **Track F — Onboarding + Settings** pour FAKT. Wave 1 est livrée et pushée sur `origin/main` (HEAD c5bd96f). Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — conventions non-négociables (Brutal Invoice, DCO, TypeScript strict, légal FR).
2. `docs/sprint-plan.md` section **"Track F — Onboarding + Settings"** — liste composants + DoD.
3. `docs/prd.md` sections **FR-001** (wizard first-launch), **FR-002** (cert X.509), **FR-003** (Claude CLI detection), **FR-004** (workspace settings) — pour les acceptance criteria précis.
4. `docs/architecture.md` sections 3 (apps layout) + 6 (IPC Tauri commands) + 12 (onboarding flow).
5. Packages consommés (livrés W1) :
   - `packages/ui/` — tous composants Brutal Invoice (Button, Input, Select, Card, Modal, Shell, etc.).
   - `packages/config/` — workspace settings (getWorkspace, updateWorkspace).
   - `packages/ai/health.ts` — healthCheck() pour Claude CLI detection.
   - `packages/db/src/queries/settings.ts` — persist workspace settings.
   - `packages/legal/src/siret.ts` — validator SIRET pour le wizard form.
   - `apps/desktop/src-tauri/src/crypto/` (livré W1 Track D1) — Tauri command `generate_cert(subject_dn)`.

## Livrables (sprint-plan Track F)

### Wizard first-launch — routes `apps/desktop/src/routes/onboarding/`

Condition d'affichage : `workspace.setupCompletedAt IS NULL` → wizard, sinon redirect `/`. À câbler dans `App.tsx` via un guard côté React (ou un `<Navigate>` conditionnel).

Le wizard est un flow multi-étapes (4 étapes) :

1. **Étape 1 — Identité légale** (`steps/Identity.tsx`)
   - Formulaire : nom workspace, forme juridique (select : Micro-entreprise / EI / EURL / SASU), SIRET (avec validation `packages/legal/siret`), adresse (4 lignes), IBAN (avec validation IBAN France FR76...), contact email, téléphone.
   - Validation Zod. Bouton "Suivant" désactivé tant qu'invalide.
   - Persister via `@fakt/config` workspace.

2. **Étape 2 — Claude CLI** (`steps/ClaudeCli.tsx`)
   - Appel `healthCheck()` depuis `@fakt/ai` au mount. Affiche `{ installed, version, path }`.
   - Si non installé : afficher `installHint` + bouton "Ouvrir la page d'installation" (lien https://claude.ai/code) + bouton "Vérifier à nouveau" qui relance `healthCheck`.
   - Si installé : state vert + bouton "Suivant".
   - Skip possible avec une checkbox "Je configurerai Claude plus tard" (FR-003 AC : l'app ne doit pas bloquer le flow).

3. **Étape 3 — Certificat** (`steps/Certificate.tsx`)
   - Bouton central "Générer mon certificat de signature" → invoke `generate_cert({ common_name, organization, country: 'FR', email })` (subject DN construit depuis workspace identity étape 1).
   - Spinner pendant 1-5s (RSA 4096 lent sur machines modestes — UX cue : "Ça peut prendre quelques secondes…").
   - À la fin : afficher CertInfo (fingerprint SHA-256, DN, not_before, not_after = +10 ans). Bouton "Suivant".
   - Gestion erreur : toast d'erreur + bouton retry.

4. **Étape 4 — Récapitulatif** (`steps/Recap.tsx`)
   - Résumé identité + état CLI + empreinte cert.
   - Bouton "C'est parti !" → set `workspace.setupCompletedAt = now()` via `@fakt/config`, puis `navigate('/')` vers le dashboard.

Composant parent `onboarding/Wizard.tsx` : progress bar horizontale Brutal (4 étapes), bouton précédent/suivant, container shell sans sidebar (sidebar cachée pendant le wizard).

### Settings page — route `apps/desktop/src/routes/settings/`

Remplace le placeholder actuel dans `App.tsx` par un vrai composant Settings avec 4 tabs Brutal (chips/segmented) :

1. **Tab Identité** (`tabs/IdentityTab.tsx`)
   - Même form que wizard étape 1, en édition. Bouton "Enregistrer" → persiste.

2. **Tab Claude CLI** (`tabs/ClaudeCliTab.tsx`)
   - Affichage état courant + bouton "Vérifier à nouveau".
   - Installation helper (lien doc).

3. **Tab Certificat** (`tabs/CertificateTab.tsx`)
   - Affichage DN + fingerprint + validité restante (en années/mois).
   - Bouton "Régénérer le certificat" avec **warning modal** : "Votre ancien certificat sera archivé. Les signatures émises avant restent valides via l'audit trail, mais toute nouvelle signature utilisera le nouveau. Confirmer ?" → si OK, invoke `rotate_cert(subject_dn)`.

4. **Tab Télémétrie & Avancé** (`tabs/TelemetryTab.tsx`)
   - Toggle Plausible opt-in (default **désactivé** — NFR-privacy).
   - Toggle "Afficher les logs verbeux" (pour debug dev).
   - Version de l'app, lien GitHub issues, lien CHANGELOG.md.

### Intégration App.tsx

Modifier `apps/desktop/src/App.tsx` :
- Ajouter la route `/onboarding/*` (sous-routes 1/2/3/4 via nested router).
- Ajouter un guard avant les autres routes : `if (!workspace.setupCompletedAt && location.pathname !== '/onboarding') return <Navigate to="/onboarding" />`.
- Remplacer le placeholder Settings par le vrai composant.

Le `Shell` doit masquer Sidebar pendant `/onboarding` (prop `chromeless` ou condition dans Shell).

## Règles critiques

- **TypeScript strict** — `any` interdit.
- **Tous les composants consomment `@fakt/ui`**, pas de réimplémentation de Button/Input/Card/Modal.
- **i18n FR obligatoire** : aucune string hardcodée anglaise. Consommer `packages/shared/i18n/fr.ts` (étoffer ce dict si besoin, en ajoutant des clés `onboarding.*` et `settings.*`).
- **Zod validation côté front** pour chaque form (au minimum SIRET, IBAN, email).
- **FR-003 non-bloquant** : si Claude CLI absent, wizard continue (user peut skip).
- **Erreurs gracieuses** : `generate_cert` peut échouer (keychain indisponible, etc.) — catch + toast + retry button.
- **Pas de README** dans sous-dossiers (règle CLAUDE.md).
- **Pas de commentaires évidents** (règle CLAUDE.md). Un commentaire = une contrainte cachée.

## Tests

- Tests Vitest unitaires sur les validators (SIRET, IBAN, email, Zod schemas).
- Tests `@testing-library/react` sur chaque écran du wizard : rendu + interactions clés (saisie, submit, next).
- Tests sur guard : si `setupCompletedAt` null → redirect onboarding ; sinon → accès dashboard.
- Stub des Tauri commands (`generate_cert`, `healthCheck`) via `vi.mock`.
- Coverage Vitest ≥ 70% sur `apps/desktop/src/routes/onboarding/` et `/settings/`.
- Pas de Playwright E2E obligatoire dans ce track (prévu Wave 3 pour sign-off BETA), mais documenter les flows manuels à tester dans `docs/sprint-notes/track-f-manual-tests.md`.

## DoD Track F

- [ ] Wizard 4 étapes fonctionnel, complétable en < 3 min (US-001 AC).
- [ ] Cert généré + stocké via Tauri command, CertInfo affiché (FR-002 AC).
- [ ] healthCheck détecte Claude CLI et affiche état + installHint si absent (FR-003 AC).
- [ ] Settings 4 tabs fonctionnels, workspace editable et persist (FR-004 AC).
- [ ] Guard onboarding actif dans `App.tsx`.
- [ ] `bun run typecheck` et `bun run test` passent sur `apps/desktop`.
- [ ] i18n FR : aucune string anglaise. Dictionnaire `packages/shared/i18n/fr.ts` étoffé.
- [ ] Coverage ≥ 70% sur les routes onboarding + settings.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-f): onboarding wizard + settings workspace`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-f): onboarding wizard + settings workspace

  - Wizard 4 étapes : identité, Claude CLI, cert, récap
  - Guard setupCompletedAt avant accès dashboard
  - Settings page 4 tabs : identité, CLI, certificat, télémétrie
  - Rotate cert avec warning audit trail
  - Validators Zod (SIRET, IBAN, email) + i18n FR étoffé
  - Tests Vitest unit + integration ≥ 70% coverage

  Stories: US-001, US-002, US-003, US-004
  FRs: FR-001, FR-002, FR-003, FR-004
  Wave: 2 · Track: F · Points: 8
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Commit sur `main`** (voir règle git en haut du document). **Ne pas push.**

## Rapport final (< 300 mots, français)

- Livrables : checklist des 4 étapes wizard + 4 tabs settings (✅/🟡 stub/❌ skip).
- DoD : 8 gates OK/KO.
- Commit : hash sur main.
- Blockers : Tauri commands manquantes ou comportements cert/healthCheck non couverts par W1.
- Risques conso W3 : wizard → BETA doit-il inclure un onboarding IA ? Noter.
```

---

## Track G — Clients + Prestations (8 pts)

**Agent type :** `general-purpose`
**Model :** `sonnet`
**Name :** `w2-track-g-clients-prestations`
**Description :** CRUD UI clients + prestations + ⌘K palette
**Stories :** US-005, US-006, US-007 · **FRs :** FR-005, FR-006, FR-007

### Prompt

```
Tu construis le **Track G — Clients + Prestations** pour FAKT. Wave 1 est livrée et pushée sur `origin/main` (HEAD c5bd96f). Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — conventions non-négociables.
2. `docs/sprint-plan.md` section **"Track G — Clients + Prestations"** — livrables + DoD.
3. `docs/prd.md` sections **FR-005** (CRUD clients), **FR-006** (CRUD prestations), **FR-007** (recherche ⌘K transverse) — acceptance criteria précis.
4. `docs/architecture.md` section 3 (apps layout) + section 6 (IPC commands).
5. `.design-ref/gestion-de-facture-et-devis/project/components/lists.jsx` — référence visuelle tables + actions inline.
6. Packages consommés (livrés W1) :
   - `packages/ui/` — Table (sortable/filterable/virtualized), Button, Input, Modal, Card, StatusPill, Chip, CommandPalette.
   - `packages/db/src/queries/clients.ts` + `prestations.ts` — CRUD complet typé.
   - `packages/db/src/queries/quotes.ts` + `invoices.ts` — pour la recherche ⌘K cross-entity.
   - `packages/core/src/models/client.ts` + `prestation.ts` — DTOs Zod.
   - `packages/legal/src/siret.ts` — validator SIRET (client company).
   - `packages/shared/i18n/fr.ts` — strings FR à étoffer (`clients.*`, `prestations.*`, `search.*`).

## Livrables (sprint-plan Track G)

### Route `/clients` — `apps/desktop/src/routes/clients/`

- `clients/List.tsx` : Table avec colonnes [Nom, Contact, Email, Téléphone, Créé le, Actions]. Tri sur toutes colonnes, filtre texte global, pagination si > 50 lignes. Bouton "Nouveau client" en haut à droite → ouvre Modal `ClientForm`. Ligne clic → ouvre détail (modal ou side panel, au choix Brutal).
- `clients/ClientForm.tsx` (modal) : champs [nom, contact nommé, email, téléphone, adresse (4 lignes), SIRET (optionnel), notes multiligne]. Validation Zod via DTO `packages/core`. SIRET optionnel mais si rempli → validateur `packages/legal/siret`. Bouton "Enregistrer" → `create` ou `update` via `@fakt/db`.
- `clients/Detail.tsx` (side panel ou modal) : affiche infos + sections [Devis liés (list compacte), Factures liées (list compacte)] consommées via `@fakt/db/queries/quotes.ts` + `invoices.ts` filtrés par `clientId`. Bouton "Éditer" → réouvre ClientForm en mode edit. Bouton "Supprimer" → soft delete avec confirmation modal.
- Filter bar : toggle "Afficher la corbeille" (filter `includeSoftDeleted: true`), avec action "Restaurer" sur chaque ligne archivée.

### Route `/prestations` — `apps/desktop/src/routes/prestations/` (note : routing existant utilise `/services` mais les composants et queries utilisent le terme `prestation`. Garder `/services` côté URL en façade FR-friendly, ou renommer en `/prestations` — ta décision, documente)

- Structure miroir de `/clients` avec les champs : [nom, description multiligne, prix unitaire (number), unité (select Heure/Jour/Forfait/Abonnement), catégorie (select libre, création à la volée)].
- Validation Zod via DTO `packages/core`.
- CRUD + soft delete.

### Command palette ⌘K — `apps/desktop/src/components/command-palette/`

Intégration dans le shell (topbar ou provider global) :
- Composant `CommandPalette` déjà livré W1 dans `@fakt/ui/overlays` — wrapper ici pour alimenter les résultats.
- Raccourci clavier : `⌘K` (macOS) / `Ctrl+K` (Windows/Linux). Utiliser `useHotkeys` (`react-hotkeys-hook`) ou gestion native `keydown` listener.
- Quatre catégories : Clients, Prestations, Devis, Factures.
- Fuzzy matching via `fuzzysort` ou `fuse.js` (au choix, léger). Index mis à jour au mount + invalidé sur write (optionnel : `swr` ou refetch simple via React Query ou un store zustand).
- Résultats affichés en sections avec icône + label + sublabel (ex: "Client : Atelier Mercier · Paris").
- Clic sur résultat → navigate vers la vue détail de l'entité.
- **Performance NFR-001 : ouverture < 100ms** — précharger l'index au boot app ou lazy-load sur première ouverture.

### Intégration App.tsx + Shell

- Ajouter routes `/clients` et `/prestations` dans `App.tsx` (remplacer les placeholders actuels).
- `Shell.tsx` : mount global `CommandPalette` (provider context) déclenché par hotkey.
- Topbar : bouton "Recherche" visible avec texte "⌘K" en shortcut hint.

## Règles critiques

- **TypeScript strict** — `any` interdit.
- **Consommer `@fakt/ui`** partout. Pas de réimplémentation.
- **Zod validation front** synchronisée avec DTOs `packages/core`.
- **Soft delete via `@fakt/db`** — jamais de DELETE direct.
- **i18n FR** : aucune string hardcodée anglaise. Étoffer `packages/shared/i18n/fr.ts`.
- **⌘K performance** : ouverture < 100ms (NFR-001). Préload index.
- **Pas de README** dans sous-dossiers.
- **Pas de commentaires évidents**.

## Tests

- Vitest unitaires sur les forms (ClientForm, PrestationForm) : validation Zod, submit, edit.
- `@testing-library/react` sur les listes : tri, filtre, pagination.
- Tests palette ⌘K : hotkey trigger, fuzzy search, navigation on select.
- Stubs `@fakt/db` queries via `vi.mock`.
- Coverage Vitest ≥ 70% sur `apps/desktop/src/routes/clients/` + `/prestations/` + `/components/command-palette/`.

## DoD Track G

- [ ] CRUD complet clients fonctionnel (create, read, update, soft delete, restore) (FR-005).
- [ ] CRUD complet prestations fonctionnel (FR-006).
- [ ] ⌘K palette cross-entity (clients, prestations, devis, factures) fonctionnelle (FR-007).
- [ ] ⌘K ouvre en < 100ms (NFR-001) — vérifier avec `performance.now()` en test.
- [ ] Sidebar + Topbar du Shell linkent vers les nouvelles routes.
- [ ] `bun run typecheck` et `bun run test` passent sur `apps/desktop`.
- [ ] Coverage ≥ 70%.
- [ ] i18n FR strict.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-g): clients + prestations CRUD + ⌘K palette`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-g): clients + prestations CRUD + ⌘K palette

  - Routes /clients et /prestations (List, Form modal, Detail panel)
  - CRUD complet via @fakt/db queries + soft delete + restore
  - Forms Zod + SIRET validator (clients)
  - CommandPalette ⌘K cross-entity (fuzzy search) < 100ms
  - Shell + Topbar intégration + i18n FR étoffé
  - Tests Vitest ≥ 70% coverage

  Stories: US-005, US-006, US-007
  FRs: FR-005, FR-006, FR-007
  Wave: 2 · Track: G · Points: 8
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Commit sur `main`** (voir règle git en haut du document). **Ne pas push.**

## Rapport final (< 300 mots, français)

- Livrables : checklist des 2 CRUDs + ⌘K palette (✅/🟡 stub/❌ skip).
- DoD : 8 gates OK/KO.
- Commit : hash sur main.
- Choix routing `/services` vs `/prestations` documenté.
- Risques conso Track H : colonnes Table qui manquent pour linking depuis devis/facture ?
```

---

## Track H — Devis + Facture (cœur métier, 34 pts)

**Le plus gros track du projet.** Split obligatoire en 3 sub-tracks H1 / H2 / H3, **1 commit atomique par sub-track** (donc 3 commits). Chaque sub-track est un brief séparé lancé séquentiellement.

**Séquencement :** H1 d'abord (en parallèle de F + G). Après merge H1 sur main, lancer H2. Après merge H2, lancer H3. H3 dépend des cycles de vie posés par H1 (devis) et H2 (facture).

---

### Track H1 — Devis création + édition + PDF (13 pts)

**Agent type :** `general-purpose` (pas code-architect)
**Model :** `opus`
**Name :** `w2-track-h1-quotes`
**Description :** Cœur devis (manual + IA + PDF + numérotation)
**Stories :** US-008, US-009, US-010, US-011, US-012 · **FRs :** FR-008, FR-009, FR-010, FR-011, FR-012

#### Prompt

```
Tu construis le **Track H1 — Devis création + édition + PDF** pour FAKT. C'est 13 pts sur les 34 du track H (cœur métier), et c'est ce qui permet à Tom de remplacer son skill `/devis-freelance` à ALPHA J+10. Wave 1 est livrée sur origin/main HEAD c5bd96f. Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — conventions + règles légales FR critiques (numérotation sans trous CGI art. 289).
2. `docs/sprint-plan.md` section **"Sub-track H1 — Devis création + édition + PDF"**.
3. `docs/prd.md` sections **FR-008** (création manuelle devis), **FR-009** (création IA), **FR-010** (numérotation séquentielle), **FR-011** (édition + recalcul live), **FR-012** (PDF + cycle vie statut) — AC précis.
4. `docs/architecture.md` sections 5 (DB) + 6 (IPC commands) + 9 (PDF) + 11 (AI).
5. `.design-ref/gestion-de-facture-et-devis/project/components/composer.jsx` — référence composer IA (textarea brief + streaming).
6. `.design-ref/gestion-de-facture-et-devis/project/components/doc-preview.jsx` — aperçu PDF inline.
7. `.design-ref/gestion-de-facture-et-devis/project/components/lists.jsx` — table listing.
8. Packages consommés (tous livrés W1) :
   - `packages/ui/` — tous composants Brutal Invoice.
   - `packages/db/src/queries/quotes.ts` — CRUD + items joined + updateStatus.
   - `packages/db/src/queries/numbering.ts` — `nextQuoteNumber(workspaceId)` (stub TS W1 — **documenté comme non-atomique, à remplacer par Tauri command atomique plus tard**). Pour H1 : utiliser le stub tel quel mais ajouter un TODO dans body commit.
   - `packages/pdf/src/index.ts` — `renderPdf(quoteDto): Promise<Uint8Array>` + Tauri command Rust.
   - `packages/ai/` — `AiProvider.extractQuoteFromBrief(brief)` streaming pour le mode IA.
   - `packages/core/src/models/quote.ts` — DTO Zod `QuoteDto`, `QuoteItemDto`, `computeQuoteTotal`.
   - `packages/legal/` — mentions (indirect, devis ≠ facture mais inclure mention "Devis non contractuel / Bon pour accord").

## Livrables

### Route `/quotes` — `apps/desktop/src/routes/quotes/`

Remplacer le placeholder courant dans `App.tsx` par de vraies sous-routes :

- `/quotes` : `List.tsx` — Table Brutal (colonnes : Numéro, Client, Montant TTC, Statut, Créé le, Actions). Tri + filtre par statut (chips multi-select draft/sent/signed/invoiced) + filtre client + recherche texte. Bouton "Nouveau devis" (ouvre menu [Manuel / IA]).
- `/quotes/new?mode=manual` : `NewManual.tsx` — Form complet :
  - Section Client : picker Client (combobox via `@fakt/ui`) + bouton "Nouveau client rapide" (modal inline, réutilise ClientForm de Track G si déjà mergé — sinon stub + TODO).
  - Section Items : `ItemsEditor.tsx` composant — liste d'items éditable (add/remove lignes, drag-drop reorder optionnel). Chaque item : Prestation picker (optionnel — auto-fill depuis `@fakt/db/queries/prestations`) + label override + quantité + prix unitaire + TVA (pour micro-entreprise : 0 et disabled avec mention "TVA non applicable art. 293 B CGI"). Recalcul **live** du TTC (exposé via `computeQuoteTotal` de `@fakt/core`).
  - Section Dates : date émission (auto = today), date validité (default +30j éditable).
  - Section Notes : textarea conditions particulières.
  - Bouton "Enregistrer brouillon" (status = 'draft', numéro pas encore attribué) / "Créer et attribuer numéro" (status = 'draft', numéro attribué via `nextQuoteNumber`).

- `/quotes/new?mode=ai` : `NewAi.tsx` — Composer IA :
  - Textarea (paste brief email ou description libre) + bouton "Extraire".
  - Streaming depuis `AiProvider.extractQuoteFromBrief(brief)` via `for await (const event of provider.extractQuoteFromBrief(brief))` → render progressif de l'`ExtractedQuote` (client suggéré, items proposés, montants).
  - État loading clair (spinner Brutal + message "Claude analyse…"). Bouton "Annuler" pour abort.
  - À la fin du stream (`type === 'done'`) : redirection vers `/quotes/new?mode=manual` avec les items pré-remplis dans le state (via URL params sérialisés ou store zustand).
  - Si Claude CLI absent → fallback affiche CTA "Configurer Claude" (link vers `/settings` tab CLI).

- `/quotes/:id/edit` : `Edit.tsx` — même form que NewManual, préchargé via `quotes.get(id)`. Statut read-only selon cycle vie (US-013 sera livré par H3 ; pour H1, assumer status 'draft' editable + autres statuses read-only avec bouton "Modifier" désactivé et tooltip).

- `/quotes/:id` : `Detail.tsx` — split-pane vertical :
  - Gauche : aperçu PDF embedded (via `<iframe>` d'un blob URL généré à la volée depuis `renderPdf(dto)`).
  - Droite : infos meta (numéro, client, dates, statut via StatusPill) + actions [Éditer, Télécharger PDF, Envoyer (stub pour H3/K), Signer (stub pour I/W3)].
  - Timeline événements (stub pour H3 — afficher seulement `created_at` en W2).

### Numérotation atomique

- À la création d'un devis, appeler `nextQuoteNumber(workspaceId)` de `@fakt/db`.
- Si le stub W1 existe (non-atomique) : l'utiliser mais **ajouter un TODO dans `apps/desktop/src/routes/quotes/TODO.md`** : "Migrer vers Tauri command `numbering_next_quote` atomique (BEGIN IMMEDIATE) quand Track D1/E ajoutera la commande Rust". Le sprint-plan acte que cette dette est résolue plus tard.
- Format numéro : **D2026-001, D2026-002, …** (année = year d'émission, séquence sans trous).

### Téléchargement PDF

- Bouton "Télécharger PDF" → appelle `renderPdf(quoteDto)` (retourne `Uint8Array`), puis Tauri `save_file_dialog` (command à ajouter si absent — sinon `window.__TAURI__.dialog.save` + `fs.writeBinaryFile`) pour choisir path. Filename default : `Devis-{numero}-{client_slug}.pdf`.

### Intégration shell

- Modifier `apps/desktop/src/App.tsx` pour router `/quotes`, `/quotes/new`, `/quotes/:id`, `/quotes/:id/edit`.
- Sidebar : link "Devis" déjà présent — pointer vers `/quotes`.

## Règles critiques

- **TypeScript strict** — `any` interdit.
- **DTOs Zod @fakt/core** pour toute donnée échangée UI ↔ DB ↔ PDF.
- **Recalcul live** : aucun appel DB pendant l'édition (tout en local jusqu'à Save).
- **Numérotation sans trous** : dès qu'un numéro est attribué, il ne doit jamais disparaître (même si devis supprimé avant save → réserver uniquement au "Créer" final, pas au premier draft vide).
- **PDF render via `@fakt/pdf`**, jamais réimplémenter Typst côté front.
- **Streaming IA** : UX progressive, bouton annuler opérationnel (AbortController).
- **i18n FR strict** — étoffer `packages/shared/i18n/fr.ts` avec clés `quotes.*`.
- **Mentions légales devis** : label "Bon pour accord - signature du client" au bas du PDF (cf. skills legacy).
- **Pas de README** sous-dossiers, **pas de commentaires évidents**.

## Tests

- Vitest unitaires : `computeQuoteTotal`, validation Zod, numérotation format.
- `@testing-library/react` sur écrans : NewManual (add/remove items, recalcul), NewAi (streaming mock), Edit (preload), Detail (render).
- Mock `AiProvider` via `MockAiProvider` existant (tests/fixtures).
- Mock `renderPdf` via stub retournant `Uint8Array` factice.
- Test critique : créer 10 devis séquentiels via form simulé → vérifier numéros D2026-001 à D2026-010 sans trou.
- Coverage ≥ 70% sur `apps/desktop/src/routes/quotes/`.

## DoD Track H1

- [ ] Route `/quotes` List avec tri + filtres fonctionnels.
- [ ] Création manuelle : form complet, recalcul live TTC, save draft + create numbered.
- [ ] Création IA : streaming depuis `AiProvider`, pré-remplissage items, fallback si CLI absent.
- [ ] Édition : preload + save, statut read-only selon cycle.
- [ ] Détail : PDF preview + infos + actions (éditer/download).
- [ ] Numérotation sans trous (test 10 séquentiels).
- [ ] PDF téléchargeable via Tauri dialog.
- [ ] `bun run typecheck` et `bun run test` passent.
- [ ] Coverage ≥ 70%.
- [ ] i18n FR strict.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin de H1.
- **Message exact :** `feat(track-h1): devis création manuel+IA + édition + PDF`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-h1): devis création manuel+IA + édition + PDF

  - Route /quotes (List + tri/filtres + StatusPill)
  - /quotes/new?mode=manual : form complet, recalcul live TTC, Zod
  - /quotes/new?mode=ai : composer streaming Claude CLI + fallback
  - /quotes/:id/edit + /quotes/:id (split-pane PDF preview)
  - Numérotation D2026-XXX via @fakt/db/numbering (stub, TODO atomique)
  - Download PDF via @fakt/pdf + Tauri save dialog
  - Tests Vitest + @testing-library ≥ 70% coverage

  Stories: US-008, US-009, US-010, US-011, US-012
  FRs: FR-008, FR-009, FR-010, FR-011, FR-012
  Wave: 2 · Track: H1 · Points: 13
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Commit sur `main`** (voir règle git). **Ne pas push.**

## Rapport final (< 400 mots, français)

- Livrables : checklist par route + composant majeur (✅/🟡 stub/❌ skip).
- DoD : 10 gates OK/KO.
- Commit : hash sur main.
- **Décision routing** : `/quotes/new?mode=...` ou `/quotes/new/manual` vs `/new/ai` — documenter.
- Dettes identifiées : numérotation atomique TODO, timeline stub H3.
- Risques conso H2 : composants réutilisables (ItemsEditor, ClientPicker) prêts pour factures ?
```

---

### Track H2 — Facture from scratch + from quote (13 pts)

**Agent type :** `general-purpose`
**Model :** `opus`
**Name :** `w2-track-h2-invoices`
**Description :** Factures + mentions légales auto + protection soft-delete issued
**Stories :** US-014, US-015, US-016 · **FRs :** FR-013, FR-014, FR-016

⚠️ **Lancer après merge H1** — dépend des composants `ItemsEditor`, `ClientPicker` et patterns routing de H1.

#### Prompt

```
Tu construis le **Track H2 — Facture from scratch + from quote** pour FAKT. H1 est livré et mergé sur main. Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles légales FR critiques (mentions obligatoires, TVA micro art. 293 B, soft-delete invoice issued interdit, numérotation sans trous).
2. `docs/sprint-plan.md` section **"Sub-track H2 — Facture from scratch + from quote"**.
3. `docs/prd.md` sections **FR-013** (facture depuis devis signé), **FR-014** (facture indépendante), **FR-016** (mentions légales obligatoires) — AC précis.
4. `docs/architecture.md` sections 5 (DB + triggers no-hard-delete) + 9 (PDF invoice template) + spec mentions légales.
5. `apps/desktop/src/routes/quotes/` (livré H1) — **réutiliser `ItemsEditor`, `ClientPicker`, patterns de routing**.
6. Packages consommés :
   - `packages/ui/` — primitives.
   - `packages/db/src/queries/invoices.ts` — CRUD + `createFromQuote(quoteId, mode)` + `markPaid` + guard `cannotDeleteIssued`.
   - `packages/db/src/queries/numbering.ts` — `nextInvoiceNumber(workspaceId)` (stub W1, même dette que H1).
   - `packages/pdf/src/index.ts` — `renderPdf(invoiceDto)`.
   - `packages/legal/src/mentions.ts` — `getMandatoryMentions({ regime: 'micro', type: 'invoice', amount })` → array de mentions FR à injecter.
   - `packages/legal/src/vat.ts` — `isVatExempt(regime)` + message hardcodé art. 293 B CGI.
   - `packages/legal/src/penalties.ts` — indemnité 40€ + taux pénalités.
   - `packages/core/src/models/invoice.ts` — DTO Zod `InvoiceDto`, `computeInvoiceTotal`.

## Livrables

### Route `/invoices` — `apps/desktop/src/routes/invoices/`

Remplacer le placeholder courant dans `App.tsx` :

- `/invoices` : `List.tsx` — Table Brutal miroir de /quotes (colonnes : Numéro, Client, Montant TTC, Statut, Émise le, Actions). Tri + filtre statut + filtre client + recherche. Bouton "Nouvelle facture" (menu [From Quote / From Scratch]).
- `/invoices/new?from=quote&quoteId=<id>` : `NewFromQuote.tsx` :
  - Picker devis (filtré `status IN ('sent', 'signed')`). Si quoteId déjà passé en URL, skip picker.
  - 3 boutons radio [Acompte 30% / Solde / Total].
    - **Acompte 30%** : items = ligne unique "Acompte 30% sur devis D2026-XXX", montant = `quote.total * 0.30`. Référence au devis dans les mentions.
    - **Solde** : items = lignes du devis - toutes lignes déjà facturées en acompte sur ce même devis (calcul via `@fakt/db/queries/invoices` recherche par `quote_id`). Libellé "Solde de la facturation du devis D2026-XXX".
    - **Total** : items = lignes du devis intégralement recopiées.
  - Formulaire pré-rempli, éditable avant validation. Recalcul live.
  - Dates : date émission (today), échéance (default +30j, règle FR).
  - Bouton "Créer et émettre" → status = 'issued', numéro F2026-XXX attribué, insert via `@fakt/db`.

- `/invoices/new?from=scratch` : `NewScratch.tsx` :
  - Form identique à `/quotes/new?mode=manual` de H1 (réutiliser composants `ItemsEditor`, `ClientPicker`). Pas de lien quote_id.
  - Rappel visuel : section "Mentions légales" auto-générées via `getMandatoryMentions({ regime: 'micro', type: 'invoice', amount })` → affichage read-only en bas du form.

- `/invoices/:id/edit` : `Edit.tsx` — éditable **uniquement** si `status === 'draft'`. Sinon message "Facture émise, non modifiable. Utilisez 'Créer un avoir' si correction nécessaire." (avoir = hors scope v0.1 → griser le bouton + TODO).

- `/invoices/:id` : `Detail.tsx` — split-pane miroir du devis detail :
  - Gauche : PDF preview (`renderPdf(invoiceDto)`).
  - Droite : infos + StatusPill + actions [Télécharger PDF, Envoyer (stub K), Marquer payée (stub H3), **pas de Supprimer si issued**].

### Mentions légales obligatoires (FR-016)

Le PDF facture doit inclure **toutes** les mentions suivantes (vérifiées via `@fakt/legal` et présentes dans le template Typst livré Track C) :

- Nom + forme juridique + adresse siège + SIRET workspace.
- Numéro facture unique (F2026-XXX).
- Date d'émission + date de livraison/prestation (si différente).
- Date d'échéance.
- Pénalités de retard (taux = 3x taux légal, mention obligatoire).
- Indemnité forfaitaire 40€ (obligatoire si B2B).
- "TVA non applicable, art. 293 B du CGI" (pour micro-entreprise).
- Mention "Pas d'escompte pour paiement anticipé" (si applicable).
- IBAN + BIC (pour virement).
- Client : nom, adresse, SIRET (si B2B pro).

**Responsabilité H2 :** vérifier que `@fakt/legal` produit bien ces mentions et que le template Typst (livré Track C) les injecte. Si manque → patch côté `@fakt/legal` dans le même commit, documenter.

### Protection soft-delete facture issued

- UI : bouton "Supprimer" **masqué** si `status !== 'draft'`.
- Tentative de delete via UI sur issued → afficher modal d'erreur "Archivage légal obligatoire (10 ans — CGI). Utilisez 'Créer un avoir' pour corriger."
- Query côté `@fakt/db` doit aussi throw (déjà livré W1 via `cannotDeleteIssued` + trigger SQL W0).

### Numérotation F2026-XXX

Mêmes règles que H1 (format sans trous, stub TS W1, TODO pour atomic Tauri command).

### Intégration

- Routes dans `App.tsx`.
- Sidebar "Factures" → `/invoices`.

## Règles critiques

- **Mentions obligatoires CGI** : vérifier chaque mention côté DTO + PDF. Si une manque → patch avant commit.
- **Pas de hard delete** issued. Trigger SQL déjà en place W0 — UI doit respecter + afficher message clair.
- **TVA micro** : toutes les rows ont `vat: 0` + texte "TVA non applicable, art. 293 B du CGI" dans le totals block du PDF.
- **createFromQuote** doit gérer correctement les 3 modes (acompte/solde/total) et lier `quote_id`.
- **TypeScript strict**, **Zod DTO**, **i18n FR** (étoffer `invoices.*`), **pas de commentaires évidents**.
- Réutiliser au maximum les composants H1 (`ItemsEditor`, `ClientPicker`) — pas de duplication.

## Tests

- Vitest unit : `computeInvoiceTotal` avec/sans acompte, Zod validation, format numéro.
- `@testing-library/react` : NewFromQuote (picker + 3 modes), NewScratch (form), Edit (guard status), Detail (render + actions disabled).
- Test critique : créer 10 factures séquentielles → F2026-001 à F2026-010 sans trou.
- Test : tenter delete sur issued → throw depuis query + UI bouton absent.
- Test PDF mentions : sérialiser InvoiceDto → appeler `getMandatoryMentions` → vérifier array complet.
- Coverage ≥ 70%.

## DoD Track H2

- [ ] Route `/invoices` List avec tri + filtres.
- [ ] From Quote : 3 modes acompte/solde/total, pré-remplissage correct.
- [ ] From Scratch : form complet, mentions auto affichées.
- [ ] Édition : guard draft-only.
- [ ] Détail : PDF preview + actions conditionnelles au statut.
- [ ] Numérotation F2026-XXX sans trous.
- [ ] Mentions obligatoires FR toutes présentes dans PDF (FR-016).
- [ ] Protection delete issued effective (UI + DB).
- [ ] `bun run typecheck` et `bun run test` passent.
- [ ] Coverage ≥ 70%.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique pour H2.
- **Message exact :** `feat(track-h2): facture from-quote + from-scratch + mentions FR`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-h2): facture from-quote + from-scratch + mentions FR

  - Route /invoices (List + tri/filtres + StatusPill)
  - /invoices/new?from=quote : picker + modes acompte/solde/total
  - /invoices/new?from=scratch : form miroir devis + mentions auto
  - /invoices/:id/edit (draft-only guard) + /invoices/:id detail
  - Numérotation F2026-XXX via @fakt/db/numbering
  - Mentions obligatoires CGI (art. 293 B micro, pénalités, 40€, IBAN)
  - Protection soft-delete issued (UI hide + DB guard)
  - Tests Vitest ≥ 70% coverage

  Stories: US-014, US-015, US-016
  FRs: FR-013, FR-014, FR-016
  Wave: 2 · Track: H2 · Points: 13
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Commit sur `main`**. **Ne pas push.**

## Rapport final (< 400 mots, français)

- Livrables : checklist par route + mention obligatoire vérifiée (✅/🟡/❌).
- DoD : 10 gates OK/KO.
- Commit : hash sur main.
- Réutilisation composants H1 : %age effectif vs duplication.
- Dettes identifiées : avoir hors scope, atomic numbering TODO.
- Risques conso H3 : StatusPill + transitions cycle vie bien câblés ?
```

---

### Track H3 — Cycle vie + statut paiement (8 pts)

**Agent type :** `general-purpose`
**Model :** `opus`
**Name :** `w2-track-h3-lifecycle`
**Description :** StatusPill + transitions + Marquer payée + widgets dashboard basique
**Stories :** US-013, US-017 · **FRs :** FR-012 (cycle devis), FR-015 (cycle facture + paiement)

⚠️ **Lancer après merge H1 ET H2** — consomme les 2.

#### Prompt

```
Tu construis le **Track H3 — Cycle vie + statut paiement** pour FAKT. Dernière pièce du cœur métier ALPHA. H1 et H2 sont livrés et mergés. Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — conventions.
2. `docs/sprint-plan.md` section **"Sub-track H3 — Cycle vie + statut paiement"**.
3. `docs/prd.md` sections **FR-012** (cycle vie devis : draft → sent → viewed → signed → invoiced), **FR-015** (cycle vie facture + paiement : draft → sent → paid + date + méthode).
4. `apps/desktop/src/routes/quotes/` (H1) + `routes/invoices/` (H2) — les 2 routes existent, il faut y câbler les transitions et le widget paiement.
5. Packages consommés :
   - `packages/ui/StatusPill` — primitive livrée W1 à styler selon états.
   - `packages/db/src/queries/quotes.ts` `updateStatus(id, status)`.
   - `packages/db/src/queries/invoices.ts` `markPaid(id, date, method)`.
   - `packages/core/src/models/` — enums QuoteStatus, InvoiceStatus.

## Livrables

### Cycle de vie devis (FR-012)

**États** : `draft` → `sent` → `viewed` (v0.2 pixel tracker, **skip en H3**) → `signed` (auto par Track I W3) → `invoiced` (auto quand facture `createFromQuote` via H2).

- `StatusPill` wrapper consommé dans List + Detail devis avec mapping couleurs Brutal :
  - `draft` : papier (bg `#F5F5F0`, border #000).
  - `sent` : jaune (`#FFFF00`, border #000).
  - `signed` : noir (bg `#000`, fg `#FFFF00`).
  - `invoiced` : gris outline + barre (semi-terminal).
- Action "Marquer envoyé" sur Detail devis en status `draft` : modal confirm → `updateStatus(id, 'sent')`.
- Transition automatique `invoiced` : quand H2 `createFromQuote(quoteId)` succède, appeler en chain `quotes.updateStatus(quoteId, 'invoiced')`. **Responsabilité H3 : patcher le handler côté `/invoices/new?from=quote` pour déclencher cette update.**

### Cycle de vie facture (FR-015)

**États** : `draft` → `sent` → `paid` + date paiement + méthode.

- StatusPill mapping :
  - `draft` : papier.
  - `sent` : jaune.
  - `paid` : vert (ajouter une variante verte au StatusPill si absente, sinon outline noir sur fond papier avec check ✓ UPPERCASE).
  - `overdue` (computed, non persisté) : rouge (ajouter variante si absente) — dérivé de `due_date < today && status === 'sent'`.
- Action "Marquer envoyée" sur Detail facture en `draft` : `updateStatus(id, 'sent')`.
- Action "Marquer payée" sur Detail facture en `sent` :
  - Modal `MarkPaidModal.tsx` avec :
    - Date picker (default today).
    - Radio method : Virement, CB, Espèces, Chèque, Autre (avec input text si "Autre").
    - Notes optionnelles.
  - Bouton "Confirmer" → invoke `markPaid(id, { date, method, notes })` via `@fakt/db`.
  - Après succès, toast + StatusPill update → `paid`.

### Widgets dashboard basique

Modifier `apps/desktop/src/routes/dashboard.tsx` — remplacer le placeholder actuel par un layout simple (pas le dashboard avancé qui viendra en Track J Wave 3) :

- Titre + sous-titre workspace.
- Section "Devis en attente signature" : Card avec count (quotes `status IN ('sent')`) + lien vers liste filtrée.
- Section "Factures en retard" : Card avec count + somme TTC des factures `status = 'sent' AND due_date < today`.
- Section "Activité récente" : last 5 events (créations devis/facture, transitions, paiements) — tirer les données via queries existantes, trier par `updated_at DESC`.

Disposition : grid 2 colonnes Brutal. Zéro radius, bordures 2.5px Card.

### Intégration

- Patch `apps/desktop/src/routes/quotes/Detail.tsx` et `invoices/Detail.tsx` pour intégrer actions transition.
- Patch `apps/desktop/src/routes/invoices/NewFromQuote.tsx` (H2) pour chaîner l'update `quotes.updateStatus(quoteId, 'invoiced')` après `createFromQuote`.
- Patch `apps/desktop/src/routes/dashboard.tsx` pour widgets.

## Règles critiques

- **Transitions cycle vie validées** côté `@fakt/db` (`updateStatus` doit refuser transitions invalides, ex: `signed` → `draft`). Si guard non présent dans queries W1, l'ajouter dans le même commit.
- **`overdue` est computed**, pas stocké. Calculer côté UI (List + dashboard widget).
- **`viewed` hors scope v0.1** : ne pas exposer dans l'UI, documenter en TODO.
- **`signed` est set par Track I** (Wave 3) — H3 accepte seulement l'enum + mapping visuel, pas le flow signature.
- **TypeScript strict**, **Zod** sur input `MarkPaidModal`, **i18n FR** (étoffer `status.*`, `payment.*`).
- Réutiliser composants `@fakt/ui` — pas de réimplémentation.

## Tests

- Vitest unit : mapping enum → couleur StatusPill, transitions valides/invalides guard, computed `overdue`.
- `@testing-library/react` : MarkPaidModal (submit + validation), Detail avec bouton "Marquer envoyé"/"Marquer payée" visible selon status.
- Test intégration : NewFromQuote crée facture → quote passe à `invoiced` automatiquement.
- Test dashboard : mock 5 quotes + 5 invoices → widgets affichent bons counts/sums.
- Coverage ≥ 70%.

## DoD Track H3

- [ ] StatusPill câblé sur List + Detail devis + facture avec mapping couleurs Brutal.
- [ ] Actions "Marquer envoyé" devis et facture opérationnelles.
- [ ] Modal "Marquer payée" avec date + méthode + notes fonctionnel.
- [ ] Transition auto `invoiced` quand facture créée from quote.
- [ ] Dashboard widgets basiques fonctionnels (devis en attente, factures en retard, activité).
- [ ] `overdue` computed côté UI.
- [ ] Guards transitions côté DB queries (ou patch).
- [ ] `bun run typecheck` et `bun run test` passent.
- [ ] Coverage ≥ 70%.
- [ ] i18n FR.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique pour H3.
- **Message exact :** `feat(track-h3): cycle vie devis+facture + marquer payée + dashboard basique`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-h3): cycle vie devis+facture + marquer payée + dashboard basique

  - StatusPill câblé (draft/sent/signed/invoiced/paid/overdue)
  - Actions Marquer envoyé + Marquer payée (modal date + méthode)
  - Transition auto invoiced quand createFromQuote
  - Dashboard widgets : devis en attente, factures retard, activité
  - overdue computed UI-side (due_date < today)
  - i18n FR status.* + payment.*
  - Tests Vitest ≥ 70% coverage

  Stories: US-013, US-017
  FRs: FR-012 (cycle devis), FR-015 (cycle facture + paid)
  Wave: 2 · Track: H3 · Points: 8
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent.
- **Commit sur `main`**. **Ne pas push.**

## Rapport final (< 300 mots, français)

- Livrables : checklist des 3 blocs (cycles + modal paiement + widgets).
- DoD : 10 gates OK/KO.
- Commit : hash sur main.
- Dettes identifiées : `viewed` v0.2, `signed` delegated Track I, avoir v0.2.
- **Milestone ALPHA atteint à la fin de H3** : confirmer que Tom peut créer client + prestation + devis + facture + marquer payée bout en bout.
```

---

## Stratégie fin de Wave 2 — milestone ALPHA (J+10 cible)

Fin de Wave 2 = **milestone ALPHA**. À la fin des 5 commits (F + G + H1 + H2 + H3) sur main :

1. Tom (ou Claude orchestrateur) lit les 5 rapports d'agents + inspecte les commits.
2. `bun install && bun run typecheck && bun run test` **global** (tous packages + apps/desktop) → 10/10 + nouveaux tests.
3. Tom lance `bun run dev` + fait un tour complet manuel du flow :
   - Fresh install (delete dev db) → wizard onboarding → ajout 1 client → ajout 1 prestation → création devis manuel → PDF → création facture from quote → marquer payée → vérifier dashboard widgets.
4. Si tout marche : tag `alpha-done` sur main, update `docs/sprint-status.yaml` :
   - `waves[wave 2].status = "completed"` + `completed_at`.
   - `milestones[alpha].status = "completed"` + `completed_at`.
   - `current_wave = 3`, `current_milestone = "beta"`.
5. **Tom désinstalle les 2 skills Claude Code** (`/devis-freelance`, `/facture-freelance`) → ALPHA acquise.
6. Lancer Wave 3 : Track I (Signature flow intégré, consomme W1 Track D) + Track J (Dashboard avancé + UI Brutal complète + Composer sidebar) en parallèle.

---

## Escalade

- Si un track Wave 2 remonte un blocker majeur (ex: composant @fakt/ui manquant, query @fakt/db insuffisante) → commit `wip(track-X): ...` avec body explicatif + créer `docs/sprint-notes/<track>-<date>.md` avec détails et demander patch d'un track W1 adjacent.
- Si Track H1 bloque sur IA streaming (pré-H2) → livrer H1 en mode `manual-only` avec TODO IA, ne pas retenir toute la chaîne.
- Si Track H2 découvre mentions manquantes dans `@fakt/legal` → patcher dans le commit H2, noter dans body.

---

## Rappel actions externes (hors scope code)

Ces actions bloquent **Track L Wave 4** (release signée) mais **pas** la Wave 2. Tom doit les lancer en parallèle :

- **Windows OV Code Signing cert** (Sectigo/DigiCert, ~200€/an, délai 3-7j).
- **Apple Developer Program** (99 USD/an, immédiat).
- **Validation manuelle Adobe Reader** : ouvrir `apps/desktop/src-tauri/tests/output/signed_pades_b_t_freetsa.pdf` dans Acrobat Reader, vérifier signature verte "cert self-signed non-trusted" + timestamp visible (Wave 1 Track D validation restante).
