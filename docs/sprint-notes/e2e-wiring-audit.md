# Audit câblage E2E frontend↔backend — FAKT v0.1.0

**Date :** 2026-04-22 (J+1 post code-ready)
**Méthode :** 8 subagents parallèles (code-explorer) — chacun trace une feature du composant React jusqu'à la DB SQLite via le bridge Tauri.
**Question posée :** si Tom lance `bun run tauri:dev` et tente le flow end-to-end, est-ce que ça fonctionne vraiment, ou est-ce qu'il y a des stubs qui bloquent ?

## TL;DR

**L'app n'est PAS dogfoodable en l'état.** Le frontend React est complet et Brutal strict (audit UI déjà fait, cf `post-release-polish.md`), mais **le backend Rust est absent ou stubé pour ~80% du CRUD métier**.

La décision architecturale W0 « DB en TS via Drizzle + better-sqlite3 côté renderer » n'a jamais été exécutée : aucune initialisation de DB au démarrage Tauri. Les commandes Rust attendues par les hooks React (`create_client`, `list_quotes`, `mark_invoice_paid`, `update_workspace`, etc.) ne sont pas enregistrées dans `invoke_handler!` de `apps/desktop/src-tauri/src/lib.rs`. Les hooks `catch` silencieusement les erreurs Tauri « command not found » et retournent `[]` → l'UI affiche partout « aucune donnée ».

## Matrice des features

| Feature | Frontend | Bridge TS | Command Rust | DB query | Verdict |
|---|---|---|---|---|---|
| **Clients CRUD** | OK | OK (invoke bien câblé) | **5 manquantes** | OK (Drizzle) | MOCK-ONLY |
| **Prestations CRUD** | OK | OK | **4 manquantes** | OK | MOCK-ONLY |
| **Devis (create/list/issue)** | OK | OK | **7 manquantes + 1 stub** | OK | MOCK-ONLY |
| **Factures (create/from-quote/mark-paid)** | OK | OK | **5 manquantes + 3 stubs** | OK | MOCK-ONLY |
| **Onboarding (identité + cert)** | OK | OK | `update_workspace` **absent** | (table manquante) | BLOQUÉ au Recap step |
| **Signature PAdES** | OK | OK | **réelles** (RSA 4096, X.509, TSA, keychain) | audit trail en **RAM** | PARTIELLEMENT OK |
| **Email draft** | OK | OK | `open_email_draft` réel | — | Plugins Tauri fs/path **manquants** |
| **Archive ZIP** | OK | OK | `build_workspace_zip` réel (crate zip) | `backups` non peuplée | Plugin dialog **manquant** |

## Détail des gaps par feature

### 1. Clients (BLOQUANT release)

Appelles IPC du hook `useClients` non câblés Rust :
- `list_clients`, `get_client`, `create_client`, `update_client`, `archive_client` : absentes de `lib.rs`.

La couche `packages/db/src/queries/clients.ts` est complète et testée, mais jamais invoquée en runtime car la DB n'est pas initialisée côté renderer Tauri.

**Conséquence dogfood** : cliquer « Enregistrer » sur le modal Nouveau client → erreur silencieuse → modal se ferme → liste reste vide.

### 2. Prestations (BLOQUANT release)

Même pattern. 4 commandes absentes : `list_services`, `create_service`, `update_service`, `archive_service`. `ItemsEditor` du formulaire Devis/Facture aura un picker prestations toujours vide.

### 3. Devis (BLOQUANT release)

7 commandes absentes : `create_quote`, `list_quotes`, `get_quote`, `update_quote`, `issue_quote`, `expire_quote`, `cancel_quote`, `preview_next_number`.

Stub `Ok(())` : `mark_quote_invoiced` dans `commands/cycle.rs:41-49`.

Point positif : `numbering_next_quote` est **réellement implémenté atomique** (`BEGIN IMMEDIATE` SQLite dans `state.rs`). CGI art. 289 respecté côté primitif, mais non câblé sur `create_quote`.

PDF : `render_pdf` est réel (subprocess Typst) mais nécessite Typst CLI installé côté user (pas embedded).

### 4. Factures (BLOQUANT release + gap légal)

5 commandes absentes : `create_invoice_independent`, `create_invoice_from_quote`, `list_invoices`, `get_invoice`, `mark_invoice_paid`, `archive_invoice`.

Stubs `Ok(())` : `mark_invoice_sent`, `update_invoice`, `delete_invoice` (`cycle.rs:52-90`).

