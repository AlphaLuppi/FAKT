# Plan — Audit Trail PDF lisible + Clauses conditionnelles

**Date :** 2026-05-02
**Auteur :** Tom Andrieu + agent
**Statut :** En cours d'implémentation
**Inspiration :** étude comparative DocuSeal vs FAKT (2026-05-02), `lib/submissions/generate_audit_trail.rb`

---

## 1. Contexte et motivation

Suite au comparatif FAKT vs DocuSeal, deux features ont été retenues comme
mode-1-compatibles, valeur immédiate, et alignées avec la roadmap V0.1.x
de stabilisation pré-V0.2 (cf. `docs/roadmap-post-v0.1.md`).

### Feature #1 — Rapport d'audit PDF lisible

**Problème actuel :** la chaîne `signature_events` est intègre côté DB
(SHA-256 chaînés, append-only via triggers SQL) mais **invisible** pour un
tiers. En cas de litige, l'utilisateur n'a aucun document à présenter à un
avocat ou à un juge — juste des hashes dans une SQLite.

**Inspiration :** DocuSeal génère un PDF "Audit Log" lisible (titre, ID
document, événements horodatés, IP, UA, hash documents) qu'on télécharge
en pièce jointe d'une soumission. Cf. `docuseal/lib/submissions/generate_audit_trail.rb:33-510`.

**Objectif :** un bouton « Télécharger le rapport d'audit » sur les devis
**signés** (ce sont les seuls qui ont du contenu d'audit pertinent), qui
génère un PDF Typst combinant :

- Métadonnées document (type, n°, montant, client)
- Chaîne `signature_events` (signataire, IP, UA, hash before/after, TSA, previousEventHash)
- Journal d'activité (`activity` table — created, sent, viewed, signed…)
- Mention vérification (« Ce rapport peut être vérifié via la commande
  `verify_signature` de FAKT ou avec un outil PAdES tiers (Adobe, pyHanko) »)

### Feature #2 — Clauses conditionnelles dans l'éditeur de devis

**Problème actuel :** le champ `quotes.conditions` est une string libre
(textarea). Pour un freelance qui propose plusieurs CGV variables (acompte
30/50%, garantie 6/12 mois, B2B vs B2C, mention propriété intellectuelle…),
il doit retaper ou copier-coller à chaque devis.

**Inspiration :** DocuSeal a un `conditions_modal.vue` qui permet de
cocher/décocher des règles d'affichage. On ne va PAS aussi loin (pas de
form-builder WYSIWYG) — juste une liste de clauses pré-définies en cases
à cocher dans QuoteForm.

**Objectif :** un panneau « Clauses » dans l'éditeur de devis avec ~8
clauses pré-rédigées en français (acompte 30%, acompte 50%, garantie
6 mois, garantie 12 mois, propriété intellectuelle, confidentialité NDA,
limitation de responsabilité, juridiction Avignon). L'utilisateur coche →
le contenu est injecté dans le PDF via Typst.

---

## 2. Phase A — Rapport d'audit PDF (~1.5j)

### A.1 Nouveau template Typst

**Fichier :** `packages/pdf/templates/audit-trail.typ`

Template autonome qui réutilise `base.typ` (fonts, couleurs, helpers).
Reçoit en entrée un JSON :

```ts
interface AuditTrailCtx {
  kind: "audit-trail";
  document: {
    type: "quote" | "invoice";
    number: string;
    title: string;
    clientName: string;
    totalHt: string; // pré-formaté "1 234,56 €"
    issuedAt: string | null; // pré-formaté "21 avril 2026"
  };
  workspace: { name: string; siret: string; email: string };
  signatureEvents: Array<{
    timestamp: string; // pré-formaté "21 avril 2026 — 14:32"
    signerName: string;
    signerEmail: string;
    ipAddress: string | null;
    userAgent: string | null;
    docHashBefore: string;
    docHashAfter: string;
    previousEventHash: string | null;
    tsaProvider: string | null;
    padesLevel: "B" | "B-T" | null;
  }>;
  activityEvents: Array<{
    timestamp: string;
    kind: string; // "created" | "sent" | "viewed" | …
    label: string; // déjà traduit FR ("Créé", "Envoyé", …)
  }>;
  generatedAt: string; // pré-formaté
}
```

Sections Typst :

