# Sprint Briefs — Wave 4 · FAKT v0.1.0 Release

**Date :** 2026-04-22
**Contexte :** Wave 3 terminée et pushée sur `origin/main` (HEAD `4881ba2`). Milestones **ALPHA et BETA atteints à J+0** (targets respectivement J+10 et J+17, x200 d'avance sur le planning initial). Les 2 briefs ci-dessous ciblent la **Wave 4 — Email + Archive + CI + Release + Code-signing + Landing + Docs**. Fin de Wave 4 = **milestone v0.1.0 PUBLIC** (target J+21 = 2026-05-12, hard deadline).
**Stratégie :** 2 agents simultanés max (K + L en parallèle batch unique). Référence maître : `docs/sprint-plan.md` section "Wave 4 — Release (J17-J21)".

---

## Règles de lancement

1. **Batch unique (K + L)** lancé en parallèle dans un seul message (2 `Agent()` tool calls). `parallel_agents_max: 2` dans sprint-status.
2. **Prérequis main** : `bun run typecheck && bun run test` passent sur HEAD `4881ba2` (10/10 packages · 212 tests ✓ validation Wave 3 BETA).
3. **Model mix :**
   - **Sonnet** : Track K — Email + Archive (patterns connus : RFC 5322 builder, ZIP archive, shell commands OS-spécifiques).
   - **Sonnet** : Track L — CI/CD + landing + docs (DevOps classique + static site + README, pas de crypto ni IA complexe).
4. **Isolation `worktree` conseillée** pour concurrence, mais **chaque agent commit DIRECTEMENT sur `main`** (voir règle git ci-dessous).

## ⚠️ Règle git — commit sur main (confirmée Waves 1 + 2 + 3)

> **Chaque agent commit son travail atomique DIRECTEMENT sur la branche `main` du repo principal.**
> - Peu importe si l'agent tourne dans un worktree isolé ou non.
> - Depuis un worktree : écrire les fichiers livrés dans le **repo main** (`C:\Users\andri\IdeaProjects\AlphaLuppi\facture-devis\`) via chemins absolus, puis `git -C <main_repo> add <files> && git -C <main_repo> commit -s -m "..."` **en ciblant main**. Le worktree peut rester vide ou servir uniquement de sandbox exploratoire.
> - Depuis main (sans worktree) : directement `git add` + `git commit -s` sur main.
> - **Ne JAMAIS push.** Tom push lui-même a posteriori après review.
> - Message de commit et body : suivre le template de chaque track (`feat(track-x): ...` + DCO).
> - Si deux agents commit en parallèle : git gère le lock, l'un attend l'autre. En cas de conflit (peu probable car tracks disjoints), l'agent retry ou escalade.

## ⚠️ Règle git — `git add` avec chemins EXPLICITES (incidents Waves 2 + 3)

> **Ne jamais utiliser `git add -A` ou `git add .` depuis un agent.**
> Toujours stager les fichiers par chemin nommé : `git add packages/email/... apps/desktop/src/routes/archive/... .github/workflows/... docs/... landing/...`
> **Pourquoi :** en batch parallèle Wave 2, l'agent G a absorbé dans son commit les fichiers onboarding/settings de l'agent F (ils partageaient la même worktree). En Wave 3, Track J a laissé Track I non-stagé sur des routes adjacentes. En Wave 4 les tracks K et L touchent des fichiers potentiellement voisins (configs repo, packages nouveaux, docs) — le risque de collision est réel.
> Stage uniquement ce que ton scope produit. Si tu vois des fichiers étrangers dans `git status`, c'est un autre agent — ne les touche pas.

## ⚠️ Avertissement sur `feature-dev:code-architect` (retour d'expérience Waves 1 + 2 + 3)

**Retour d'expérience :**
- Wave 1 (tracks A et C) : `subagent_type: "feature-dev:code-architect"` a **halluciné des plans "à créer"** au lieu d'écrire le code + de committer. Deux retries ont été nécessaires.
- Wave 2 : forcer `general-purpose` sur F/G/H1/H2/H3 → **zéro retry nécessaire**. Résultat net.
- Wave 3 : forcer `general-purpose` sur I/J → **zéro retry** également. 34 pts livrés en 35 min.

**Règle Wave 4 :** pour **tout livrable code réel** (K et L), utiliser obligatoirement `subagent_type: "general-purpose"`. Le sprint-plan mentionne `general-purpose` pour ces tracks — **confirmer** cette recommandation. Ne jamais basculer sur `feature-dev:code-architect` même pour la partie planning CI/release.

Réserver `feature-dev:code-architect` uniquement aux tâches explicitement de **planning / architecture sans code à commiter**.

## Signature `Agent()` commune

```ts
Agent({
  subagent_type: "general-purpose",   // JAMAIS feature-dev:code-architect
  model: "sonnet",                    // K et L : patterns connus, pas de crypto/IA complexe
  isolation: "worktree",
  name: "w4-track-<id>",
  description: "<short>",
  prompt: "<voir brief ci-dessous>"
})
```

---

## État des blocks externes (confirmé Tom 2026-04-22)

Ces décisions impactent directement le scope Track L :

| Block | État | Impact Track L |
|---|---|---|
| **Windows OV Code Signing cert** | **SKIP pour v0.1.0** | `.msi` non signé (SmartScreen warning accepté). Signature Windows en v0.1.1 post-release. Track L documente l'état + crée une issue GitHub post-release. |
| **Apple Developer Program** | **Tom souscrit 2026-04-22** | Track L scaffolde `release.yml` avec `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_PASSWORD` comme secrets GitHub Actions (valeurs placeholder) → Tom plugue à réception. Workflow fonctionne dès que les secrets sont fournis. |
| **Adobe Reader validation PDF signé** | **Tom valide 2026-04-22** | Non bloquant Wave 4. Agent K n'a pas besoin de cette validation pour livrer. Rappel en fin de rapport L pour pre-release check. |
| **Push origin/main (4 commits en avance)** | **Déjà pushé** `9ad35ba..4881ba2` | Wave 4 démarre sur base propre. CI Track L peut être déclenchée sur PR/tag dès configuration. |

**Scope Track L ajusté** : installers non-signés Windows + placeholder notarize macOS. Tout le reste (CI, landing, docs, release notes, messages launch) intégralement dans le scope.

---

## Track K — Email + Archive (8 pts)

**Agent type :** `general-purpose` (pas code-architect)
**Model :** `sonnet`
**Name :** `w4-track-k-email-archive`
**Description :** Email .eml multi-OS + Archive ZIP workspace + compliance 10y
**Stories :** US-021, US-022, US-023, US-024 · **FRs :** FR-019, FR-020, FR-021, FR-022

### Prompt

```
Tu construis le **Track K — Email + Archive** pour FAKT. C'est la dernière couche fonctionnelle avant la release publique v0.1.0 : brouillon email .eml multi-OS avec PDF en pièce jointe + export ZIP du workspace pour compliance archivage 10 ans.

Wave 3 BETA est livrée et pushée sur origin/main (HEAD 4881ba2). Tu consommes toutes les couches précédentes : packages/ui (primitives Brutal), packages/db (queries clients/prestations/quotes/invoices/signatures), packages/core (formatters FR), packages/ai (optional — composer peut générer body email via chat), packages/pdf (renderPdf), routes Detail devis+facture. Tu tournes dans un worktree isolé depuis main.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles Brutal Invoice + légal FR (**FR-022 archivage 10 ans bloquant légal**, pas de hard delete sur invoices issued).
2. `docs/sprint-plan.md` section **"Track K — Email + Archive"** — livrables + DoD.
3. `docs/prd.md` sections **FR-019** (brouillon .eml avec attachment PDF base64), **FR-020** (bibliothèque templates), **FR-021** (export PDF individuel + ZIP workspace), **FR-022** (compliance archivage 10 ans) — AC précis.
4. `docs/architecture.md` sections 4 (structure monorepo — `packages/email/` déjà prévu dans l'arbo cible), 5 (table `invoices.archivedAt` + `backups`), le handler OS dispatch (`xdg-open` / `open` / `start`).
5. `apps/desktop/src/routes/quotes/Detail.tsx` + `invoices/Detail.tsx` — points d'injection du bouton "Préparer email" (actuellement stubé par Track I comme "Envoyer" dans la section Actions du split-pane J).
6. `packages/ui/` — Modal, Button, Input, Textarea, Select (Tabs si absent — vérifier), StatusPill.
7. `packages/shared/i18n/fr.ts` — à étoffer avec clés `email.*`, `archive.*`, `templates.*`.
8. `packages/core/src/models/` — DTOs Quote, Invoice, Client (pour mapping template placeholders).

## Livrables

### 1. Package `packages/email/` — Générateur RFC 5322

Créer un nouveau package Bun workspace :

- `packages/email/package.json` : nom `@fakt/email`, version `0.1.0`, deps `zod` + `@fakt/core` + `@fakt/shared`.
- `packages/email/tsconfig.json` : extends `@fakt/tsconfig/base.json` strict.
- `packages/email/src/index.ts` : barrel exports.
- `packages/email/src/eml-builder.ts` :
  - `buildEml(opts: EmlOptions): string` avec typage strict.
  - `EmlOptions` : `{ from: string; to: string; subject: string; bodyPlain: string; bodyHtml?: string; attachments?: EmlAttachment[] }`.
  - `EmlAttachment` : `{ filename: string; contentType: string; contentBase64: string }`.
  - Produit un `.eml` RFC 5322 compliant : headers `From` + `To` + `Subject` + `Date` (RFC 2822 format) + `MIME-Version: 1.0` + `Content-Type: multipart/mixed; boundary=...` + `Content-Transfer-Encoding: 7bit/base64`.
  - Encodage MIME word `=?utf-8?B?<base64>?=` pour Subject + From si chars non-ASCII.
  - Attachments : base64 wrap 76 chars/ligne, `Content-Disposition: attachment; filename="..."`, `Content-Type: application/pdf`.
  - Boundaries aléatoires stables (seedable pour tests).
- `packages/email/src/templates/index.ts` : enum `EmailTemplateKey = 'quote_sent' | 'invoice_sent' | 'reminder' | 'thanks'`.
- `packages/email/src/templates/quote_sent.ts` + `invoice_sent.ts` + `reminder.ts` + `thanks.ts` :
  - Chaque template exporte `{ subject(ctx): string; bodyPlain(ctx): string; bodyHtml?(ctx): string }`.
  - Placeholders substitués via helpers FR depuis `@fakt/core` : `{{client_name}}`, `{{doc_num}}`, `{{amount_ttc}}`, `{{amount_ttc_eur}}`, `{{due_date_fr}}`, `{{workspace_name}}`.
  - Ton français professionnel, tutoiement si client connu personnel sinon vouvoiement (défaut vouvoiement).
  - Corps plain + HTML léger (pas de CSS sophistiqué, lisible brut).
- `packages/email/src/renderer.ts` : `renderTemplate(key, context): { subject; bodyPlain; bodyHtml }`.
- `packages/email/src/mailto-fallback.ts` : `buildMailtoUrl({ to, subject, body }): string` RFC 6068 encodage. Pas d'attachment (limite mailto).
- Tests Vitest `packages/email/src/__tests__/eml-builder.test.ts` : snapshot RFC 5322 avec attachment PDF mock, parse back via lib type `emailjs-mime-parser` en devDep OU assertions regex sur headers obligatoires. Tests mailto : encodage URL spéciaux (espaces, accents, caractères réservés).
- Tests templates : fixtures context Quote + Invoice → assertions placeholders substitués correctement.
- Coverage ≥ 80% sur `packages/email/`.

### 2. Tauri command Rust `open_email_draft`

Nouveau fichier `apps/desktop/src-tauri/src/commands/email.rs` :

```rust
#[tauri::command]
pub async fn open_email_draft(eml_path: String) -> Result<(), String> {
    // Valider chemin existe + extension .eml
    // Dispatch OS :
    // - cfg!(target_os = "windows") → Command::new("cmd").args(&["/C", "start", "", eml_path])
    // - cfg!(target_os = "macos")   → Command::new("open").arg(eml_path)
    // - cfg!(target_os = "linux")   → Command::new("xdg-open").arg(eml_path)
    // Spawn détaché (on n'attend pas le close), return Ok(())
    // En cas d'erreur spawn : return Err("no handler")
}

#[tauri::command]
pub async fn open_mailto_fallback(url: String) -> Result<(), String> {
    // Même dispatch OS avec l'URL mailto: au lieu du chemin .eml
}
```

Register dans `apps/desktop/src-tauri/src/lib.rs` (ou main.rs selon structure actuelle). Respect CLAUDE.md : pas de README dans sous-dossiers.

### 3. Modal `PrepareEmailModal` — `apps/desktop/src/components/prepare-email-modal/`

Déclenché depuis vue détail devis + facture via bouton "Préparer email". Visible si :
- Devis : `status IN ('sent', 'signed')`.
- Facture : `status IN ('sent', 'paid', 'overdue')`. **La facture peut avoir un email préparé même non signée** (compliance : l'email est un envoi manuel, pas une signature).

Structure :
- Modal fullscreen Brutal (bordure 2.5px, shadow 5px 5px 0 #000, zéro radius).
- Header : "Préparer email — D2026-XXX / F2026-XXX — {{client_name}}".
- Body :
  - **Dropdown "Choisir template"** : 4 options (Envoi devis / Envoi facture / Relance retard / Remerciement paiement). Défaut selon type doc + status :
    - Devis sent → "Envoi devis"
    - Devis signed → "Envoi devis"
    - Facture sent → "Envoi facture"
    - Facture overdue → "Relance retard"
    - Facture paid → "Remerciement paiement"
  - **Input `To`** : pré-rempli avec `client.email` (si absent, warning "Client sans email, éditez avant envoi").
  - **Input `Subject`** : pré-rempli par template + placeholders substitués, éditable.
  - **Textarea `Body`** : affichage plain text du template + placeholders substitués, éditable (plain uniquement en v0.1, HTML généré silencieusement côté build-eml).
  - **Info "Pièce jointe"** : preview du PDF attaché (icône + nom fichier `D2026-001.pdf` + taille KB). Si devis/facture signé, attacher le PDF signé (depuis `signed_documents` table livré Track I). Sinon attacher le PDF rendu à la volée via `renderPdf(dto)`.
  - **Checkbox "Utiliser mailto: au lieu de .eml"** (fallback avancé, désactivé par défaut) : si coché, pas d'attachment et URL mailto encodée.
- Footer :
  - Bouton "Ouvrir dans l'application mail" (primary Brutal) → génère .eml dans temp dir + `invoke('open_email_draft', { emlPath })`.
  - Bouton "Annuler" (secondary).

Action "Ouvrir dans l'application mail" :
1. UI : state loading "Génération du brouillon…".
2. Rendu du PDF attachment (si signed : fetch depuis `signed_documents`, sinon `renderPdf(dto)`).
3. Build .eml via `@fakt/email` `buildEml({ ... attachments: [{ filename, contentType: 'application/pdf', contentBase64 }] })`.
4. Save dans `~/.fakt/tmp/drafts/<uuid>.eml` via Tauri command helper (si non dispo, utiliser `writeTextFile` Tauri plugin-fs).
5. Appel `invoke('open_email_draft', { emlPath })`.
6. Si erreur (no handler OS) : fallback automatique `invoke('open_mailto_fallback', { url: buildMailtoUrl(...) })` + toast "Pièce jointe non supportée en mode fallback, PDF à attacher manuellement".
7. Toast succès "Brouillon ouvert dans votre application mail" + close modal.
8. Update `activity` table (via `packages/db/src/queries/activity.ts`) avec event `email_drafted` (utile pour dashboard Track J).

Erreur handling :
- Catch Tauri errors (spawn failed, path invalid, PDF render fail).
- Afficher modal d'erreur Brutal avec message + "Réessayer" / "Annuler".

### 4. Intégration côté Detail devis + facture

Patch dans :
- `apps/desktop/src/routes/quotes/Detail.tsx` : remplacer le stub "Envoyer" / "Préparer email" par un vrai bouton qui ouvre `PrepareEmailModal`.
- `apps/desktop/src/routes/invoices/Detail.tsx` : idem.

Le bouton "Préparer email" doit être présent dans la section Actions de la vue détail split-pane (Track J). Coordination : si le split-pane a déjà un bouton "Envoyer" en stub, le remplacer. Sinon l'ajouter.

### 5. Route `/archive` — Export ZIP workspace

Nouvelle route `apps/desktop/src/routes/archive/index.tsx` :

Liste tous les documents archivés (devis + factures) + widget export :
- **Header** : titre "Archive — Compliance 10 ans" + badge info "Article 289 CGI".
- **Stats row** : count devis émis / count factures émises / volume cumulé GB estimé (fictif pour v0.1, basé sur count × 50KB moyenne).
- **Button CTA "Exporter workspace (ZIP)"** (primary Brutal large) → déclenche l'export.
- **Table compacte** en dessous : les derniers documents archivés (réutilisation composant Table + StatusPill).

Action "Exporter workspace" :
1. UI : modal de confirmation "L'export va générer un fichier ZIP contenant : clients.csv, prestations.csv, tous les devis et factures en PDF, un README de compliance. Continuer ?".
2. Click confirm → `invoke('export_workspace_zip')` (Tauri command Rust à ajouter).
3. Tauri dialog save (via `tauri-plugin-dialog`) → user choisit le chemin destination.
4. Progress bar Brutal pendant l'export (itération sur quotes+invoices, render PDFs, zip write).
5. Toast succès avec chemin fichier créé.

Tauri command Rust `export_workspace_zip` dans `apps/desktop/src-tauri/src/commands/backup.rs` (ou `archive.rs` nouveau) :
- Input : workspace_id (depuis state store).
- Process :
  1. Query clients + services + quotes (with items) + invoices (with items) via rusqlite.
  2. Génère `clients.csv` (colonnes : id, nom, contact, email, siret, adresse).
  3. Génère `prestations.csv` (id, nom, unité, prix_ttc_cents, catégorie).
  4. Pour chaque quote : appeler le renderer PDF (Typst CLI subprocess ou appel TS via event — plus simple : le TS génère les PDFs via `renderPdf` en boucle puis passe les bytes au Rust via un tempdir).
  5. Même chose pour invoices.
  6. Génère `README.txt` avec contenu compliance (voir section 6 ci-dessous).
  7. Crée le ZIP via crate `zip` (0.6+) structure :
     ```
     fakt-workspace-{yyyy-mm-dd-hhmmss}.zip
     ├── clients.csv
     ├── prestations.csv
     ├── quotes/
     │   ├── D2026-001.pdf
     │   └── ...
     ├── invoices/
     │   ├── F2026-001.pdf
     │   └── ...
     └── README.txt
     ```
  8. Return chemin absolu du ZIP créé.
- Insert entry dans table `backups` (path, sizeBytes, createdAt) pour historique.

**Choix d'implémentation CSV/ZIP** : si le rendering PDF via Rust subprocess Typst est trop complexe à orchestrer dans le temps imparti, implémentation **alternative hybride acceptable** :
- Le JS côté `/archive` itère sur les docs, appelle `renderPdf` pour chacun, stocke les `Uint8Array` en mémoire.
- Appelle `invoke('build_workspace_zip', { csvClients, csvPrestations, pdfs: [{name, bytes}], readme })` qui crée le ZIP côté Rust avec `zip` crate.
- Docup `README.txt` généré côté JS avec template string.

Choisir l'approche hybride si elle est plus simple et documenter dans le body commit.

### 6. README compliance 10 ans — template

Contenu du `README.txt` dans le ZIP (français, ASCII-safe pour compatibilité cross-OS) :

```
FAKT — Archive workspace
=========================

Date export : {{iso_date}}
Workspace   : {{workspace_name}} (SIRET {{siret}})

Contenu
-------
- clients.csv       : liste des clients actifs et archivés
- prestations.csv   : bibliothèque de prestations
- quotes/           : tous les devis émis (PDF)
- invoices/         : toutes les factures émises (PDF)

Conformité légale
-----------------
Les factures émises doivent être conservées pendant 10 ans
(article L123-22 du Code de Commerce + article 286 du CGI).
Les devis ne sont pas soumis à cette obligation mais sont
inclus dans l'archive pour traçabilité commerciale.

La suppression d'une facture émise est interdite par FAKT
(contrainte DB et UI). Seul l'archivage soft (champ `archived_at`)
est autorisé, le document reste consultable en lecture.

Pour restaurer ou vérifier l'intégrité d'une signature PAdES,
ouvrir le PDF correspondant dans Adobe Reader ou équivalent.

FAKT v0.1.0 — AlphaLuppi — https://fakt.alphaluppi.com
```

### 7. Enforce no-hard-delete sur invoices issued (compliance FR-022)

Vérifier que les protections sont en place (déjà livrées W0 triggers DB + H2 UI guards) :
- Dans `apps/desktop/src/routes/invoices/Detail.tsx` : action "Supprimer" visible uniquement si `status === 'draft'`.
- Dans `packages/db/src/queries/invoices.ts` : fonction `delete(id)` refuse si status != 'draft' (throw Error typé).
- Trigger SQL `packages/db/migrations/0000_initial.sql` (W0) : BEFORE DELETE ON invoices WHEN status != 'draft' RAISE.
- Si une protection manque : patcher dans le commit K.

Si tout est déjà en place : rien à patcher, juste documenter dans le body commit.

### 8. Dashboard — activité email (optional mineur)

Si la table `activity` a déjà un event type `email_drafted` mappé côté Dashboard (Track J), rien à faire. Sinon, ajouter le mapping dans `apps/desktop/src/routes/dashboard.tsx` activity feed pour afficher les brouillons d'emails préparés avec icône courrier.

## Règles critiques

- **TypeScript strict** — `any` interdit, `unknown` + type guards.
- **Tous composants via `@fakt/ui`** — pas de réimplémentation.
- **i18n FR strict** — aucune string hardcodée anglaise. Étoffer `packages/shared/i18n/fr.ts` avec `email.*`, `archive.*`, `templates.*`, `compliance.*`.
- **Zod validation** sur input modal (email valide, subject non vide, body non vide, PDF présent).
- **Pas de commentaires évidents**.
- **Pas de README dans sous-dossiers** (règle CLAUDE.md).
- **Zero new deps lourdes** : privilégier helpers simples. Si besoin `emailjs-mime-parser` pour test parse-back, OK en devDep. Pour ZIP côté Rust : crate `zip` standard.
- **Performance NFR** : export ZIP 50 docs (25 devis + 25 factures) doit rester < 10s.
- **Erreurs gracieuses** : toast + retry sur spawn échoué / PDF render fail / ZIP write fail.
- **Pas de secrets** : jamais de token mail serveur en hardcode — v0.1 = client-side draft uniquement, pas d'envoi SMTP direct.

## Tests

- Vitest unit : `eml-builder` (snapshot RFC 5322 + round-trip via parser), `mailto-fallback` (encodage URL), `templates` (placeholders substitués), helpers FR (amount_ttc_eur format).
- Vitest + `@testing-library/react` : `PrepareEmailModal` (render, switch template, edit subject/body, submit mock invoke).
- Vitest integration : route `/archive` (render, click export, mock invoke success/fail).
- Cargo tests côté Rust : `open_email_draft` dispatch OS (mock Command), `export_workspace_zip` génère un ZIP valide (unzip back, assert structure).
- Coverage Vitest ≥ 70% sur `packages/email/`, `apps/desktop/src/components/prepare-email-modal/`, `apps/desktop/src/routes/archive/`.

## DoD Track K

- [ ] `packages/email/` créé et exporté via workspace.
- [ ] Modal `PrepareEmailModal` fonctionnelle avec 4 templates + dropdown + édition inline.
- [ ] `open_email_draft` Tauri command multi-OS fonctionnelle (test manuel sur host).
- [ ] Fallback `mailto:` automatique si handler absent.
- [ ] Bouton "Préparer email" sur Detail devis + facture, visible selon status.
- [ ] Route `/archive` avec export ZIP workspace (CSV clients + prestations + PDFs devis + PDFs factures + README compliance).
- [ ] Enforce no-hard-delete invoices issued (vérifié ou patché).
- [ ] `bun run typecheck` et `bun run test` passent **global** (10/10 packages sur repo principal, attendu ~230+ tests).
- [ ] Coverage ≥ 70% sur scope K.
- [ ] i18n FR : aucune string anglaise.
- [ ] Performance : export ZIP 50 docs < 10s.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-k): email draft multi-OS + archive ZIP workspace + compliance 10y`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-k): email draft multi-OS + archive ZIP workspace + compliance 10y

  - packages/email : eml-builder RFC 5322 + 4 templates FR + mailto fallback
  - Tauri commands open_email_draft + open_mailto_fallback (xdg-open/open/start)
  - PrepareEmailModal : dropdown template + édition subject/body + PDF attaché
  - Bouton "Préparer email" sur Detail devis+facture (status-aware visibility)
  - Route /archive : export ZIP workspace (clients.csv + prestations.csv + PDFs + README)
  - Tauri command export_workspace_zip (crate zip)
  - README.txt compliance 10 ans Art. L123-22 + Art. 286 CGI
  - No-hard-delete invoices issued confirmé (DB trigger + UI guards)
  - i18n FR email.* / archive.* / templates.* / compliance.*
  - Tests Vitest + Cargo ≥ 70% coverage

  Stories: US-021, US-022, US-023, US-024
  FRs: FR-019, FR-020, FR-021, FR-022
  Wave: 4 · Track: K · Points: 8
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent global 10/10 packages sur main.
- **`git add` avec chemins explicites uniquement**. Stage : `packages/email/`, `apps/desktop/src/components/prepare-email-modal/`, `apps/desktop/src/routes/archive/`, `apps/desktop/src/routes/quotes/Detail.tsx`, `apps/desktop/src/routes/invoices/Detail.tsx`, `apps/desktop/src-tauri/src/commands/email.rs`, `apps/desktop/src-tauri/src/commands/backup.rs` (ou archive.rs si nouveau), `apps/desktop/src-tauri/src/lib.rs` (register commands), `apps/desktop/src-tauri/Cargo.toml` (si ajout crate zip), `packages/shared/i18n/fr.ts`, `package.json` racine (si nouveau workspace email ajouté), `tsconfig.base.json` (si path mapping à ajouter).
- **Commit sur `main`** (voir règle git en haut du document). **Ne pas push.**

## Rapport final (< 400 mots, français)

- Livrables : checklist des 8 blocs (packages/email, Tauri command email, PrepareEmailModal, intégration Detail, route /archive, Tauri export_workspace_zip, README compliance, enforce no-delete).
- DoD : 11 gates OK/KO.
- Commit : hash sur main.
- Choix d'implémentation ZIP (hybride JS+Rust ou tout-Rust) + justification.
- Choix lib test parse-back .eml (si utilisée, laquelle + taille devDep).
- Dépendances ajoutées (crate zip Rust côté Tauri, éventuelle lib parser TS côté tests).
- Dettes identifiées : envoi SMTP direct v0.2, signature DKIM v0.2, multi-language templates v0.2, pixel tracking open-rate v0.2.
- Risque conso Track L : le workflow release.yml doit-il inclure un step "test export ZIP E2E" ? Documenter si oui.
- Vérification Adobe Reader du PDF signé reste à faire par Tom (rappel).
```

---

## Track L — CI + Release + Code-signing + Docs (13 pts)

**Agent type :** `general-purpose` (pas code-architect)
**Model :** `sonnet`
**Name :** `w4-track-l-release`
**Description :** CI/CD matrix 3 OS + installers + landing + docs + release notes
**Stories :** NFR-003, NFR-010, NFR-011 + livrables release v0.1.0

### Prompt

```
Tu construis le **Track L — CI + Release + Code-signing + Landing + Docs** pour FAKT. C'est le track qui fait passer FAKT d'un outil privé à une release publique v0.1.0 installable et découvrable. 13 points.

Wave 3 BETA est livrée et pushée sur origin/main (HEAD 4881ba2). Wave 4 batch K+L en parallèle : K livre email + archive, toi tu livres CI, releases, installers, landing, docs, messages launch. Tu tournes dans un worktree isolé depuis main.

## État des blocks externes (confirmé par Tom 2026-04-22)

| Block | État | Action Track L |
|---|---|---|
| **Windows OV Code Signing cert** | **SKIP pour v0.1.0** | `.msi` non signé accepté (SmartScreen warning). Track L ne cherche pas à signer Windows. Documenter dans release notes + créer issue follow-up pour v0.1.1. |
| **Apple Developer Program** | Tom souscrit aujourd'hui (2026-04-22) | Scaffolder `release.yml` avec secrets GitHub placeholder (APPLE_ID, APPLE_TEAM_ID, APPLE_PASSWORD, APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY). Tom plugue les valeurs à réception. |
| **Adobe Reader validation Track D PDF** | Tom valide aujourd'hui | Non bloquant. Rappel en fin de rapport pour pre-release gate. |
| **Push origin/main** | Déjà fait (4881ba2 pushé) | Base propre. CI peut déclencher dès premier push PR/tag. |

**Conséquence scope** : tu livres une CI complète + une release workflow fonctionnelle, mais la release v0.1.0 réelle (tag + upload installers signés) sera **exécutée par Tom** une fois : (a) Apple Dev Program actif, (b) Adobe Reader validé, (c) Tom a testé FAKT en usage réel 72h (DoD v0.1.0). Ton commit livre tout le CAPABLE — le tag est action post-commit de Tom.

## Lectures obligatoires AVANT de coder

1. `CLAUDE.md` racine — règles build (Tauri 2, Bun, TypeScript strict, DCO, BSL 1.1).
2. `docs/sprint-plan.md` section **"Track L — CI/CD + Code-signing + Landing + Docs"** — livrables + DoD.
3. `docs/prd.md` :
   - **NFR-003** taille installer ≤ 15 MB (déjà validé Wave 0+1 car Typst CLI subprocess).
   - **NFR-010** coverage ≥ 70%.
   - **NFR-011** cross-platform 3 OS.
   - DoD v0.1.0 gate complet.
4. `docs/architecture.md` section 3.6 (Packaging & CI) — choix techniques : GitHub Actions + `tauri-apps/tauri-action@v2` + Biome + Vitest + Playwright + `tauri-driver`.
5. `docs/product-brief.md` — positionning, ICP, success metrics. Source pour landing copy.
6. `README.md` actuel (si existe) — à enrichir ou remplacer.
7. `LICENSE` actuel — BSL 1.1 change date 2030-04-21 (vérifier présence, ajouter si absent).
8. Répertoire `.github/` actuel : vérifier ce qui existe, compléter.
9. `apps/desktop/src-tauri/tauri.conf.json` — config bundle : identifier, icons, targets.

## Livrables

### 1. CI workflows GitHub Actions — `.github/workflows/`

#### `ci.yml` (on PR + push non-tag)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
    tags-ignore: ['v*']

jobs:
  lint-typecheck-test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: dtolnay/rust-toolchain@stable
      - name: Install Linux deps
        if: matrix.os == 'ubuntu-latest'
        run: sudo apt-get update && sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint   # Biome check
      - run: bun run test
      - run: bun run build  # Vite build only (pas tauri build pour CI speed)
      - name: cargo check (tauri backend)
        working-directory: apps/desktop/src-tauri
        run: cargo check --locked
      - name: cargo audit
        run: cargo install cargo-audit && cargo audit --file apps/desktop/src-tauri/Cargo.lock || true
      - name: bun audit
        run: bun audit || true
```

Justifier si step cargo audit / bun audit est non-bloquant en v0.1.0 (vulns hautes à vérifier manuellement).

#### `e2e.yml` (on main push uniquement, pas PR)

```yaml
name: E2E
on:
  push:
    branches: [main]

jobs:
  playwright-tauri:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      # setup idem ci.yml
      - name: Run Playwright E2E (tauri-driver headless)
        run: bun run test:e2e
```

**Important** : si les tests E2E Playwright ne sont pas écrits (Wave 2/3 ont livré Vitest testing-library mais pas de vrais Playwright + tauri-driver), scaffolder au moins un smoke test (launch app → assert window title visible) dans `apps/desktop/tests/e2e/smoke.spec.ts` avec setup Playwright + `@playwright/test` + `tauri-driver` en devDep. Documenter dans rapport que c'est un smoke minimal et que couverture E2E complète est une dette v0.1.1.

#### `release.yml` (on tag `v*`)

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      matrix:
        include:
          - os: macos-latest
            args: '--target universal-apple-darwin'
          - os: ubuntu-latest
            args: ''
          - os: windows-latest
            args: ''
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: 'aarch64-apple-darwin,x86_64-apple-darwin' }
      - name: Install Linux deps
        if: matrix.os == 'ubuntu-latest'
        run: sudo apt-get update && sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
      - run: bun install --frozen-lockfile
      - uses: tauri-apps/tauri-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing + notarization
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          # Windows signing (skipped v0.1.0) — secrets non déclarés volontairement
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'FAKT ${{ github.ref_name }}'
          releaseBody: 'Voir CHANGELOG.md pour les détails. Installers Win/macOS/Linux attachés.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

Documenter clairement dans un commentaire du workflow que Windows signing est **SKIP v0.1.0** (Tom décision 2026-04-22) et que la signature Windows sera ajoutée en v0.1.1 quand le cert OV sera commandé.

Créer issue template `/.github/ISSUE_TEMPLATE/windows-codesign-v0.1.1.md` (ou un placeholder commenté dans le body) pour tracker le follow-up.

### 2. Configuration Tauri bundle — `apps/desktop/src-tauri/tauri.conf.json`

Enrichir (si pas déjà fait Wave 0) :
- `productName: "FAKT"`.
- `version: "0.1.0"`.
- `identifier: "com.alphaluppi.fakt"`.
- `bundle.targets: ["app", "dmg", "msi", "appimage", "deb"]`.
- `bundle.icon` : liste de paths vers les icons (multiple sizes 32/128/256/512 PNG + `.ico` Windows + `.icns` macOS). **Si les icons n'existent pas**, créer des icons placeholder (logo F stylisé noir sur papier, Brutal Invoice) dans `apps/desktop/src-tauri/icons/` via génération simple (SVG Brutal → PNG via crate ou script de build — OU placeholder stricte avec icon Tauri par défaut temporairement, noter dans TODO pour v0.1.1).
- `bundle.copyright`: `"Copyright © 2026 AlphaLuppi"`.
- `bundle.shortDescription` / `longDescription` en français.
- `bundle.category: "Business"`.
- `bundle.publisher: "AlphaLuppi"`.
- `bundle.macOS.providerShortName` : laisser vide (Tom remplit avec Team ID).
- `bundle.windows.certificateThumbprint` : **ne pas définir** (skip v0.1.0).

### 3. Landing page statique — `landing/`

Nouvelle app `landing/` dans le monorepo Bun workspaces (ajouter au `package.json` racine).

**Stack** : Astro 5 (simple, rapide, static) ou Next.js 15 static export. **Recommandation : Astro** (plus léger, focus statique).

Structure `landing/` :
- `package.json` : `@fakt/landing`, scripts `dev` / `build` / `preview`.
- `astro.config.mjs` : site `https://fakt.alphaluppi.com`, output static, integration Tailwind.
- `src/layouts/Base.astro` : html skeleton + tokens Brutal Invoice portés depuis `packages/design-tokens`.
- `src/pages/index.astro` : landing principale.
- `src/components/` : `Hero.astro`, `FeatureCard.astro`, `CTA.astro`, `Footer.astro`.
- `public/` : logo SVG, OG image (1200x630 Brutal Invoice style), favicon.

**Contenu landing (français)** :

**Hero** (section 1, viewport full) :
- H1 UPPERCASE Space Grotesk 800 : **"FACTUREZ ET SIGNEZ EN LOCAL."**
- Sous-titre Space Grotesk 500 : "FAKT est l'outil open-source pour freelances français qui veulent émettre des devis et factures conformes, avec signature PAdES avancée, sans envoyer leurs données à une API SaaS tierce."
- CTA primary : "Télécharger FAKT v0.1.0" → GitHub Releases page.
- CTA secondary : "Voir la doc" → docs.fakt.alphaluppi.com (ou /docs si hébergé même domaine).
- Visual : mockup simple Brutal (card avec D2026-001 stylisé, pattern Brutal Invoice noir sur papier jaune accent).

**Features** (section 2, 3 cards horizontales Brutal) :
1. **"Signature PAdES maison"** — icône serrure. "Niveau eIDAS avancé (AdES-B-T) avec horodatage TSA RFC 3161. Pas de dépendance Yousign ou Docusign. Audit trail chaîné SHA-256 inviolable. Vérifiable dans Adobe Reader."
2. **"100% offline-first"** — icône prise débranchée. "Vos données restent chez vous (SQLite local). Aucun appel réseau critique. Fonctionne sans internet. Backup ZIP workspace en un clic."
3. **"Skills Claude intégrés"** — icône étincelle. "Extraction de devis depuis un brief texte via Claude Code CLI (votre propre token Anthropic). Rédaction de relances. Composer IA latéral persistent."

**Conformité** (section 3, row légal) :
- Badge "Conforme CGI art. 289" (numérotation séquentielle sans trous).
- Badge "Conforme CGI art. 293 B" (TVA micro-entreprise).
- Badge "Archivage 10 ans" (Code Commerce L123-22).
- Badge "Licence BSL 1.1" (source disponible, commercial après 2030).

**CTA final** (section 4) :
- H2 "Téléchargez la v0.1.0 et facturez aujourd'hui."
- 3 boutons OS (Windows .msi · macOS .dmg · Linux .AppImage) → liens vers GitHub Releases.
- Note : "Version Windows non-signée en v0.1.0 — signature authenticode en v0.1.1."

**Footer** :
- Liens : GitHub, Documentation, Licence BSL 1.1, Product Hunt, Twitter.
- Copyright AlphaLuppi 2026.
- "Fait à Avignon avec amour par Tom Andrieu."

**Style Brutal Invoice strict** : noir #000 + papier #F5F5F0 + jaune #FFFF00 accent, Space Grotesk 700-800 UPPERCASE titres + 500 body, bordures 2.5px, shadows plates 3/5/8px, zéro radius, hover inversion.

**Déploiement** : le landing `dist/` généré peut être déployé sur Vercel/Netlify/Cloudflare Pages. Le workflow CI construit le bundle mais **ne déploie pas automatiquement** (Tom décide du timing). Ajouter dans le README landing une section "Deploy manually : `bun run build && vercel deploy dist/`". Domaine cible `fakt.alphaluppi.com` (fallback `fakt.dev` si souhait Tom) — ne pas configurer DNS dans le commit.

### 4. README.md racine — refonte complète FR

Remplacer `README.md` actuel (si stub) par un README complet français :

- Logo ASCII ou badge en haut.
- Tagline "FAKT — Facturez et signez en local. Open source."
- Badges : version, license BSL 1.1, build status CI, downloads GitHub, Product Hunt.
- Section **Qu'est-ce que FAKT ?** : 3 paragraphes positionning.
- Section **Fonctionnalités** : liste à puces courtes (10-12 items).
- Section **Installation** : télécharger depuis Releases + notes par OS (Windows non signé, macOS Gatekeeper ouvert via right-click, Linux AppImage chmod +x).
- Section **Usage** : screenshots (placeholder refs) du wizard onboarding + création devis + signature.
- Section **Développement local** : prérequis (Bun, Rust, Tauri CLI) + `bun install && bun run dev`.
- Section **Contribution** : DCO sign-off + lien CONTRIBUTING.md.
- Section **Licence** : BSL 1.1 explicite, change date 2030-04-21 → Apache-2.0.
- Section **Support** : issue tracker + email contact@alphaluppi.com.
- Section **Reconnaissance** : crédits (Tauri team, Typst team, Anthropic pour Claude).

### 5. CONTRIBUTING.md — DCO + workflow

Créer ou enrichir `CONTRIBUTING.md` :
- Fork + clone + setup dev local.
- **DCO sign-off obligatoire** : chaque commit `git commit -s`. Texte DCO complet cité.
- Format commits conventional (feat/fix/refactor/test/docs/chore).
- Branches : feature/, fix/, refactor/.
- Tests : Vitest + Playwright obligatoires sur nouveau code.
- Coverage cible ≥ 70%.
- Review : 1 approbation minimum avant merge.
- Code style : Biome auto-format, `bun run lint` passing.
- Sign-off Tom Andrieu comme mainteneur primaire.

### 6. CHANGELOG.md — v0.1.0 entry

Créer `CHANGELOG.md` (Keep a Changelog format) :
- Header + lien Keep a Changelog + SemVer 2.0.
- Section `[Unreleased]` vide.
- Section `[0.1.0] - 2026-05-12` (ou date du tag réel) :
  - **Added** : liste exhaustive des features v0.1.0 (groupée par epic : Onboarding, Clients+Prestations, Devis, Factures, Signature PAdES, Email, Archive, UI+Dashboard).
  - **Security** : signature PAdES AdES-B-T, audit trail SHA-256 chaîné, keychain OS X.509.
  - **Known issues** :
    - Windows installer non signé (SmartScreen warning) — v0.1.1.
    - Playwright E2E coverage limitée à smoke tests — v0.1.1.
    - Composer session non persistée disque — v0.2.

### 7. Docs Mintlify — `docs/` folder

Mintlify config minimum viable dans `docs-site/` (séparé de `docs/` qui contient les specs internes) :

- `docs-site/mint.json` : navigation 5 sections (Intro, Installation, Premier devis, Premier facture, Signature, Architecture).
- `docs-site/introduction.mdx` : "Qu'est-ce que FAKT ?" + lien landing.
- `docs-site/installation.mdx` : install par OS + warnings signing.
- `docs-site/first-quote.mdx` : tutoriel pas à pas premier devis (screenshots placeholder).
- `docs-site/first-invoice.mdx` : idem facture.
- `docs-site/signature.mdx` : signer un devis/facture + vérifier dans Adobe Reader.
- `docs-site/architecture.mdx` : résumé de `docs/architecture.md` public-facing.

Documenter dans README comment déployer les docs (`mint dev` local + guide Mintlify Cloud).

**Alternative si Mintlify trop complexe** : créer simplement un dossier `docs-site/` markdown avec README + link depuis le landing. Noter dans TODO pour v0.1.1.

### 8. Messages launch — `.github/launch-messages/`

Rédiger (NE PAS POSTER) 4 fichiers markdown dans `.github/launch-messages/` :

- `product-hunt.md` : tagline + description 260 chars + gallery prompts + first comment (Maker's story, 400 mots). **Ne pas soumettre** — Tom valide timing.
- `hacker-news.md` : titre "Show HN: FAKT – Open-source desktop app for French freelancers..." + top comment (Maker's intro 500 mots, pourquoi ce projet, techno, différenciateur).
- `twitter.md` : thread 6-8 tweets (accroche, problème, solution, feature killer signature, open-source, call to action).
- `linkedin.md` : post 1500 chars (narratif Tom, pourquoi AlphaLuppi, différenciation, launch).

Ton : français sauf Hacker News (anglais), professionnel mais personnel, no-bullshit, focus légalité + open-source + offline-first comme différenciateurs.

### 9. Icons placeholder — `apps/desktop/src-tauri/icons/`

Si les icons n'existent pas déjà (vérifier) :
- Générer via script simple (SVG Brutal → rasterize via `resvg` crate OU via `convert` imagemagick si dispo sur CI, sinon placeholder).
- Logo : "F" majuscule gras Space Grotesk sur fond jaune #FFFF00 avec bordure 2.5px noire carrée. 1024×1024 base PNG.
- Tailles générées : 32, 128, 256, 512 PNG + `.ico` Windows + `.icns` macOS.
- Acceptable de shipper placeholder Tauri default v0.1.0 si temps insuffisant — documenter dans TODO v0.1.1.

### 10. License BSL 1.1 — `LICENSE`

Vérifier présence de `LICENSE` fichier (BSL 1.1 décidé). Si absent, créer avec texte officiel BSL 1.1 :
- Licensor : AlphaLuppi
- Licensed Work : FAKT v0.1.0
- Additional Use Grant : (vide — usage commercial libre pour freelances individuels)
- Change Date : **2030-04-21**
- Change License : Apache-2.0

## Règles critiques

- **TypeScript strict** — `any` interdit.
- **i18n FR strict** — landing + README + docs en français (HN en anglais par exception, le reste FR).
- **Bundle CI** : `bun install --frozen-lockfile` obligatoire pour reproductibilité.
- **No secrets hardcodés** dans workflows ou configs — tout en `secrets.XXX` GitHub.
- **Permissions Actions** : minimum nécessaire (`contents: write` uniquement pour release.yml).
- **Cache CI** : `oven-sh/setup-bun@v2` auto-cache, `dtolnay/rust-toolchain@stable` + `Swatinem/rust-cache@v2` pour Rust.
- **NFR-003 installer ≤ 15 MB** : vérifier à la fin via CI step ou documenter estimation (Typst CLI subprocess = léger).
- **Pas de commentaires évidents**.
- **Pas de README dans sous-dossiers** sauf `landing/` et `docs-site/` (exceptions explicites).

## Tests

- Workflow `ci.yml` doit passer en local dry-run via `act` (optional, si dispo).
- Landing build `cd landing && bun install && bun run build` → assert `dist/` généré, `dist/index.html` contient "FAKT" + "PAdES" + CTA GitHub.
- Vitest smoke : charger le README.md racine + CONTRIBUTING.md + LICENSE + vérifier longueur non-zéro et présence keywords (BSL, DCO, Tauri).
- E2E smoke test Playwright (`apps/desktop/tests/e2e/smoke.spec.ts`) : launch Tauri app → assert window title "FAKT" visible dans les 10s.

## DoD Track L

- [ ] `.github/workflows/ci.yml` matrix 3 OS avec lint + typecheck + test + build.
- [ ] `.github/workflows/e2e.yml` Playwright smoke minimum.
- [ ] `.github/workflows/release.yml` tauri-action v2 avec secrets placeholder macOS + Windows skip documenté.
- [ ] `apps/desktop/src-tauri/tauri.conf.json` enrichi (identifier, icons, targets, copyright, description).
- [ ] `landing/` nouveau workspace avec Astro (ou équivalent) + hero + 3 features + CTA + Brutal Invoice strict.
- [ ] `landing/` build OK → `dist/` utilisable pour déploiement manuel.
- [ ] `README.md` racine refondu FR complet avec install + usage + contribution.
- [ ] `CONTRIBUTING.md` avec DCO + workflow.
- [ ] `CHANGELOG.md` avec v0.1.0 entry exhaustif.
- [ ] `docs-site/` Mintlify ou markdown minimal viable.
- [ ] `.github/launch-messages/` avec 4 messages rédigés (non postés).
- [ ] `LICENSE` BSL 1.1 avec change date 2030-04-21.
- [ ] Icons apps/desktop OU placeholder documenté pour v0.1.1.
- [ ] `bun run typecheck` et `bun run test` passent **global** (10/10 packages sur repo principal + nouveau workspace landing non bloquant si testless).
- [ ] Documentation état des blocks externes dans body commit + issue follow-up v0.1.1.

## Règle commit atomique (NON-NÉGOCIABLE)

- **UN SEUL** commit atomique à la fin.
- **Message exact :** `feat(track-l): CI matrix 3 OS + release workflow + landing + docs + README FR`
- **DCO sign-off :** `git commit -s`.
- **Body recommandé :**
  ```
  feat(track-l): CI matrix 3 OS + release workflow + landing + docs + README FR

  - .github/workflows/ci.yml matrix ubuntu+macos+windows (lint+typecheck+test+build)
  - .github/workflows/e2e.yml Playwright smoke minimum
  - .github/workflows/release.yml tauri-action@v2 avec placeholders macOS
  - tauri.conf.json enrichi (identifier com.alphaluppi.fakt, targets Win/Mac/Linux)
  - landing/ Astro avec hero + 3 features + CTA Brutal Invoice
  - README.md racine FR refondu (install, usage, dev, contribution)
  - CONTRIBUTING.md DCO + workflow conventional commits
  - CHANGELOG.md v0.1.0 entry exhaustif + known issues
  - docs-site/ Mintlify intro + install + premier devis + signature + archi
  - .github/launch-messages/ (product-hunt / hacker-news / twitter / linkedin)
  - LICENSE BSL 1.1 change date 2030-04-21

  État externes confirmé Tom 2026-04-22 :
  - Windows OV cert : SKIP v0.1.0 (.msi non signé, warning SmartScreen accepté)
    → follow-up v0.1.1 (issue créée)
  - Apple Dev Program : Tom souscrit 2026-04-22, secrets GitHub placeholder
  - Adobe Reader validation PDF signé : à faire par Tom avant tag v0.1.0

  NFRs: NFR-003, NFR-010, NFR-011
  Wave: 4 · Track: L · Points: 13
  ```
- **Avant `git commit`** : `bun run typecheck && bun run test` passent global 10/10 packages sur main.
- **`git add` avec chemins explicites uniquement**. Stage : `.github/workflows/`, `.github/launch-messages/`, `.github/ISSUE_TEMPLATE/` (si ajouté), `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/icons/` (si ajoutés), `apps/desktop/tests/e2e/` (si ajoutés), `landing/`, `docs-site/`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, `package.json` racine (si workspace landing ajouté).
- **Commit sur `main`** (voir règle git en haut du document). **Ne pas push.**

## Rapport final (< 500 mots, français)

- Livrables : checklist des 10 blocs (CI workflows, Tauri bundle config, landing, README, CONTRIBUTING, CHANGELOG, docs-site, launch-messages, icons, LICENSE).
- DoD : 14 gates OK/KO.
- Commit : hash sur main.
- Choix stack landing (Astro vs Next vs autre) + justification.
- Estimation taille installer par OS (verdict NFR-003 ≤ 15 MB).
- État des icons : générés / placeholder / dette v0.1.1.
- État Playwright E2E : vraie suite / smoke uniquement / dette v0.1.1.
- Blocks externes post-commit à résoudre par Tom avant tag v0.1.0 :
  1. Valider manuellement PDF signé Wave 1 Track D dans Adobe Reader.
  2. Souscrire Apple Developer Program + fournir secrets GitHub.
  3. Usage réel FAKT 72h sans crash bloquant (DoD v0.1.0 gate).
  4. Déployer landing sur Vercel/Netlify + DNS fakt.alphaluppi.com.
  5. Créer tag `v0.1.0` → workflow release se déclenche automatiquement.
- Dettes identifiées : Windows signed v0.1.1, Playwright full suite v0.1.1, Mintlify deploy Cloud v0.1.1, multi-language landing v0.2 (EN).
- Risques : Astro build failing CI si target Node mal aligné → tester local. tauri-action@v2 signing Windows absent → CI peut échouer sur step Win si mal configuré → documenter step "continue-on-error: true" pour Windows sign.
```

---

## Stratégie fin de Wave 4 — milestone v0.1.0 PUBLIC (J+21 cible, 2026-05-12)

Fin de Wave 4 = **milestone v0.1.0 PUBLIC**. À la fin des 2 commits (K + L) sur main :

1. Tom (ou Claude orchestrateur) lit les 2 rapports d'agents + inspecte les commits.
2. `bun install && bun run typecheck && bun run test` **global** (tous packages + apps/desktop + nouveau packages/email + landing) → 10/10 + nouveaux tests (attendu 230+ total).
3. Tom résout les blocks externes en post-commit :
   - **Validation Adobe Reader** du PDF signé Wave 1 Track D → signature verte + TSA timestamp visible.
   - **Apple Developer Program** actif + secrets GitHub settings pluggés.
   - **Usage réel FAKT 72h** : Tom émet ≥ 5 vrais devis + ≥ 5 vraies factures via FAKT sans bug bloquant.
   - **Landing déployé** : Vercel/Netlify + DNS fakt.alphaluppi.com pointé.
4. Tom tag `v0.1.0` sur main → le workflow `release.yml` se déclenche automatiquement :
   - Build matrix 3 OS.
   - Installers produits : `.msi` (Windows non signé), `.dmg` (macOS notarized si secrets OK), `.AppImage` + `.deb` (Linux).
   - GitHub Release draft créée avec installers attachés.
5. Tom review la release draft, publie publiquement.
6. Tom poste les messages launch (au moins 2 canaux parmi Product Hunt / Hacker News / Twitter / LinkedIn).
7. Update `docs/sprint-status.yaml` :
   - `waves[wave 4].status = "completed"` + `completed_at`.
   - `milestones[v0.1.0].status = "completed"` + `completed_at` + `actual_day = "J+X"`.
   - `current_wave = null`, `current_milestone = null` (ou projet passe en phase maintenance).
8. Commit de closure sur main : `docs(sprint): wave 4 completed — v0.1.0 release publique`.
9. Repo `AlphaLuppi/FAKT` passe **public** si pas déjà.

---

## Escalade

- Si Track K bloque sur ZIP Rust (crate `zip` incompat ou perf) → fallback impl 100% JS via `jszip` en devDep. Noter dette perf v0.1.1.
- Si Track L bloque sur `tauri-action@v2` secrets Windows → skip Windows signing step avec `continue-on-error: true` + documenter release notes. Ne pas bloquer v0.1.0.
- Si landing Astro build fail CI → bypass CI landing step avec flag `continue-on-error: true`, build manuel local par Tom pre-deploy.
- Si commit `wip(track-X): ...` nécessaire (blocker majeur à mi-chemin) : ajouter note dans body + créer `docs/sprint-notes/track-<id>-<date>.md`.

---

## Rappel actions externes post-Wave 4 (hors scope code, nécessaires pour release publique)

- **Apple Developer Program** (99 USD/an, instant) — Tom souscrit 2026-04-22 → fournir secrets GitHub Settings → re-trigger release.yml si déjà lancé. **Sans ça : macOS .dmg non notarized et Gatekeeper warning utilisateur.**
- **Validation manuelle Adobe Reader** du PDF signé Wave 1 — Tom valide 2026-04-22 → signature verte + TSA visible. **Sans ça : risque technique découvert en post-release.**
- **DNS fakt.alphaluppi.com** → pointer CNAME vers Vercel/Netlify/Cloudflare Pages selon déploiement choisi.
- **Windows OV cert** (SKIP v0.1.0) → commande post-release pour patch v0.1.1 (délai 3-7j commande).
- **Usage 72h réel** : Tom émet ≥ 5 vrais devis + ≥ 5 vraies factures sans bug bloquant.
- **Canaux launch** : poster sur ≥ 2 canaux (Product Hunt / HN / Twitter / LinkedIn) avec les messages rédigés par Track L (non postés).
