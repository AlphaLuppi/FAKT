# Sprint Briefs — Wave 3 · FAKT v0.1.0

**Date :** 2026-04-21
**Contexte :** Wave 2 terminée et pushée sur `origin/main` (HEAD `9ad35ba`). Milestone **ALPHA atteint à J+0** (target J+10, x10 d'avance). Les 2 briefs ci-dessous ciblent la Wave 3 — **Signature PAdES intégrée + UI avancée**. Fin de Wave 3 = **milestone BETA** (target J+17 = 2026-05-08).
**Stratégie :** 2 agents simultanés max (I + J en parallèle batch unique). Référence maître : `docs/sprint-plan.md` section "Wave 3 — Signature + UI avancée".

---

## Règles de lancement

1. **Batch unique (I + J)** lancé en parallèle dans un seul message (2 `Agent()` tool calls). `parallel_agents_max: 2` dans sprint-status.
2. **Prérequis main** : `bun run typecheck && bun run test` passent sur HEAD `9ad35ba` (10/10 packages · 168 tests ✓ validation Wave 2 ALPHA).
3. **Model mix :**
   - **Opus** : Track I — signature intégrée (complexité UI ↔ crypto Rust ↔ audit trail, blast radius max sur la différenciation BETA).
   - **Sonnet** : Track J — dashboard + composer (UI riche mais patterns déjà connus depuis Wave 1 UI primitives + Wave 2 widgets basiques).
4. **Isolation `worktree` conseillée** pour concurrence, mais **chaque agent commit DIRECTEMENT sur `main`** (voir règle git ci-dessous).

## ⚠️ Règle git — commit sur main (confirmée Waves 1 + 2)

> **Chaque agent commit son travail atomique DIRECTEMENT sur la branche `main` du repo principal.**
> - Peu importe si l'agent tourne dans un worktree isolé ou non.
> - Depuis un worktree : écrire les fichiers livrés dans le **repo main** (`C:\Users\andri\IdeaProjects\AlphaLuppi\facture-devis\`) via chemins absolus, puis `git -C <main_repo> add <files> && git -C <main_repo> commit -s -m "..."` **en ciblant main**. Le worktree peut rester vide ou servir uniquement de sandbox exploratoire.
> - Depuis main (sans worktree) : directement `git add` + `git commit -s` sur main.
> - **Ne JAMAIS push.** Tom push lui-même a posteriori après review.
> - Message de commit et body : suivre le template de chaque track (`feat(track-x): ...` + DCO).
> - Si deux agents commit en parallèle : git gère le lock, l'un attend l'autre. En cas de conflit (peu probable car tracks disjoints), l'agent retry ou escalade.

## ⚠️ Règle git — `git add` avec chemins EXPLICITES (incident Wave 2 batch 1)

> **Ne jamais utiliser `git add -A` ou `git add .` depuis un agent.**
> Toujours stager les fichiers par chemin nommé : `git add apps/desktop/src/routes/quotes/... packages/... docs/...`
> **Pourquoi :** en batch parallèle Wave 2, l'agent G a absorbé dans son commit les fichiers onboarding/settings de l'agent F (ils partageaient la même worktree). Correctif a dû être appliqué a posteriori. En Wave 3 les tracks I et J touchent des fichiers potentiellement adjacents (routes devis/facture ↔ dashboard/filtres listes) — le risque de collision est réel.
> Stage uniquement ce que ton scope produit. Si tu vois des fichiers étrangers dans `git status`, c'est un autre agent — ne les touche pas.

## ⚠️ Avertissement sur `feature-dev:code-architect` (retour d'expérience Waves 1 + 2)

**Retour d'expérience :**
- Wave 1 (tracks A et C) : `subagent_type: "feature-dev:code-architect"` a **halluciné des plans "à créer"** au lieu d'écrire le code + de committer. Deux retries ont été nécessaires.
- Wave 2 : forcer `general-purpose` sur F/G/H1/H2/H3 → **zéro retry nécessaire**. Résultat net.

**Règle Wave 3 :** pour **tout livrable code réel** (I et J), utiliser obligatoirement `subagent_type: "general-purpose"`. Le sprint-plan mentionne `feature-dev:code-architect` pour ces tracks — **ignorer** cette recommandation et forcer `general-purpose`.

Réserver `feature-dev:code-architect` uniquement aux tâches explicitement de **planning / architecture sans code à commiter**.

## Signature `Agent()` commune

```ts
Agent({
  subagent_type: "general-purpose",   // JAMAIS feature-dev:code-architect
  model: "opus" | "sonnet",           // selon le track
  isolation: "worktree",
  name: "w3-track-<id>",
  description: "<short>",
  prompt: "<voir brief ci-dessous>"
})
```

---

## Track I — Signature flow intégré (13 pts)

**Agent type :** `general-purpose` (pas code-architect)
**Model :** `opus`
**Name :** `w3-track-i-signature`
**Description :** Signature PAdES intégrée UI ↔ crypto Rust ↔ audit trail
**Stories :** US-018, US-019, US-020 · **FRs :** FR-016, FR-017, FR-018

### Prompt

```
Tu construis le **Track I — Signature flow intégré** pour FAKT. C'est la différenciation clé du produit vs les skills Claude Code (signature PAdES B-T maison au lieu d'une API tierce) et c'est ce qui verrouille le milestone **BETA (J+17, target 2026-05-08)**.

Wave 2 ALPHA est livrée et pushée sur origin/main (HEAD 9ad35ba). Wave 1 Track D (crypto PAdES) a produit les primitives Rust : generate_cert / get_cert_info / rotate_cert / sign_document (orchestre D1+D2+D3) / embed_signature / TSA + audit_trail chaîné. Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles Brutal Invoice + légal FR (**niveau eIDAS "avancée" AdES-B-T uniquement, ne JAMAIS prétendre "qualifiée" dans l'UI**).
2. `docs/sprint-plan.md` section **"Track I — Signature flow intégré"** — livrables + DoD.
3. `docs/prd.md` sections **FR-016** (signature avec PNG dessiné), **FR-017** (intégrité hash `/ByteRange`), **FR-018** (audit trail chaîné SHA-256 + TSA RFC 3161) — AC précis.
4. `docs/architecture.md` section 7 complète (flow PAdES 13 étapes, déjà implémenté par Track D W1).
5. `.design-ref/gestion-de-facture-et-devis/project/components/detail-signature.jsx` — référence visuelle des 3 variantes (checkbox / dessin canvas / page Yousign-like). **Choisir variante dessin canvas** comme principale v0.1 + ajouter onglet "Taper nom au clavier → police cursive" en fallback.
6. `apps/desktop/src-tauri/src/crypto/` (livré Wave 1) :
   - `cert.rs` : `generate_self_signed_cert`, `get_cert_info`, `rotate_cert`.
   - `pades.rs` : `embed_signature(pdf_bytes, cert_der, priv_key_der, signature_png)`.
   - `tsa.rs` : client RFC 3161 (FreeTSA + fallbacks DigiCert/Sectigo).
   - `audit.rs` : `append_signature_event(prev_hash, event_data) -> new_hash`.
   - Tauri command `sign_document(doc_id, signature_png) -> Vec<u8>` orchestre les 3.
7. `apps/desktop/src/routes/quotes/Detail.tsx` + `routes/invoices/Detail.tsx` (livrés H1/H2) — où intégrer le trigger signature.
8. `packages/db/src/queries/signatures.ts` (livré Track B W1) — `appendSignatureEvent` + `getSignatureChain(docType, docId)`.
9. `packages/ui/` — `Modal`, `Button`, `Input`, `Canvas` (primitive signature déjà livrée Track A W1), `Tabs` (si absent, à ajouter dans @fakt/ui côté I — noter dans body commit).
10. `packages/shared/i18n/fr.ts` — à étoffer avec clés `signature.*`, `audit.*`.

## Livrables

### 1. Modal `SignatureModal` — `apps/desktop/src/components/signature-modal/`

Déclenché depuis la vue détail devis (action "Signer") ET facture (action "Signer") quand `status IN ('draft', 'sent')`. Non disponible sur `signed` / `invoiced` / `paid`.

Structure :
- Modal fullscreen Brutal (bordure 2.5px, shadow 5px 5px 0 #000, zéro radius).
- Header : "Signer : D2026-XXX — {{client_name}}" + bouton fermer.
- Body avec 2 onglets (Tabs Brutal chips ou segmented control) :
  - **Onglet "Dessiner au trackpad"** (principal, sélectionné par défaut) :
    - Composant `SignatureCanvas.tsx` basé sur la primitive `Canvas` de `@fakt/ui` (livrée Track A).
    - Capture `pointer events` (pointerdown/move/up) en coordonnées relatives.
    - **Smoothing bezier** entre points successifs pour un rendu manuscrit propre (implémenter dans `SignatureCanvas` ou consommer une lib légère si déjà en dépendance).
    - Pression variable optionnelle (stylus-friendly) — nice-to-have, pas bloquant.
    - Export PNG via `canvas.toDataURL('image/png')` → convertit en `Uint8Array` base64-decoded.
    - Bouton "Effacer" qui reset le canvas.
    - Dimensions : 600×200px (ratio signature papier).
  - **Onglet "Taper au clavier"** (fallback) :
    - `Input` text large.
    - Affichage live dans une police cursive (web-safe : `"Brush Script MT", "Snell Roundhand", cursive` ou équivalent téléchargeable si design system le permet — valider Brutal compat, sinon font-family système).
    - Rendu en PNG côté client via `canvas` offscreen (`OffscreenCanvas` ou canvas caché) + `fillText` → export PNG.
- Footer :
  - Checkbox "Je comprends que cette signature électronique avancée AdES-B-T engage ma responsabilité" (obligatoire, sinon bouton disabled).
  - Bouton "Signer définitivement" (primary Brutal, hover inversion).
  - Bouton "Annuler" (secondary).

Action "Signer définitivement" :
1. UI : state loading "Préparation du document…" (spinner Brutal).
2. Appel `invoke('sign_document', { docId: quote.id | invoice.id, docType: 'quote' | 'invoice', signaturePng: base64String })`.
3. Backend Rust orchestre (déjà livré W1) : retrieve cert + render PDF frais + embed signature + TSA timestamp + append audit event.
4. Update UI : message "Signature en cours (embed PAdES-B-T + horodatage TSA)…" (~500ms-1.5s selon RFC 3161 round-trip).
5. Réception `Vec<u8>` du PDF signé → save côté DB :
   - Pour devis : `quotes.updateStatus(quoteId, 'signed')` + store chemin PDF signé (nouvelle colonne `signed_pdf_path` ou table `signed_documents` — si nouveau schema nécessaire, migration dans `packages/db/migrations/` avec commit séparé OU patch inline dans le commit I — documenter).
   - Pour facture : `invoices.updateStatus(invoiceId, 'sent')` (signer = envoyer implicitement). Patcher `cycle vie` côté H3 si besoin.
6. Toast succès : "Document signé et horodaté. Signature vérifiable dans l'onglet Audit."
7. Close modal, retour sur Detail avec StatusPill mis à jour.

Erreur handling :
- Catch toute erreur Tauri (timeout TSA, cert absent, PDF non trouvé).
- Afficher Modal d'erreur Brutal avec : message d'erreur, bouton "Réessayer", bouton "Annuler".
- Si cert absent : proposer CTA "Configurer mon certificat" → navigate `/settings#certificate`.

### 2. Intégration côté Detail devis + facture

Patch dans :
- `apps/desktop/src/routes/quotes/Detail.tsx` : remplacer le stub "Signer (→ track I/W3)" par un vrai bouton qui ouvre `SignatureModal` avec `docType: 'quote'`.
- `apps/desktop/src/routes/invoices/Detail.tsx` : idem avec `docType: 'invoice'`.

Visibilité bouton "Signer" :
- Devis : `status IN ('draft', 'sent')`.
- Facture : `status IN ('draft', 'sent')`. **La signature facture est optionnelle** mais permet de générer un PDF signé à envoyer au client (compliance archivage renforcé). Si Tom préfère ne signer QUE les devis en v0.1, documenter le choix dans TODO.md.

### 3. Timeline audit trail UI — `apps/desktop/src/components/audit-timeline/`

Composant `AuditTimeline.tsx` :
- Consomme `packages/db/src/queries/signatures.ts` `getSignatureChain(docType, docId)` → retourne la chaîne triée par timestamp ASC.
- Rendu vertical Brutal :
  - Ligne verticale noire épaisse (2.5px) côté gauche.
  - Chaque événement = Card Brutal 2.5px bordure avec :
    - Icône + label événement (`created`, `sent`, `signed`, `viewed` (skip v0.1), `paid`, `rotated_cert`, `verified`).
    - Timestamp absolu format FR + relatif ("il y a 3 jours").
    - Signer (nom workspace owner ou client en v0.2 si cosign).
    - Hash document avant/après (affichage mono tronqué 8 chars + tooltip full).
    - TSA provider utilisé (FreeTSA / DigiCert / Sectigo) si event signature.
    - IP (en local "localhost" pour v0.1 solo mode).
- Intégration : remplacer le stub timeline dans `quotes/Detail.tsx` + `invoices/Detail.tsx` (livré H3 en `created_at` seulement) par ce vrai composant.

Cas spéciaux à afficher dans la timeline :
- Event `signed` : afficher bouton "Vérifier la signature" → navigate `/signatures/:eventId/verify`.
- Event `rotated_cert` (quand user régénère son cert via Settings) : afficher warning visuel "Les signatures antérieures utilisent un cert différent. Elles restent valides via la chaîne d'audit."

### 4. Page vérification signature — `apps/desktop/src/routes/signatures/`

Route `/signatures/:eventId/verify` — `Verify.tsx` :
- Load l'événement signature + chaîne parent depuis `getSignatureChain`.
- Sections :
  - **Document :** type + numéro + client.
  - **Signature :** timestamp TSA, provider, algorithme (RSA-4096 + SHA-256), cert DN + fingerprint + validité.
  - **Intégrité :** hash document byte-range + comparaison au hash stocké dans l'event. **Status badge** : ✓ "Intégrité vérifiée" (vert Brutal) ou ✗ "Hash divergent" (rouge).
  - **Chaîne audit :** mini-timeline depuis `created` jusqu'au `signed` actuel, avec vérification hash chaîné SHA-256 (`prev_hash` de chaque event doit matcher le `new_hash` du précédent).
  - **Actions :** bouton "Télécharger PDF signé", bouton "Retour au document".
- Tauri command à exposer (ou réutiliser si D3 livre déjà) : `verify_signature(doc_id, event_id) -> VerifyReport` — retourne un objet avec les status ci-dessus. Si non livrée Wave 1, l'ajouter dans `apps/desktop/src-tauri/src/crypto/verify.rs` et exposer côté Tauri.

### 5. Dettes Wave 2 portées Wave 3 (à résorber dans le commit I)

Ces Tauri commands étaient stubées côté TS en Wave 2, à câbler côté Rust maintenant pour que la BETA soit production-ready :

- `is_setup_completed() -> bool` — remplace stub TS (consommé par Track F onboarding guard).
- `complete_setup() -> ()` — set `setupCompletedAt = now()` côté DB.
- `mark_quote_invoiced(quote_id) -> ()` — transition auto déjà câblée côté TS (H3), mettre la source de vérité en Rust.
- `mark_invoice_sent(invoice_id) -> ()` — idem, renforcer avec guard DB trigger.
- `update_invoice(invoice_id, data) -> ()` + `delete_invoice(invoice_id) -> Result` — actuellement stubées TS, passer en Rust pour enforcer les règles légales FR (no hard delete issued, numérotation immuable une fois attribuée).
- **Atomic numbering Tauri command (CRITIQUE pour compliance CGI art. 289) :**
  - `numbering_next_quote(workspace_id) -> String` et `numbering_next_invoice(workspace_id) -> String`.
  - Implémentation SQLite `BEGIN IMMEDIATE` (lock write transaction) → `SELECT MAX(sequence) FOR UPDATE + 1` → `INSERT` séquence → `COMMIT` → return `"D2026-042"` formaté.
  - Remplace le stub TS non-atomique actuel (`packages/db/src/queries/numbering.ts`) côté consumer : le wrapper TS appelle désormais la Tauri command et fallback stub uniquement en mode dev web (sans Tauri).

Documenter chaque command câblée dans body commit + `apps/desktop/src-tauri/src/commands/README.md` n'est **pas** requis (règle CLAUDE.md : pas de README sous-dossiers).

### 6. Patch cycle vie / statuts si nécessaire

- Si le schema DB n'a pas de colonne pour stocker le chemin PDF signé : ajouter migration `packages/db/migrations/0001_signed_pdf.sql` + régénérer snapshot Drizzle + update `signatures` query pour retourner le path.
- Si StatusPill ne gère pas correctement les transitions post-signature : patch dans le même commit.

## Règles critiques

- **eIDAS "avancée" uniquement** — jamais "qualifiée" dans l'UI ou les toasts.
- **TypeScript strict** — `any` interdit, `unknown` + type guards.
- **Tous composants via `@fakt/ui`** — pas de réimplémentation. Si besoin d'un nouveau primitif (ex: Tabs), l'ajouter dans `packages/ui/` dans le même commit.
- **i18n FR strict** — aucune string hardcodée anglaise. Étoffer `packages/shared/i18n/fr.ts` avec `signature.*`, `audit.*`, `verify.*`.
- **Zod validation** sur input SignatureModal (acceptation checkbox obligatoire, signature PNG non vide).
- **Performance NFR-002** : signature embed < 500ms (déjà validé Track D benchmark 10.58ms). Full signature + TSA < 1.5s.
- **Erreurs gracieuses** : catch + toast + retry button. Jamais crash.
- **Audit trail append-only** : respecter le design W1 (jamais UPDATE/DELETE sur `audit_events` ou `signature_events`).
- **Pas de commentaires évidents**. Un commentaire = une contrainte cachée.
- **Pas de README** dans sous-dossiers (règle CLAUDE.md).

## Tests

- Vitest unit : smoothing bezier (mock pointer events → PNG généré), validation Zod SignatureModal.
- `@testing-library/react` : SignatureModal (tabs switch, canvas draw simulated, validation checkbox, submit avec mock `invoke`).
- `@testing-library/react` : AuditTimeline (render avec 3 events fixtures, assertion rendu timestamps + hashes).
- Cargo tests côté Rust : atomic numbering (race condition simulée avec 2 threads concurrents → séquence sans trou), verify_signature sur fixture PDF signé.
- Integration test (Vitest + mock Tauri) : click "Signer" → mock `sign_document` retourne Vec<u8> → assert status update + toast succès + AuditTimeline refetch.
- Coverage Vitest ≥ 70% sur `apps/desktop/src/components/signature-modal/`, `components/audit-timeline/`, `routes/signatures/`.

## DoD Track I

- [ ] Modal SignatureModal fonctionnelle 2 onglets (dessin canvas + taper clavier).
- [ ] Canvas HTML5 avec smoothing bezier + export PNG propre.
- [ ] `sign_document` Tauri command appelée depuis UI, retourne PDF signé, status mis à jour DB.
- [ ] Timeline audit trail rendue sur Detail devis + facture (consomme `getSignatureChain`).
- [ ] Page `/signatures/:eventId/verify` fonctionnelle avec report intégrité.
- [ ] Transition `signed` sur devis + `sent` sur facture après signature.
- [ ] Dettes W2 résorbées : Tauri commands is_setup_completed / complete_setup / mark_quote_invoiced / mark_invoice_sent / update_invoice / delete_invoice / numbering_next_quote / numbering_next_invoice câblées Rust avec atomicité CGI.
- [ ] `bun run typecheck` et `bun run test` passent **global** (10/10 packages sur repo principal).
- [ ] Coverage ≥ 70% sur scope I.
- [ ] i18n FR : aucune string anglaise.
- [ ] Performance : signature embed + TSA < 1.5s.
- [ ] eIDAS "avancée" strict dans tous les labels UI (jamais "qualifiée").

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-i): signature PAdES intégrée + audit timeline + atomic numbering`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-i): signature PAdES intégrée + audit timeline + atomic numbering

  - SignatureModal 2 onglets (canvas dessin + taper cursive)
  - Canvas HTML5 smoothing bezier + export PNG
  - sign_document orchestre D1+D2+D3 (cert + embed + TSA + audit)
  - AuditTimeline sur Detail devis+facture (chaîne SHA-256)
  - Route /signatures/:eventId/verify (report intégrité)
  - Transitions signed (devis) + sent (facture) post-signature
  - Tauri commands Rust : is_setup_completed, complete_setup,
    mark_quote_invoiced, mark_invoice_sent, update_invoice, delete_invoice
  - Atomic numbering SQLite BEGIN IMMEDIATE (CGI art. 289)
  - i18n FR signature.* / audit.* / verify.*
  - Tests Vitest + Cargo ≥ 70% coverage

  Stories: US-018, US-019, US-020
  FRs: FR-016, FR-017, FR-018
  Wave: 3 · Track: I · Points: 13
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent global 10/10 packages sur main.
- **`git add` avec chemins explicites uniquement** (voir règle haut du document). Stage : `apps/desktop/src/components/signature-modal/`, `apps/desktop/src/components/audit-timeline/`, `apps/desktop/src/routes/signatures/`, `apps/desktop/src/routes/quotes/Detail.tsx`, `apps/desktop/src/routes/invoices/Detail.tsx`, `apps/desktop/src-tauri/src/commands/` (Rust nouvelles commands), `apps/desktop/src-tauri/src/crypto/verify.rs` (si ajouté), `packages/ui/` (Tabs si ajouté), `packages/shared/i18n/fr.ts`, `packages/db/migrations/` (si schema patché), `packages/db/src/queries/` (si patché).
- **Commit sur `main`** (voir règle git en haut du document). **Ne pas push.**

## Rapport final (< 400 mots, français)

- Livrables : checklist des 6 blocs (Modal, intégration Detail, Timeline, Verify, Dettes W2, Patch cycle).
- DoD : 11 gates OK/KO.
- Commit : hash sur main.
- **Validation Adobe Reader** : Tom doit ouvrir `apps/desktop/src-tauri/tests/output/signed_pades_b_t_freetsa.pdf` (livré W1) pour valider manuellement la signature verte. Si pas encore fait : rappeler Tom dans le rapport.
- Choix implémentation canvas smoothing : lib externe (noter laquelle + taille) ou maison.
- Dettes résiduelles : viewed event v0.2, avoir v0.2, cosign v0.2 (jamais dans v0.1).
- Risques conso Track K (Wave 4) : email draft doit-il attacher le PDF signé ou le non-signé ? Documenter.
```

---

## Track J — Dashboard avancé + Composer IA sidebar (21 pts)

**Agent type :** `general-purpose` (pas code-architect)
**Model :** `sonnet`
**Name :** `w3-track-j-dashboard-composer`
**Description :** Dashboard KPIs + filtres listes + vue détail refonte + Composer sidebar + raccourcis
**Stories :** US-025, US-026, US-027, US-028 · **FRs :** FR-023, FR-024, FR-025

### Prompt

```
Tu construis le **Track J — Dashboard avancé + Composer IA sidebar** pour FAKT. C'est la couche UX qui transforme FAKT d'un outil fonctionnel (ALPHA) en un outil plaisant (BETA). 21 points — le plus gros track Wave 3.

Wave 2 ALPHA est livrée et pushée sur origin/main (HEAD 9ad35ba). Dashboard basique (widgets 3 cards) a été livré par Track H3. Tu refondes ce dashboard en pleine version + ajoutes filtres listes + vue détail split-pane + composer sidebar persistent + raccourcis clavier. Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles Brutal Invoice non-négociables (0px radius, bordures 2.5px, shadows plates 3/5/8px, hover inversion #000↔#FFFF00).
2. `docs/sprint-plan.md` section **"Track J — Dashboard + UI avancée Brutal Invoice"** — livrables + DoD.
3. `docs/prd.md` sections **FR-023** (dashboard KPIs + pipeline + activity), **FR-024** (filtres puissants listes + URL persist), **FR-025** (composer IA sidebar + raccourcis).
4. `docs/architecture.md` sections 3 (apps layout), 10 (UI architecture), 11 (AI layer streaming).
5. `.design-ref/gestion-de-facture-et-devis/project/components/dashboard.jsx` — référence visuelle Dashboard (KPIs cards, pipeline horizontal, activity feed).
6. `.design-ref/gestion-de-facture-et-devis/project/components/composer.jsx` — référence visuelle Composer (sidebar + textarea + streaming + contexte injection).
7. `.design-ref/gestion-de-facture-et-devis/project/components/lists.jsx` + `detail-signature.jsx` + `doc-preview.jsx` — références vues détails split-pane.
8. `apps/desktop/src/routes/dashboard.tsx` (livré H3 basique) — à refondre.
9. `apps/desktop/src/routes/quotes/List.tsx` + `Detail.tsx` + `invoices/List.tsx` + `Detail.tsx` (livrés H1/H2/H3) — à enrichir avec filtres + split-pane.
10. Packages consommés :
    - `packages/ui/` — tous composants Brutal Invoice (Card, Button, Chip, Input, Table, StatusPill, Modal, CommandPalette, Sparkline, Breadcrumb).
    - `packages/db/src/queries/` — toutes queries W1 pour alimenter dashboard + filtres.
    - `packages/ai/` — `AiProvider.draftEmail`, et nouveau : `AiProvider.chat(messages: ChatMessage[])` à ajouter si absent (streaming chat général pour le composer).
    - `packages/core/src/models/` — enums QuoteStatus, InvoiceStatus pour chips filtres.
    - `packages/shared/i18n/fr.ts` — à étoffer massivement : `dashboard.*`, `filters.*`, `composer.*`, `shortcuts.*`.

## Livrables

### 1. Dashboard plein écran — `apps/desktop/src/routes/dashboard.tsx` (refonte)

Remplacer le layout 3-cards actuel (H3) par un dashboard plein écran (route `/`).

Layout grid Brutal 2 colonnes (desktop 1280px+) / 1 colonne (< 1024px) :

#### KPIs top (4 cards horizontales, row supérieure)
- Card 1 : **CA émis ce mois** (euros, JetBrains Mono, grand chiffre en haut + label en bas + sparkline 30j).
- Card 2 : **CA encaissé ce mois** (idem + sparkline paiements).
- Card 3 : **Devis en attente signature** (count + somme TTC).
- Card 4 : **Factures impayées retard** (count + somme TTC + chevron rouge).

Chaque Card : bordure 2.5px + shadow 3px 3px 0 #000. Hover : inversion. Clic → navigate vers liste filtrée correspondante.

Queries à composer (via `@fakt/db/queries/` existantes) :
- `listQuotes({ status: 'sent', workspaceId })` + sum.
- `listInvoices({ status IN ('sent'), dueBefore: today, workspaceId })` + sum.
- `listInvoices({ status: 'paid', paidAtMonth: currentMonth, workspaceId })` + sum.
- `listInvoices({ status IN ('sent', 'paid'), issuedAtMonth: currentMonth, workspaceId })` + sum.

Sparklines via `@fakt/ui/Sparkline` (livré Track A W1). Si non présent, créer une primitive minimaliste svg (30 points, path ligne + fill Jaune `#FFFF00`, bordure 1.5px).

#### Pipeline horizontal (row milieu)
- Stages : `Draft → Sent → Signed → Invoiced → Paid`.
- Chaque stage = Card Brutal avec count. Flèches entre stages.
- Clic sur stage → navigate vers liste filtrée par status.

#### Activity feed vertical (colonne gauche sous KPIs)
- Last 20 events triés `updated_at DESC`.
- Types : `quote_created`, `quote_sent`, `quote_signed`, `invoice_created`, `invoice_sent`, `payment_received`.
- Rendu Card compacte avec icône + label + timestamp relatif + lien vers doc.
- Consomme queries agrégées (créer helper `getRecentActivity(workspaceId, limit)` dans `packages/db/src/queries/activity.ts` si absent — petit helper qui UNION quotes + invoices + signature_events triés).

#### Suggestions IA (colonne droite, optional nice-to-have)
- Card "Relances recommandées" : liste factures `status = 'sent' AND overdue > 7 days`. Bouton inline "Rédiger relance" → ouvre Composer sidebar avec contexte injecté.
- Si aucune facture en retard : Card vide avec message "Aucune relance nécessaire 🎉" (noter : pas d'emoji si CLAUDE.md l'interdit pour code — vérifier, sinon remplacer par icône SVG).

#### Performance NFR-001 : < 2s
- Avec 100 quotes + 100 invoices fixtures, le dashboard doit charger en < 2s.
- Optimisations : queries parallèles (Promise.all), mémorisation computed values (useMemo), pas de re-render inutile, virtualized activity feed si > 50 events.

### 2. Filtres puissants listes — `apps/desktop/src/routes/quotes/List.tsx` + `invoices/List.tsx`

Enrichir les listes existantes (livrées H1/H2) avec :

- **Chips multi-select status** : `draft | sent | signed | invoiced | paid | overdue` (overdue = computed côté UI). Click toggle select/deselect. Brutal : chip sélectionné = fond jaune #FFFF00 + bordure noire, non-sélectionné = fond papier + bordure noire 1.5px.
- **Combobox client** : autocomplete sur nom client (consomme `clients.search(q)`).
- **Date range picker** : 2 Inputs date (from / to) sur `issued_at` (ou `created_at` pour devis).
- **Text search** : Input global qui filtre numéro + notes.

**Persistance URL params (deep linking) :**
- Chaque filtre se reflète dans l'URL query : `?status=sent,signed&client=atelier-mercier&from=2026-01-01&to=2026-04-30&q=mercier`.
- Back/forward browser restore les filtres.
- Utiliser `useSearchParams` de React Router v7 (déjà en dépendance Wave 0).

**Tri sur toutes colonnes** (déjà partiellement livré H1/H2) — vérifier que ça fonctionne : Numéro, Client, Montant, Statut, Date.

**Quick actions inline** dans les rows :
- Icône Éditer → navigate `/quotes/:id/edit`.
- Icône Signer (visible si status draft/sent) → ouvre SignatureModal (Track I). Coordonner avec Track I via contexte : **il est possible que SignatureModal soit hors scope au moment où ton commit est écrit** — dans ce cas stub-le avec `onClick` qui navigate vers `/quotes/:id` où Track I aura câblé le bouton.
- Icône Dupliquer → crée un draft copie via `quotes.create({ ...originalQuote, id: undefined, number: undefined, status: 'draft' })`.

### 3. Vue détail split-pane refonte — `apps/desktop/src/routes/quotes/Detail.tsx` + `invoices/Detail.tsx`

Refonte layout actuel (simple stack) en split-pane :
- **Gauche (60% width desktop)** : PDF preview embedded via iframe blob URL (déjà livré H1/H2). Améliorer : toolbar au-dessus avec [Zoom +/-, Fit width, Full screen].
- **Droite (40% width)** : panneau infos + actions + timeline audit (Track I livre AuditTimeline — consommer si livré, sinon stub).
  - Section Meta : numéro, client (lien), dates, StatusPill.
  - Section Actions : [Éditer (si draft), Télécharger PDF, Envoyer (stub Track K), Signer (Track I), Dupliquer].
  - Section Timeline : `<AuditTimeline docType={'quote'|'invoice'} docId={id} />` si Track I mergé, sinon mini-timeline stub (livré H3).

Responsive : sur < 1024px, stack vertical (PDF top, infos bottom).

### 4. Composer IA sidebar persistent — `apps/desktop/src/components/composer-sidebar/`

Composant global monté dans Shell (`apps/desktop/src/Shell.tsx`), persistant pendant toute la session.

Structure :
- **Bouton toggle dans topbar** : icône "Claude" ou texte "IA" avec shortcut hint `⌘/`. Click ou raccourci toggle la sidebar.
- **Sidebar drawer** qui slide depuis la droite (width 400px desktop, 100% mobile). Bordure gauche 2.5px noir, pas de radius, shadow 5px 5px 0 #000 quand visible.
- **Header sidebar** : titre "Composer IA" + icône close + icône "reset session".
- **Chat history area** (scroll area) :
  - Messages utilisateur (aligné droite, fond jaune #FFFF00, bordure noir 1.5px).
  - Messages assistant (aligné gauche, fond papier #F5F5F0, bordure noir 1.5px).
  - Streaming : chaque delta rend le partial message (update DOM en temps réel).
  - Timestamp relatif sous chaque message.
- **Contexte auto injecté** : si l'utilisateur est sur une route `/quotes/:id` ou `/invoices/:id`, injecter automatiquement dans le prompt système : `Contexte actuel : {doc_type} {number} pour {client}, montant {amount}, status {status}.`. Afficher visuellement dans la sidebar "📎 Contexte : D2026-001" (ou équivalent non-emoji) avec toggle pour désactiver.
- **Input area** (bas sidebar) : textarea multiline (expand auto-grow) + bouton send. Shortcut `Enter` = send (shift+enter = newline).
- **Session reset** : bouton "Nouvelle conversation" efface l'historique (**pas de persistance disque v0.1**, on reset sur refresh page — acte dans `docs/sprint-notes/track-j-composer.md`).
- **Cas d'usage primaires** (templates rapides via suggestions en chip au-dessus de l'input) :
  - "Rédige une relance pour cette facture"
  - "Ajoute 2 jours de dev sur ce devis"
  - "Résume l'activité cette semaine"

Backend :
- Ajouter dans `packages/ai/src/provider.ts` : `chat(messages: ChatMessage[], context?: DocContext): AsyncIterable<AiStreamEvent<string>>`.
- Implémentation dans `providers/claude-cli.ts` via Tauri command `spawn_claude` avec nouveau prompt template `packages/ai/prompts/chat.md` (système prompt pour FAKT assistant comptable).
- MockAiProvider retourne fixtures déterministes pour tests.

Performance :
- Streaming temps réel (pas de batching).
- AbortController pour annuler un stream en cours si user ferme sidebar ou envoie nouveau message.

### 5. Raccourcis clavier globaux — `apps/desktop/src/shortcuts.ts`

Enregistrer au mount App :
- `⌘K` (macOS) / `Ctrl+K` (Win/Linux) : ouvre CommandPalette (déjà câblé Track G — vérifier + enrichir).
- `⌘N` : ouvre menu "Nouveau devis" sur `/quotes/new`.
- `⌘⇧N` : ouvre menu "Nouvelle facture" sur `/invoices/new`.
- `⌘/` : toggle Composer IA sidebar.

Afficher un overlay d'aide raccourcis quand `?` pressé (ou bouton `?` en topbar).

Utiliser `react-hotkeys-hook` (lib légère, à ajouter si pas présente — vérifier `package.json`, ajouter dans le même commit si absent).

### 6. Intégration App.tsx + Shell.tsx

- Shell.tsx : monter ComposerSidebar + bouton toggle topbar + mount global shortcuts.
- App.tsx : route `/` pointe vers Dashboard refait.

## Règles critiques

- **Zéro radius, bordures 2.5px, shadows plates, hover inversion** — Brutal Invoice strict.
- **TypeScript strict** — `any` interdit.
- **Tous composants via `@fakt/ui`** — pas de réimplémentation. Si primitive manquante (drawer/sidebar sliding, sparkline, date range picker), l'ajouter dans `packages/ui/` dans le même commit.
- **URL persist filtres** non-négociable (FR-024 AC).
- **Composer streaming temps réel** — pas de "tout ou rien". Cancel opérationnel.
- **i18n FR strict** — aucune string anglaise. Étoffer `packages/shared/i18n/fr.ts`.
- **Pas de persistance session composer disque v0.1** (documenter le choix strict, non-négociable).
- **Performance NFR-001** : dashboard < 2s avec 100+100 fixtures. Command palette < 100ms.
- **Pas de README** dans sous-dossiers.
- **Pas de commentaires évidents**.

## Tests

- Vitest unit : computed overdue, agrégations dashboard (sum, count, parMonth), formatters FR (format EUR, dates).
- `@testing-library/react` : Dashboard (render KPIs + sparklines + activity), Filters (chips multi-select, URL sync), ComposerSidebar (send message, stream render, reset).
- Integration tests : filtres persist URL → refresh page → filtres restaurés.
- Mock `AiProvider.chat` via MockAiProvider (fixtures de conversation).
- Coverage Vitest ≥ 70% sur `apps/desktop/src/routes/dashboard.tsx`, `/components/composer-sidebar/`, `/shortcuts.ts`, patchs filtres listes.

## DoD Track J

- [ ] Dashboard plein écran avec 4 KPIs + pipeline + activity + suggestions IA.
- [ ] Dashboard < 2s avec 100+100 fixtures (mesurer `performance.now()` ou React DevTools profiler).
- [ ] Filtres listes devis + factures (chips status, client combobox, date range, text search).
- [ ] Filtres persistent en URL query + deep linking fonctionnel.
- [ ] Vue détail split-pane devis + facture avec PDF preview toolbar + actions + timeline.
- [ ] Composer IA sidebar toggle ⌘/, streaming temps réel, contexte auto injecté, session reset.
- [ ] Raccourcis clavier ⌘K / ⌘N / ⌘⇧N / ⌘/ enregistrés + overlay aide `?`.
- [ ] `AiProvider.chat` implémenté + prompt template + MockAiProvider.
- [ ] `bun run typecheck` et `bun run test` passent **global** (10/10 packages sur repo principal).
- [ ] Coverage ≥ 70% sur scope J.
- [ ] i18n FR strict.
- [ ] Conformité Brutal Invoice : 0 radius, 2.5px borders, shadows plates, hover inversion — validation visuelle manuelle par Tom requise.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-j): dashboard avancé + filtres listes + composer sidebar + raccourcis`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-j): dashboard avancé + filtres listes + composer sidebar + raccourcis

  - Dashboard plein écran : 4 KPIs + pipeline + activity + suggestions IA
  - Filtres listes devis+facture (chips status / client / date range / text)
  - Filtres persist URL query + deep linking
  - Vue détail split-pane (PDF preview + actions + timeline)
  - Composer IA sidebar persistent : toggle ⌘/, streaming, contexte auto
  - Raccourcis globaux : ⌘K palette, ⌘N devis, ⌘⇧N facture, ⌘/ composer, ? aide
  - AiProvider.chat + prompt template chat.md
  - i18n FR dashboard.* / filters.* / composer.* / shortcuts.*
  - Tests Vitest ≥ 70% coverage

  Stories: US-025, US-026, US-027, US-028
  FRs: FR-023, FR-024, FR-025
  Wave: 3 · Track: J · Points: 21
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent global 10/10 packages sur main.
- **`git add` avec chemins explicites uniquement** (voir règle haut du document). Stage : `apps/desktop/src/routes/dashboard.tsx`, `apps/desktop/src/routes/quotes/List.tsx`, `apps/desktop/src/routes/quotes/Detail.tsx`, `apps/desktop/src/routes/invoices/List.tsx`, `apps/desktop/src/routes/invoices/Detail.tsx`, `apps/desktop/src/components/composer-sidebar/`, `apps/desktop/src/shortcuts.ts`, `apps/desktop/src/Shell.tsx`, `apps/desktop/src/App.tsx`, `packages/ai/src/provider.ts`, `packages/ai/src/providers/claude-cli.ts`, `packages/ai/src/providers/mock.ts`, `packages/ai/prompts/chat.md`, `packages/ui/` (primitives ajoutées), `packages/db/src/queries/activity.ts` (si ajouté), `packages/shared/i18n/fr.ts`.
- **Commit sur `main`** (voir règle git en haut du document). **Ne pas push.**

## Rapport final (< 400 mots, français)

- Livrables : checklist des 6 blocs (Dashboard refonte, Filtres, Detail split-pane, Composer, Raccourcis, AiProvider.chat).
- DoD : 12 gates OK/KO.
- Commit : hash sur main.
- Performance benchmark dashboard (temps chargement avec 100+100 fixtures).
- Dépendances ajoutées au package.json (si react-hotkeys-hook etc.) + taille impact bundle.
- Dettes identifiées : persistance session composer disque (v0.2), virtualized activity feed si > 1000 events (v0.2), dark mode jamais.
- Risques conso Track K Wave 4 : composer doit-il générer .eml directement ou déléguer ? Documenter.
- Choix de style cursive pour onglet "Taper nom" — coord avec Track I si impact.
```

---

## Stratégie fin de Wave 3 — milestone BETA (J+17 cible, 2026-05-08)

Fin de Wave 3 = **milestone BETA**. À la fin des 2 commits (I + J) sur main :

1. Tom (ou Claude orchestrateur) lit les 2 rapports d'agents + inspecte les commits.
2. `bun install && bun run typecheck && bun run test` **global** (tous packages + apps/desktop) → 10/10 + nouveaux tests.
3. Tom lance `bun run dev` + fait un tour complet manuel du flow BETA :
   - Onboarding → ajout client → ajout prestation → création devis manuel → **signer devis** (nouveau Track I) → PDF signé téléchargé → **ouvrir PDF dans Adobe Reader** pour valider signature verte + TSA timestamp visible.
   - Création facture from quote → **signer facture** → PDF signé.
   - Vérifier timeline audit trail cohérente (chaîne SHA-256).
   - Tester Dashboard KPIs avec données réelles (10+ devis + 10+ factures).
   - Tester filtres listes + URL persistance (refresh page).
   - Tester Composer IA sidebar : rédiger relance facture en retard.
   - Tester raccourcis clavier ⌘K / ⌘N / ⌘⇧N / ⌘/.
4. Si tout marche : tag `beta-done` sur main, update `docs/sprint-status.yaml` :
   - `waves[wave 3].status = "completed"` + `completed_at`.
   - `milestones[beta].status = "completed"` + `completed_at`.
   - `current_wave = 4`, `current_milestone = "v0.1.0"`.
5. **Tom utilise FAKT pour ses signatures professionnelles** → différenciation vs skills Claude Code validée.
6. Lancer Wave 4 : Track K (Email + Archive) + Track L (CI + Release + code-signing + landing) en parallèle. **Prérequis Track L : Windows OV cert + Apple Dev Program commandés J+1.**

---

## Escalade

- Si Track I bloque sur validation Adobe Reader (signature rouge / invalide) → escalade immédiate à Tom. Root cause analysis obligatoire : hash `/ByteRange` drift, CMS SignedData mal formé, cert non conforme. Fallback : crate `cms` alternative ou P/Invoke OpenSSL.
- Si Track J bloque sur performance dashboard > 2s → décomposer queries, virtualiser lists, noter dette pour optimisation Wave 4 si non critique.
- Si les 2 tracks entrent en conflit merge (ex: patch simultané sur `quotes/Detail.tsx`) → git gère le lock, l'un attend l'autre. Si conflit réel : rebase manuel par Tom avec preference au commit le plus complet.
- Si commit `wip(track-X): ...` nécessaire (blocker majeur à mi-chemin) : ajouter note dans body + créer `docs/sprint-notes/track-<id>-<date>.md` avec détails.

---

## Rappel actions externes (hors scope code, bloquantes pour Wave 4)

Ces actions doivent être lancées par Tom **au plus tard J+1** pour avoir les certs à temps pour Track L (Wave 4 release signée). Aucune ne bloque Wave 3 :

- **Windows OV Code Signing cert** (Sectigo / DigiCert / GoGetSSL, ~200€/an, délai 3-7j ouvrés). **Deadline commande : 2026-04-22.**
- **Apple Developer Program** (99 USD/an, instant après paiement). **Deadline signup : 2026-04-22.**
- **Validation manuelle Adobe Reader Track D W1** : Tom doit ouvrir `apps/desktop/src-tauri/tests/output/signed_pades_b_t_freetsa.pdf` dans Acrobat Reader et vérifier signature verte + timestamp TSA visible. **Sans cette validation, Track I partira sur une base non confirmée** — rattraper dès que possible (peut se faire en parallèle du développement Wave 3, mais avant BETA tag).