1. Header — titre `RAPPORT D'AUDIT`, sous-titre `Devis Dxxxx-NNN — Client X`
2. Métadonnées document (table 2 colonnes)
3. Section `SIGNATURES` (si > 0 signatureEvents) — table par event
4. Section `JOURNAL D'ÉVÉNEMENTS` — chronologie tous événements confondus
5. Footer — mention « Document généré le {generatedAt} par FAKT v{version}.
   Ce rapport peut être vérifié indépendamment via la chaîne SHA-256 ou
   un outil PAdES (Adobe Reader, pyHanko, etc.) »

### A.2 Wrapper TS `@fakt/pdf`

**Fichier :** `packages/pdf/src/index.ts` — ajouter `renderAuditTrailPdf`

```ts
export interface BuildAuditCtxArgs {
  document: { type: "quote" | "invoice"; ... };
  workspace: WorkspaceInput;
  signatureEvents: SignatureEvent[]; // raw du backend
  activityEvents: ActivityEvent[];
}

export async function renderAuditTrailPdf(args: BuildAuditCtxArgs): Promise<Uint8Array> {
  const ctx = buildAuditTrailContext(args);
  return renderPdf(ctx);
}
```

`context-builder.ts` — ajouter `buildAuditTrailContext` qui :
- Trie events par timestamp ASC
- Pré-formate dates via `Intl.DateTimeFormat`
- Mappe activity types → labels FR (réutilise mapping existant `audit-timeline/AuditTimeline.tsx`)

### A.3 Commande Rust `render_pdf`

**Fichier :** `apps/desktop/src-tauri/src/pdf/render.rs`

