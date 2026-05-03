# Plan — Import retour signé client (workflow V0.2)

**Date :** 2026-05-03
**Auteur :** Tom Andrieu + agent
**Statut :** En cours d'implémentation
**Roadmap source :** [`docs/roadmap-post-v0.1.md`](../../roadmap-post-v0.1.md) §2

---

## 1. Contexte et motivation

Aujourd'hui Tom envoie le PDF du devis par email, le client signe (à la main + scan, ou Adobe Reader, ou DocuSign de son côté), et… il n'y a aucun moyen de réinjecter ce PDF signé dans FAKT pour faire avancer le statut. Le devis reste bloqué en `sent` et le bouton « Créer une facture » reste indisponible.

**Décision stratégique :** Option B (import retour) plutôt que Option A (portail SaaS). 100 % offline. Pas d'hébergement. Pas de RGPD côté client. ~3.5 jours d'effort vs 1-2 semaines.

**Cas malicieux à couvrir :** le client renvoie un PDF dont il a baissé le prix avant de signer. Il faut détecter et bloquer (ou alerter explicitement).

**Approche :** hash SHA-256 du contenu textuel normalisé du PDF original, comparé au PDF retourné. Identique → accept. Différent → modal diff visuel + confirmation explicite (cas légitime : annotation marge ; cas malicieux : prix modifié).

---

## 2. Architecture et flux

### À l'émission (`quote.status: draft → sent`)

1. Côté UI, juste après `markSent`, on déclenche un re-render du PDF officiel (sans signature).
2. On envoie les bytes à une commande Rust `compute_pdf_text_hash(pdf_bytes)` qui :
   - Extrait le texte via `pdf-extract` crate
   - Normalise (whitespace folded, line endings unifiés `\n`, BOM stripped, trim global)
   - Calcule SHA-256 hex
3. On persiste le hash via `PATCH /api/quotes/:id` → colonne `quotes.original_text_hash`.

### À l'import client

1. Bouton « Importer signature client » sur `Detail.tsx` (visible si `quote.status === "sent"`).
2. Modal avec :
   - File picker PDF (file dialog Tauri)
   - Email du signataire (requis)
   - Nom du signataire (optionnel, défaut « Client »)
3. Clic « Importer » → commande Rust `import_signed_quote(quote_id, pdf_bytes, signer_email, signer_name, force=false)` :
   - Récupère `original_text_hash` via le sidecar
   - Extrait texte du PDF importé + hash
   - Si hash match → continue
   - Si pas match et `!force` → renvoie `Err(HashMismatch { expected, actual })`
4. Si `HashMismatch` → modal de confirmation **forcée** avec :
   - Hash attendu (8 + 8 chars tronqués)
   - Hash trouvé (8 + 8 chars tronqués)
   - Avertissement explicite « Le contenu textuel du PDF importé diffère du PDF original. Cas légitimes : annotation manuscrite, scan déformé. Cas suspect : prix modifié, lignes ajoutées. Vérifiez visuellement avant de confirmer. »
   - Bouton « Confirmer l'import quand même »
5. Re-call avec `force=true`. Cette fois la commande :
   - Stocke PDF dans `signed_pdfs/quote/<id>.pdf` via `store_signed_pdf`
   - Append audit event `signed_by_client_imported` (chaîne hashée), avec `signer_name`/`signer_email`/IP=null/UA=null/`docHashBefore=expected`/`docHashAfter=actual`
   - Append activity event `quote_signed_by_client_imported`
   - Transition `quote.status: sent → signed` + `quote.signedAt = now`

Le bouton « Créer une facture » se débloque automatiquement via les transitions existantes.

---

## 3. Phase A — DB schema (~0.5j)

### A.1 Migration

**Fichier :** `packages/db/src/migrations/0005_quote_original_text_hash.sql` (nouveau)

```sql
ALTER TABLE quotes ADD COLUMN original_text_hash TEXT;
```