**Gap légal supplémentaire** : notes de paiement collectées dans `MarkPaidModal` ne sont **pas persistées** (pas de colonne `payment_notes` dans le schéma).

Trigger SQL `invoices_no_hard_delete_issued` existe dans `0001_triggers.sql` mais jamais atteint car `delete_invoice` Rust est un stub qui ne touche pas la DB.

Point positif : `packages/legal/src/mentions.ts` est **conforme** (art. 289, art. 293 B micro-entreprise, pénalités retard, indemnité 40€).

### 5. Onboarding + Cert (BLOQUANT release)

`RecapStep.tsx:48` appelle `invoke("update_workspace", { input: data })` → **command absente de `lib.rs`** → catch error → `complete_setup` jamais atteint → `setup_flag` reste `false` → **le wizard reboucle à chaque démarrage**.

L'utilisateur ne peut pas finir l'onboarding.

Même si on fixait ça, **mismatch de noms** entre `CertInfo` TS (`subject_dn`, `fingerprint_sha256`, `not_before`) et Rust (`subject_cn`, `fingerprint_sha256_hex`, `not_before_iso`) → le tab Certificat afficherait `undefined` partout.

**Gros point positif** : la génération cert X.509 RSA 4096 est **réelle** (crate `rsa` + `x509-cert` + `keyring`). Clé privée vraiment stockée dans keychain OS, jamais en fichier plat. Certes marge serrée sur Windows (PKCS#8 DER ~2300 octets vs 2560 max Credential Manager), mais implémentation sérieuse avec fallback AES-GCM.

### 6. Signature PAdES (PARTIELLEMENT OK — 3 dettes v0.1.1)

**Implémentation Rust réelle** : `sign_document` orchestre vraiment keychain + CMS PAdES-B + TSA RFC 3161 + audit chain SHA-256. Pas de stub.

Bugs identifiés :
1. **Hash TSA non conforme strict PAdES-B-T** : le TSR horodate `SHA256(cms_der entier)` au lieu de `SHA256(SignerInfo.signature BIT STRING)` (RFC 3161 §2.5). **Adobe Reader peut rejeter** la validation. Commenté dans le code `commands.rs:347-356` mais non corrigé.
2. **Audit trail en RAM** (`Mutex<Vec<SignatureEvent>>`, `state.rs:50`) → **perdu à chaque redémarrage** de l'app. Table `signature_events` absente du schéma SQLite.
3. **Fichier test `signed_pades_b_t_freetsa.pdf` n'existe pas** → gate 1 Tom « valider Adobe Reader » impossible à exécuter. Le test qui le génère est `#[ignore]` en CI.

`verify_signature` vérifie le hash + chaîne mais ne parse pas le CMS (pas de vérification cryptographique RSA).

### 7. Email draft (BLOQUANT runtime)

Commands Rust `open_email_draft` + `open_mailto_fallback` **réelles** et enregistrées.

**BLOQUANT** : le modal `PrepareEmailModal` invoque `plugin:fs|write_text_file` + `plugin:path|temp_dir` + `plugin:fs|create_dir` pour sauvegarder le .eml, mais **`tauri-plugin-fs` + `tauri-plugin-path` ne sont pas dans `Cargo.toml`** et non initialisés dans `lib.rs`. Seul `tauri-plugin-shell` est déclaré. Le write_text_file crashe → toast erreur générique.

Autres gaps mineurs :
- Chemin Windows non quoté dans `cmd /C start "" <path>` → fail si username contient espace.
- PDF attaché est la version **non-signée** (le modal n'utilise pas `get_signed_pdf`).
- Event `email_drafted` jamais inséré dans table `activity` (query `activity.ts` absente).

### 8. Archive ZIP (BLOQUANT runtime)

Command Rust `build_workspace_zip` **réelle** (crate `zip 2.x`, structure correcte, CSV + PDFs + README compliance art. L123-22 + art. 286 CGI).

**BLOQUANT** : UI invoque `plugin:dialog|save` pour le file picker, mais **`tauri-plugin-dialog` absent** de `Cargo.toml` et non initialisé. Le `.catch(() => null)` silently fail → export annulé sans message.

Autres gaps :
- Prestations passées en dur comme `[]` à `buildPrestationsCsv` → CSV prestations toujours vide.
- Table `backups` jamais peuplée après export.
- Typst CLI requis côté user (non embedded dans l'app).
- Performance NFR 50 docs < 10s non respectée (Typst subprocess séquentiel → 50-100s estimés).

## Récap des 20+ commandes Rust manquantes

```
list_clients, get_client, create_client, update_client, archive_client
list_services, create_service, update_service, archive_service
create_quote, list_quotes, get_quote, update_quote,
  issue_quote, expire_quote, cancel_quote, preview_next_number
create_invoice_independent, create_invoice_from_quote,
  list_invoices, get_invoice, mark_invoice_paid, archive_invoice
update_workspace
(+ 3 stubs Ok(()) à remplacer par vraies écritures DB dans cycle.rs :
   mark_quote_invoiced, mark_invoice_sent, update_invoice, delete_invoice)
```

Plus le bug `update_workspace` qui bloque même le wizard d'onboarding.

## Recommandation release

**NE PAS TAG `v0.1.0`** en l'état. L'app ne passe pas le gate 3 « Usage réel 72h » car :
- L'onboarding reboucle (update_workspace absent).
- Même si on bypasse : aucun client, aucune prestation, aucun devis, aucune facture ne persiste.
- L'email et l'archive ZIP crashent au runtime (plugins Tauri manquants).
- Signature PAdES risque rejet Adobe Reader (hash TSA).

Le code est prêt à **~60% fonctionnel** (frontend 95%, Rust crypto 85%, Rust métier 15%). Il manque le pont métier entre les queries Drizzle TS et Tauri.

## Plan d'action recommandé

**Option A — fix release-blocking (1–2 jours agent team)** :

1. **Décider l'archi DB runtime** : (i) initialiser `better-sqlite3` + Drizzle côté renderer au démarrage via un `db-bootstrap.ts` appelé dans `main.tsx` avant le render React, OU (ii) créer un module `src-tauri/src/db/` avec rusqlite natif + port des queries Drizzle en Rust. L'option (i) est **beaucoup plus rapide** car `packages/db/src/queries/` est déjà complet, mais nécessite le plugin Tauri `@tauri-apps/plugin-shell` + `@tauri-apps/plugin-fs` pour accéder au home dir. L'option (ii) est « plus clean » mais duplique du code.

2. **Ajouter les plugins Tauri manquants** dans `apps/desktop/src-tauri/Cargo.toml` et `lib.rs` :
   - `tauri-plugin-fs` + `tauri-plugin-path` (pour email draft temp file)
   - `tauri-plugin-dialog` (pour save dialog ZIP + autres)
   - Fichier `capabilities/*.json` pour permissions.

3. **Si option (i) retenue**, les hooks TS appellent directement les queries Drizzle sans passer par `invoke`. Les commandes Rust manquantes (clients/prestations/quotes/invoices CRUD) deviennent inutiles. Il reste uniquement à :
   - Fixer `update_workspace` (TS direct Drizzle).
   - Fixer les stubs `Ok(())` de `cycle.rs` (stocker le statut côté TS Drizzle).
   - Fixer le mismatch CertInfo noms (`subject_dn`↔`subject_cn` etc.).

4. **Fix signature PAdES bloquants release** :
   - Corriger hash TSA (1 ligne à changer dans `commands.rs`).
   - Persister audit trail en SQLite (table `signature_events` + migration).
   - Générer le fichier test `signed_pades_b_t_freetsa.pdf` pour gate 1 Tom.

5. **Fix facture `payment_notes`** : ajouter la colonne + passer le param dans `markInvoicePaid`.

**Option B — downgrade scope v0.1.0** :

Renommer la release en `v0.0.1-tech-preview` avec README clair « non dogfoodable, démo UI uniquement ». Tag `v0.1.0` après fix. Moins honnête pour les early adopters — pas recommandé.

**Ma reco : Option A avec sous-option (i)** (init DB côté renderer). C'est la décision W0 qui n'a pas été exécutée. L'exécuter maintenant évite de refaire le CRUD en Rust.

## Fichiers essentiels

- `apps/desktop/src-tauri/src/lib.rs` — le registre des commandes (le gap central)
- `apps/desktop/src-tauri/src/commands/cycle.rs` — les stubs `Ok(())` à remplacer
- `apps/desktop/src-tauri/src/commands/state.rs` — l'unique SQLite Rust (numbering seulement)
- `apps/desktop/src-tauri/Cargo.toml` — plugins manquants fs/path/dialog
- `apps/desktop/src/main.tsx` — point d'entrée pour init DB renderer
- `packages/db/src/queries/` — queries Drizzle complètes, prêtes à être appelées
- `packages/db/src/adapter.ts` — fonction `createDb()` jamais appelée
- `packages/shared/src/ipc/commands.ts` — catalogue des 30+ commandes attendues (comparer avec `lib.rs`)