- Ajouter `const TPL_AUDIT_TRAIL: &str = include_str!("../../../../../packages/pdf/templates/audit-trail.typ");`
- Étendre le `match doc_type` : `"audit-trail" => TPL_AUDIT_TRAIL`
- Pas de signature_png pour ce type (il n'a pas de bloc signature à signer)

### A.4 UI — bouton « Rapport d'audit »

**Fichier :** `apps/desktop/src/routes/quotes/Detail.tsx`

Ajouter un bouton secondaire `Rapport d'audit` dans le bloc actions, visible
**uniquement quand `quote.status === "signed"`**. Au clic :

1. Fetch `signatureApi.listEvents("quote", quote.id)`
2. Fetch `activityApi.list({ entityType: "quote", entityId: quote.id })`
3. Appelle `pdfApi.renderAuditTrail({ document, workspace, signatureEvents, activityEvents })`
4. Save dialog → écrit `Audit-Devis-{number}.pdf`

Identique côté `apps/desktop/src/routes/invoices/Detail.tsx` quand on aura
des invoices signées (V0.3+ via émission auto). Pour V0.1.x on cible
uniquement les devis signés.

### A.5 Localisation

**Fichier :** `packages/shared/src/i18n/fr.ts` (ou équivalent)

Ajouter `fr.audit.report.{title,download,sectionDocument,sectionSignatures,sectionEventLog,verificationNotice}`.

### A.6 Tests

- **Unit Typst** : générer un fixture JSON, compiler via `typst compile`
  en mode CI, vérifier `%PDF-` start.
- **Unit context-builder** : `packages/pdf/tests/audit-context.test.ts`
  vérifier le tri par timestamp, format dates FR, mapping kinds.
- **Component** : `apps/desktop/src/routes/quotes/Detail.test.tsx`
  vérifier que le bouton apparaît seulement si `status === "signed"`.

### A.7 Acceptance criteria Phase A

- [ ] Bouton "Rapport d'audit" visible sur un devis signé.
- [ ] PDF généré contient : header, métadonnées, ≥1 signature event, ≥1 activity event, footer.
- [ ] Hashes affichés en mode mono, tronqués lisibles (8…4) avec hash complet en titre HTML annulé (PDF, donc juste affiché complet).
- [ ] PDF respecte la charte legacy (bleu `#2E5090`, Inter, A4 marges 2cm).
- [ ] Tests unitaires verts (`bun test`).
- [ ] Lint zéro warning (`bun run lint`).

---

## 3. Phase B — Clauses conditionnelles (~2-3j)

### B.1 Catalogue des clauses

**Fichier :** `packages/legal/src/clauses.ts` (nouveau)

```ts
export interface ClauseDefinition {
  id: string; // stable, ex "deposit-30"
  category: "payment" | "warranty" | "ip" | "liability" | "jurisdiction";
  label: string; // affichage UI ("Acompte 30 % à la commande")
  body: string; // texte FR injecté dans le PDF — multi-paragraphes OK
  excludes?: string[]; // mutuellement exclusif avec ces ids (ex deposit-30 vs deposit-50)
}

export const CLAUSE_CATALOG: readonly ClauseDefinition[] = [
  { id: "deposit-30", category: "payment", label: "Acompte 30 % à la commande",
    body: "Un acompte de 30 % du montant total HT est dû à la signature du devis. Le solde est facturé à livraison.",
    excludes: ["deposit-50"] },
  { id: "deposit-50", category: "payment", label: "Acompte 50 % à la commande",
    body: "Un acompte de 50 % du montant total HT est dû à la signature du devis. Le solde est facturé à livraison.",
    excludes: ["deposit-30"] },
  { id: "warranty-6", category: "warranty", label: "Garantie 6 mois",
    body: "Le prestataire garantit ses livrables pendant 6 mois à compter de la réception.",
    excludes: ["warranty-12"] },
  { id: "warranty-12", category: "warranty", label: "Garantie 12 mois",
    body: "Le prestataire garantit ses livrables pendant 12 mois à compter de la réception.",
    excludes: ["warranty-6"] },
  { id: "ip-transfer", category: "ip", label: "Transfert de propriété intellectuelle",
    body: "Les droits patrimoniaux sur les livrables finaux sont cédés au client après paiement intégral." },
  { id: "ip-license", category: "ip", label: "Licence d'utilisation (PI conservée)",
    body: "Le prestataire conserve la propriété intellectuelle des livrables. Le client bénéficie d'une licence d'utilisation perpétuelle non-exclusive." },
  { id: "liability-cap", category: "liability", label: "Limitation de responsabilité",
    body: "La responsabilité du prestataire est limitée au montant total HT du devis." },
  { id: "jurisdiction-fr", category: "jurisdiction", label: "Juridiction française",
    body: "En cas de litige, et après tentative de résolution amiable, les tribunaux du ressort du siège social du prestataire sont seuls compétents." },
];
```

### B.2 Schéma DB

**Fichier :** `packages/db/src/schema/index.ts`

Ajouter une colonne `clauses` à la table `quotes` :

```ts
clauses: text("clauses"), // JSON array of clause IDs ex ["deposit-30","warranty-12"]
```

Migration Drizzle : `packages/db/src/migrations/00XX_add_quotes_clauses.sql`

```sql
ALTER TABLE quotes ADD COLUMN clauses TEXT;
```

Pas de migration de backfill — les anciens devis ont `clauses = NULL`,
le rendu Typst gère ce cas.

### B.3 UI — panneau Clauses

**Fichier :** `apps/desktop/src/routes/quotes/QuoteForm.tsx`

Ajouter une section `Clauses contractuelles` après le champ "Conditions"
(qui devient "Conditions particulières (texte libre)" — coexistent).

Pour chaque category, afficher un groupe avec les clauses associées sous
forme de cases à cocher. Quand l'utilisateur coche une clause qui a un
`excludes`, on décoche automatiquement les conflits.

Le résultat est stocké dans `quote.clauses` en JSON `string[]`.

### B.4 Rendu Typst

**Fichier :** `packages/pdf/templates/quote.typ`

Avant la section `quote-legal` :

```typ
#if ctx.at("clauses", default: ()) != () and ctx.clauses.len() > 0 [
  #v(14pt)
  #h1("Clauses contractuelles")
  #for clause in ctx.clauses [
    #block(
      above: 0.4em,
      below: 0.4em,
      [
        #text(weight: "bold", size: size-sm)[#clause.label]
        #v(2pt)
        #text(size: size-sm)[#clause.body]
      ],
    )
  ]
]
```

Le wrapper TS `context-builder.ts` injecte `clauses: ClauseDefinition[]`
en hydratant les IDs sélectionnés via `CLAUSE_CATALOG`.

### B.5 Tests

- **Unit** : `packages/legal/__tests__/clauses.test.ts` — vérifier
  exclusions mutuelles.
- **Unit DB** : `packages/db/src/queries/__tests__/quotes.clauses.test.ts`
  — round-trip JSON.
- **Component** : `apps/desktop/src/routes/quotes/QuoteForm.test.tsx`
  vérifier qu'on ne peut pas cocher deposit-30 ET deposit-50 simultanément.

### B.6 Acceptance criteria Phase B

- [ ] Panneau Clauses visible dans `QuoteForm` (modes new + edit).
- [ ] 8 clauses catalogue affichées groupées par category.
- [ ] Exclusions mutuelles fonctionnent (deposit-30 ↔ deposit-50, warranty-6 ↔ warranty-12).
- [ ] Sauvegarde devis persiste les IDs sélectionnés.
- [ ] PDF rendu affiche les clauses cochées dans une section dédiée, en
  conservant la mise en page brutaliste.
- [ ] Migration DB ajoutée et appliquée.
- [ ] Tests verts + lint zéro warning.

---

## 4. Risques et atténuations

| Risque | Atténuation |
|---|---|
| **A1.** `audit-trail.typ` est lourd à maintenir si on ajoute des champs futurs (Factur-X, certs LTV) | Le ctx est typé strictement côté TS — toute addition forcera la compilation à passer par les types. Le template Typst utilise `ctx.at("xxx", default: none)` pour rester rétro-compatible. |
| **A2.** Les hashes SHA-256 sont longs et risquent de casser la mise en page A4 | Affichage en mono, taille `size-xs`, wrap autorisé via Typst (qui sait wrapper du mono). On peut tronquer 8…4 si trop long, mais le PDF d'audit doit montrer le hash COMPLET pour la valeur juridique — on accepte le wrap. |
| **A3.** Activity events ne sont pas tous traduits FR aujourd'hui | Réutiliser le mapping `activityTypeToKind` existant dans `AuditTimeline.tsx`. Si un event n'a pas de label, fallback sur le `type` brut. |
| **B1.** Les clauses sélectionnées peuvent dépasser une page | Layout Typst gère le pagebreak. Aucun risque fonctionnel. |
| **B2.** Migration DB sur production = destructive si rollback | `ADD COLUMN` est non-destructive (rollback = `DROP COLUMN clauses`). Pas de backfill nécessaire. |
| **B3.** Conflit avec l'import IA — l'extracteur Claude doit-il pouvoir suggérer des clauses ? | Hors scope V0.1.x. L'IA continue de remplir `conditions` (texte libre). Les clauses pré-définies sont un opt-in manuel via l'UI. |

---

## 5. Rollback plan

### Phase A
- Retirer le bouton "Rapport d'audit" via Edit (composant feature-flagged côté UI).
- Le template Typst peut rester, il n'est pas chargé sans la commande qui le déclenche.
- Pas de migration DB → pas de rollback DB.

### Phase B
- Si bug critique sur les clauses, retirer le panneau UI dans QuoteForm.
- Les valeurs `quote.clauses` JSON existantes restent en DB (rétro-compatible).
- Pour rollback total : `ALTER TABLE quotes DROP COLUMN clauses;` — non
  bloquant car colonne nullable.

---

## 6. Ordre d'implémentation

1. **Phase A** d'abord (pas de migration DB, plus simple) :
   - A.1 template Typst
   - A.2 wrapper TS + context-builder
   - A.3 commande Rust render_pdf
   - A.4 UI bouton
   - A.5 localisation
   - A.6 tests
2. **Phase B** ensuite :
   - B.1 catalogue clauses
   - B.2 migration DB
   - B.3 UI panneau
   - B.4 rendu Typst
   - B.5 tests
3. **Finale** :
   - Update `CHANGELOG.md` section `[Unreleased]`
   - Commit conventionnel signé DCO+GPG (1 commit par phase)

Pas de tag de release dans ce plan — Tom décide quand release une v0.1.x
intermédiaire.

---

## 7. Décisions ouvertes

- **Scope du rapport d'audit** : devis-signé seulement (V0.1.x) ou aussi
  facture-émise (V0.3+ avec sceau auto à l'émission) ? **Décision : devis
  seulement pour ce sprint, facture en V0.3 quand le sceau auto sera là.**
- **Format clause body** : plain text ou markdown léger (gras/italic) ?
  **Décision : plain text. Si besoin de formatage plus tard, on étend.**
- **Faut-il un éditeur de clauses custom (créer ses propres) ?** Hors
  scope V0.1.x — on reste sur le catalogue figé. La V0.4 pourra
  introduire une table `clause_templates` user-defined.