**Note :** le numéro `0005` est OK ici car cette branche part de `main` (pas de la PR #2 qui utilise aussi `0005_quote_clauses.sql`). Si les deux PRs sont mergées, **renommer manuellement la migration de cette PR en `0006_quote_original_text_hash.sql`** au moment du rebase.

### A.2 Schéma Drizzle

`packages/db/src/schema/index.ts` (SQLite) et `pg.ts` (Postgres) — ajouter :

```ts
originalTextHash: text("original_text_hash"),
```

### A.3 Type domain

`packages/shared/src/types/domain.ts` — ajouter à `Quote` :

```ts
/** SHA-256 du texte normalisé du PDF original émis. NULL pour les anciens devis. */
originalTextHash: string | null;
```

### A.4 DDL test helpers

`packages/db/src/__tests__/helpers.ts` — ajouter colonne dans le DDL inline.

### A.5 Embedded migrations

Régénérer `packages/api-server/src/migrations-embedded.ts` via le script.

### A.6 Tests

- Round-trip create/update : `originalTextHash` persisté correctement.
- Backward compat : ancien devis sans hash → `null`.

---

## 4. Phase B — Rust hash + import (~1.5j)

### B.1 Dépendance

**Fichier :** `apps/desktop/src-tauri/Cargo.toml`

Ajouter :

```toml
pdf-extract = "0.7"
```

(~200ko compilé, dépendance pure Rust, pas de FFI).

### B.2 Module

**Fichier :** `apps/desktop/src-tauri/src/pdf/text_hash.rs` (nouveau)

Fonctions exportées :

```rust
/// Extrait le texte d'un PDF, le normalise (whitespace, line endings),
/// et retourne SHA-256 hex.
pub fn compute_pdf_text_hash(pdf_bytes: &[u8]) -> Result<String, TextHashError>;

/// Normalise un texte avant hash : whitespace folded, line endings unifiés,
/// BOM stripped, trim global.
pub fn normalize_text(text: &str) -> String;
```

Tests unitaires Rust :
- `normalize_text` : multiples espaces → un seul, CRLF → LF, BOM retiré, trim
- `compute_pdf_text_hash` : déterministe (deux appels même PDF → même hash)
- `compute_pdf_text_hash` : invariant whitespace (un PDF re-rendu avec espaces différents donne le même hash *si* le contenu textuel est identique — *limite : pdf-extract peut différer entre runs sur les mêmes bytes, à valider en pratique*)

### B.3 Commande Tauri `compute_pdf_text_hash`

**Fichier :** `apps/desktop/src-tauri/src/commands/cycle.rs` (existant) ou nouveau `import_signed.rs`

```rust
#[tauri::command]
pub async fn compute_pdf_text_hash(pdf_bytes: Vec<u8>) -> FaktResult<String>;
```

Appelée par le frontend juste après `markSent` pour persister le hash.

### B.4 Commande Tauri `import_signed_quote`

**Fichier :** `apps/desktop/src-tauri/src/commands/import_signed.rs` (nouveau)

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSignedResult {
    pub event_id: String,
    pub signature_path: String,
    pub hash_matched: bool,
    pub extracted_hash: String,
    pub expected_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ImportSignedError {
    HashMismatch {
        expected_hash: String,
        actual_hash: String,
    },
    QuoteNotFound,
    QuoteNotSent,
    NoOriginalHash,
    InternalError { message: String },
}

#[tauri::command]
pub async fn import_signed_quote(
    app: AppHandle,
    quote_id: String,
    pdf_bytes: Vec<u8>,
    signer_email: String,
    signer_name: Option<String>,
    force: bool,
) -> Result<ImportSignedResult, ImportSignedError>;
```

Workflow :
1. GET `/api/quotes/:id` → vérifie `status === "sent"` et récupère `original_text_hash`
2. Si pas de hash → `NoOriginalHash`
3. Calcule hash du PDF importé
4. Si pas match et `!force` → retourne `HashMismatch` avec les deux hashes
5. Sinon : stocke PDF, append signature event + activity, PATCH status=signed

### B.5 Tests Rust

- `import_signed_quote` happy path (hash match)
- `HashMismatch` quand hash diffère et force=false
- Force=true accepte le mismatch et ajoute l'event
- `NoOriginalHash` si le devis n'a pas de hash (vieux devis ou devis non émis)

---

## 5. Phase C — Hook persistance hash à l'émission (~0.5j)

### C.1 Endpoint sidecar

`packages/api-server/src/routes/quotes.ts` — étendre l'update pour accepter `originalTextHash`. Schema Zod ajouter :

```ts
originalTextHash: z.string().regex(/^[0-9a-f]{64}$/).nullable().optional(),
```

### C.2 Wrapper TS

`apps/desktop/src/api/quotes.ts` + `quotes-api.ts` — ajouter dans `UpdateQuoteInput`.

### C.3 Hook UI

Dans `Detail.tsx` (et tous les endroits qui appellent `markSent` ou émettent un devis) — après émission réussie :

```ts
// Re-render le PDF officiel (sans signature) pour le hasher
const bytes = await pdfApi.renderQuote({ quote, client, workspace });
const hash = await invoke<string>("compute_pdf_text_hash", { pdfBytes: Array.from(bytes) });
await quotesApi.update(quote.id, { originalTextHash: hash });
```

**Note simplification :** on calcule le hash *au moment de l'import* à partir du PDF stocké, pas du contenu DB. Si Tom modifie le devis entre émission et import (interdit par les triggers `quotes_immutable_number` mais pas pour les autres champs en théorie), le hash reste stable.

**Variante alternative envisagée :** hasher *au moment de l'import* en re-rendant le PDF officiel et en comparant à l'extracted hash du PDF importé. Avantage : pas besoin de stocker le hash. Inconvénient : si l'utilisateur a modifié des champs du devis entre temps (notes, conditions, clauses), le hash ne sera pas stable. **On garde la persistance à l'émission.**

---

## 6. Phase D — UI import modal (~1j)

### D.1 Modal d'import

**Fichier :** `apps/desktop/src/components/import-signed-modal/ImportSignedModal.tsx` (nouveau)

Props :

```ts
interface ImportSignedModalProps {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteNumber: string | null;
  defaultSignerName?: string | null; // ex: client.name
  defaultSignerEmail?: string | null; // ex: client.email
  onImported: () => void;
}
```

États :
1. Initial : file picker + champs email/name + bouton Submit.
2. Loading : import en cours.
3. Hash mismatch : affichage des hashes + warning + bouton « Confirmer quand même ».
4. Success : toast → onImported callback → close modal.
5. Error : message erreur.

### D.2 Bouton dans Detail.tsx

Ajouter un bouton « Importer signature client » dans le block actions, visible si `quote.status === "sent"`. Tooltip explicatif.

### D.3 Localisation

`packages/shared/src/i18n/fr.ts` — section `fr.quotes.importSigned.{title,description,emailLabel,nameLabel,submit,mismatchTitle,mismatchBody,confirmAnyway,success,errors.*}`.

---

## 7. Phase E — Tests (~0.5j)

### E.1 Rust

- `text_hash::tests::normalize_text_*` (whitespace, line endings, BOM)
- `text_hash::tests::compute_pdf_text_hash_deterministic` (fixture PDF)
- `import_signed::tests::happy_path` (mock sidecar)
- `import_signed::tests::hash_mismatch_blocks_without_force`

### E.2 TS

- `db/quotes.test.ts` : round-trip `originalTextHash`
- `Detail.test.tsx` : bouton « Importer signature client » visible/caché selon status
- `ImportSignedModal.test.tsx` : flow happy path + flow mismatch (mock invoke)

### E.3 E2E

Hors-scope Playwright : impossible de créer un PDF signé réaliste.

---

## 8. Acceptance criteria

- [ ] Tom émet un devis → le hash texte est calculé et persisté en DB.
- [ ] Bouton « Importer signature client » visible sur les devis status `sent`.
- [ ] Importer un PDF identique au texte du devis original → accept direct → status passe `signed`.
- [ ] Importer un PDF avec contenu textuel différent → modal d'avertissement avec hashes affichés.
- [ ] Confirmer l'import malgré mismatch → accept avec `force=true` → audit event note la divergence.
- [ ] Audit timeline affiche l'event `signed_by_client_imported` avec le nom/email du signataire client.
- [ ] Bouton « Créer une facture » se débloque sur le devis désormais `signed`.
- [ ] Tests verts (DB, Rust, UI).
- [ ] Lint zéro warning.

---

## 9. Risques et mitigations

| Risque | Mitigation |
|---|---|
| **R1.** `pdf-extract` extrait du texte différent entre versions de Typst (espaces, ordre) | Hash normalisé : whitespace folded, line endings unifiés. Si le hash change pour un même devis non-modifié → flag de monitoring + procédure de re-hashing après upgrade Typst. |
| **R2.** L'utilisateur modifie le devis (notes, clauses) entre émission et import retour | La transition `sent → draft` (rollback) est interdite par les triggers. Mais l'update partielle peut être faite. **Atténuation :** le hash reste stable car il est calculé une seule fois à l'émission. Si le devis est modifié après l'émission (cas marginal), l'import échouera et l'utilisateur devra réémettre. |
| **R3.** Conflit de migration `0005_*` avec la PR #2 (clauses) si elle est mergée d'abord | Renommer manuellement la migration en `0006_quote_original_text_hash.sql` au moment du rebase. Le journal Drizzle devra aussi être réordonné. |
| **R4.** Vieux devis sans `original_text_hash` (créés avant cette feature) | L'import retourne `NoOriginalHash`. UI affiche un message « Cette feature nécessite que le devis ait été émis depuis FAKT v0.X.Y+. Re-émettez le devis (impossible si déjà signé). » Cas marginal acceptable. |
| **R5.** PDF retourné par le client est un scan (image only, pas de texte sélectionnable) | `pdf-extract` retournera une string vide → hash différent → mismatch. L'utilisateur force → l'audit event note la divergence. Documenter ce cas dans le help text de la modal. |

---

## 10. Ordre d'implémentation

1. Phase A : DB schema + migration + tests
2. Phase B : Rust hash util + commands + tests
3. Phase C : Hook persistance hash à l'émission
4. Phase D : UI modal d'import
5. Phase E : Tests UI + intégration

Effort total : **~3.5 jours**.

---

## 11. Décisions ouvertes

- **Hash quand le devis est ré-émis ?** Si on rollback `signed → sent` (impossible aujourd'hui mais V0.4+ peut le permettre), faut-il re-hasher ? **Décision : non, le hash original reste la référence juridique.**
- **Faut-il afficher le hash dans le PDF lui-même ?** En footer, sous forme de QR code ou de string mono. **Décision : pas en V0.2. Trop visuellement intrusif. Le hash reste interne, vérifiable via le rapport d'audit (PR #2).**
- **PDF importé : re-stocker dans `signed_pdfs/` ou ajouter un suffix `_imported` ?** **Décision : remplacer le PDF original** (le PDF signé client devient le PDF officiel du devis). Le PDF original FAKT reste accessible via re-render.
