# TODO — packages/db

## Numérotation atomique (Track D, Wave 2)

**Fichier :** `src/queries/numbering.ts`

**État actuel (Track B — stub non-atomique) :**
L'implémentation actuelle (`nextQuoteNumber`, `nextInvoiceNumber`) utilise un
SELECT MAX + UPDATE séquentiel en deux requêtes distinctes. En mode solo-user
v0.1 (mono-connexion SQLite), ce n'est pas un problème car il n'y a pas de
concurrence.

**Problème sur multi-connexions (v0.2 self-host, SaaS) :**
Deux processus simultanés pourraient lire la même valeur `lastSequence` et
produire deux documents avec le même numéro — violation de la contrainte UNIQUE
sur `(workspace_id, year, type)` et de CGI art. 289 (séquence sans trous).

**Migration path — Track D (Wave 2, intégration Track H) :**

1. Créer une Tauri command Rust dédiée :
   `apps/desktop/src-tauri/src/db/numbering.rs`

   ```rust
   pub fn next_number(conn: &mut Connection, workspace_id: &str, doc_type: &str)
     -> Result<(i32, i32), Error>
   {
     let year = chrono::Utc::now().year();
     let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
     tx.execute(
       "INSERT INTO numbering_state (workspace_id, year, type, last_sequence)
        VALUES (?1, ?2, ?3, 1)
        ON CONFLICT(workspace_id, year, type)
        DO UPDATE SET last_sequence = last_sequence + 1",
       params![workspace_id, year, doc_type],
     )?;
     let sequence: i32 = tx.query_row(
       "SELECT last_sequence FROM numbering_state
        WHERE workspace_id = ?1 AND year = ?2 AND type = ?3",
       params![workspace_id, year, doc_type],
       |r| r.get(0),
     )?;
     tx.commit()?;
     Ok((year, sequence))
   }
   ```

   `BEGIN IMMEDIATE` garantit l'exclusivité de l'écriture en SQLite WAL.

2. Remplacer les appels TS dans `src/queries/numbering.ts` par un `invoke()`
   vers la Tauri command `next_number`.

3. Migrer les tests Vitest pour mocker le `invoke()` ou tester la Tauri command
   directement via `tauri-driver`.

**Stories impactées :** US-010 (numérotation), FR-010 (CGI art. 289).
**Risque si non migré avant v0.2 :** double numéros en cas de création
concurrente (self-host multi-user).
