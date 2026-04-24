# FAKT — Couverture E2E des workflows utilisateur

**Version :** 1.0
**Date :** 2026-04-24
**Cible :** Suite Playwright exhaustive sur l'application Tauri 2 FAKT (desktop)
**Public :** Agent / développeur qui implémentera les tests E2E sans connaissance préalable du projet

---

## Objectif du document

Ce document est la **spec canonique** de tous les flows utilisateur de FAKT. Il liste chaque workflow avec préconditions, étapes, assertions et edge cases. Il doit permettre à un développeur Playwright de générer l'intégralité de la suite E2E sans relire le code métier.

### Comment l'utiliser pour générer les tests Playwright

1. **Partir des fixtures (Annexe A)** : préparer les jeux de données à réinjecter en DB avant chaque scénario.
2. **Un workflow = un test Playwright** (`test("nom", async ({ page }) => {…})`). Grouper les workflows du même domaine dans un `test.describe()`.
3. **Utiliser en priorité les `data-testid`** documentés dans le code : `new-quote-menu`, `new-quote-ai`, `signature-submit`, `mark-paid-confirm`, `quote-total`, etc.
4. **Désactiver le sidecar dans les tests web-only** (si mode mock), ou **spawn Tauri webview réel** (mode intégration complet) — les deux modes sont valables selon le workflow.
5. **Reset DB entre tests** via `DELETE FROM …` ou snapshot SQLite avant/après, pour garantir une numérotation séquentielle propre.
6. **Assertions PDF** : vérifier l'existence du blob, sa mime-type, puis faire un `expect(pdfBytes.byteLength).toBeGreaterThan(500)` — éviter de parser le PDF en test, sauf cas CGI (mentions légales obligatoires).
7. **Timestamps déterministes** : forcer `Date.now()` via injection Playwright `page.clock.install({ time: new Date("2026-04-24T10:00:00Z") })` pour éviter la flakiness sur les dates d'émission, d'échéance, etc.

### Stack cible (rappel)

- Tauri 2 (Rust + webview React)
- Monorepo Bun workspaces
- SQLite solo + Drizzle ORM
- Sidecar Bun+Hono (`packages/api-server`)
- React 19 + Vite + Tailwind v4 + design system Brutal Invoice
- IA : Claude Code CLI en subprocess
- Signature : PAdES B-T maison en Rust

---

## Table des matières

- [1. Onboarding (wizard 4 étapes)](#1-onboarding-wizard-4-etapes)
- [2. Navigation, raccourcis clavier et recherche globale](#2-navigation-raccourcis-clavier-et-recherche-globale)
- [3. Settings — identité, CLI, sessions IA, certificat, télémétrie](#3-settings--identite-cli-sessions-ia-certificat-telemetrie)
- [4. Clients (CRUD + archive)](#4-clients-crud--archive)
- [5. Prestations (bibliothèque + tags)](#5-prestations-bibliotheque--tags)
- [6. Devis — création manuelle](#6-devis--creation-manuelle)
- [7. Devis — création par IA](#7-devis--creation-par-ia)
- [8. Devis — liste, détail, édition, duplication](#8-devis--liste-detail-edition-duplication)
- [9. Devis — transitions de statut (draft/sent/signed/refused/expired/invoiced)](#9-devis--transitions-de-statut)
- [10. Factures — création from-quote (acompte 30 %, solde, total)](#10-factures--creation-from-quote)
- [11. Factures — création from-scratch (indépendante)](#11-factures--creation-from-scratch-independante)
- [12. Factures — liste, détail, édition, paiement, annulation](#12-factures--liste-detail-edition-paiement-annulation)
- [13. Signature électronique PAdES (dessin ou typo)](#13-signature-electronique-pades-dessin-ou-typo)
- [14. Vérification d'une signature (/signatures/:id/verify)](#14-verification-dune-signature-signaturesidverify)
- [15. Email — préparation d'un draft (.eml + mailto fallback)](#15-email--preparation-dun-draft-eml--mailto-fallback)
- [16. Dashboard — KPI, pipeline, activité, suggestions](#16-dashboard--kpi-pipeline-activite-suggestions)
- [17. Archive — export ZIP workspace (conformité 10 ans)](#17-archive--export-zip-workspace-conformite-10-ans)
- [18. Composer IA latéral (Ctrl+/) — chat contextuel](#18-composer-ia-lateral-ctrl--chat-contextuel)
- [19. Numérotation séquentielle & obligations légales FR](#19-numerotation-sequentielle--obligations-legales-fr)
- [20. Robustesse — crashs, réseau down, Claude CLI absent](#20-robustesse--crashs-reseau-down-claude-cli-absent)
- [Checklist récapitulative](#checklist-recapitulative)
- [Annexe A — Fixtures de test](#annexe-a--fixtures-de-test)
- [Annexe B — Sélecteurs data-testid](#annexe-b--selecteurs-data-testid)
- [Annexe C — Matrice des transitions de statut](#annexe-c--matrice-des-transitions-de-statut)

---

## 1. Onboarding (wizard 4 étapes)

Le wizard d'onboarding s'affiche au premier lancement de FAKT, ou chaque fois que `setup_state.completed_at IS NULL` dans la DB locale. Il comprend 4 étapes : Identité → Claude CLI → Certificat → Récap. Le bouton "Terminer" persiste le workspace via l'API sidecar, marque `setup_completed` via la commande Tauri `complete_setup`, puis force `window.location.href = "/"`.

### 1.1 Workflow — Onboarding nominal complet (happy path)

**Préconditions**
- DB vide (aucune row `workspaces`, `setup_state.completed_at = NULL`)
- Sidecar Bun+Hono joignable
- Claude CLI absent OU présent (les deux chemins couverts dans sous-workflows)
- Certificat OS : keychain accessible (Windows Credential Manager / macOS Keychain / libsecret Linux)

**Étapes**
1. Lancer FAKT. L'app redirige automatiquement de `/` vers `/onboarding` (useOnboardingGuard).
2. Vérifier l'affichage du header "FAKT" + logo + 4 étapes dans la progress bar ("Identité / Claude CLI / Certificat / Récap"), step 1 actif.
3. **Étape 1 — Identité** : saisir `name="Atelier Mercier"`, `legalForm="Micro-entreprise"`, `siret="85366584200029"` (valide Luhn), `address="12 rue de la République\n13001 Marseille"`, `email="contact@atelier-mercier.fr"`, `phone="0612345678"`, `iban="FR7630006000011234567890189"`.
4. Cliquer "Suivant". Le bouton doit être `disabled` tant que `isValid === false`.
5. **Étape 2 — Claude CLI** : au mount, un healthCheck est lancé automatiquement. Deux branches :
   - Si CLI détecté : afficher "✓ Détecté — v…" + version + path. Bouton "Suivant" actif.
   - Si CLI absent : case à cocher "Passer cette étape" doit permettre de continuer (`canProceed = skipped || installed`).
6. Cliquer "Suivant".
7. **Étape 3 — Certificat** : cliquer "Générer certificat auto-signé". Le Rust `generate_cert` est invoqué avec `{common_name, organization, country: "FR", email}`.
8. Attendre l'apparition du bloc "✓ Certificat généré" avec `DN`, `Empreinte SHA-256`, `Validité (notBefore — notAfter)`, stockage (`keychain` ou `fallback-file`).
9. Cliquer "Suivant".
10. **Étape 4 — Récap** : vérifier les 3 cards "Identité / CLI / Certificat" avec statut OK (badge `✓`).
11. Cliquer "Terminer l'onboarding".
12. L'app appelle `api.workspace.create` (ou `update` si existant), puis `invoke("complete_setup")`, puis `window.location.href = "/"`.

**Assertions**
- Après "Terminer", l'URL devient `/` (dashboard) et le wizard n'apparaît plus sur les relances.
- La DB contient une row `workspaces` avec les valeurs saisies (SIRET normalisé sans espaces : `"85366584200029"`).
- `setup_state.completed_at IS NOT NULL`.
- Un certificat X.509 est stocké dans le keychain OS (ou fichier de fallback chiffré en dev).
- Si Claude CLI skipped : `cli_skipped = true` en state context (pas persisté DB côté v0.1).

**Edge cases à tester**
- Onboarding lancé alors que le workspace existe déjà (reprise après crash) : les champs de l'étape 1 doivent être **pré-remplis** depuis `api.workspace.get()`. Cf. `Identity.tsx:43-73`.
- Double-clic sur "Terminer" : guard synchrone `if (saving) return` doit empêcher le double POST et double création de workspace.
- Workspace déjà créé mais `setup_completed` pas flag (bug race condition) : l'appel POST doit trap `ApiError.CONFLICT` et retenter un PATCH. Cf. `Recap.tsx:persistWorkspace`.

### 1.2 Workflow — SIRET invalide pédagogique (Luhn-KO)

**Préconditions** : DB vide.

**Étapes**
1. Accéder à l'onboarding, étape 1.
2. Saisir `siret="12345678901234"` (14 chiffres mais Luhn invalide).
3. Quitter le focus du champ SIRET (blur).

**Assertions**
- Le composant `SiretChecker` s'affiche (test-id `siret-checker`) avec :
  - ✓ "14 chiffres"
  - ✓ "Que des chiffres"
  - ✗ "Clé de sécurité incorrecte"
- Le hint sous le champ indique "SIRET invalide (clé Luhn incorrecte)".
- Le bouton "Suivant" reste `disabled`.

**Edge cases**
- Saisir `siret="732 829 320 00074"` avec espaces : normalisation via `normalizeSiret()` doit valider (espaces retirés).
- Exception La Poste (`35600000000048`) : Luhn échoue mais `isLaPosteException === true` → doit valider quand même.
- Saisir 13 chiffres : LengthCheck ✗ "14 chiffres — vous en avez 13".
- Saisir `abcde12345` : DigitsCheck ✗ "Un SIRET ne contient que des chiffres".
- Saisir chaîne vide : pas d'affichage du SiretChecker (`issue === "empty"`).

### 1.3 Workflow — IBAN optionnel invalide

**Étapes**
1. Étape 1, saisir tous les champs valides sauf `iban="FR76ABC"`.
2. Blur le champ IBAN.

**Assertions**
- Hint : "IBAN France invalide (format FR76…, 27 caractères)".
- Bouton "Suivant" disabled.
- Si IBAN laissé **vide** : OK, le champ est optionnel (`z.string().optional()`).

### 1.4 Workflow — Génération certificat en échec keychain

**Préconditions** : mock `invokeCertGenerate` pour retourner une erreur "keychain inaccessible".

**Étapes**
1. Atteindre l'étape 3.
2. Cliquer "Générer".

**Assertions**
- Un toast d'erreur s'affiche avec le message keychain (`fr.errors.keychainError`).
- Le bouton "Suivant" reste disabled tant que `certInfo === null`.
- Possibilité de retry via le bouton "Réessayer".

### 1.5 Workflow — Retour en arrière dans le wizard

**Étapes**
1. Avancer jusqu'à l'étape 4.
2. Cliquer "Précédent" jusqu'à l'étape 1.
3. Vérifier que les valeurs saisies sont toujours présentes (state context).
4. Modifier un champ puis ré-avancer.

**Assertions**
- Les valeurs du form sont **conservées** via le `OnboardingContext.state.identity`.
- Les vérifications CLI et cert ne sont pas relancées inutilement si déjà faites (mais on peut re-run via "Réessayer").

---

## 2. Navigation, raccourcis clavier et recherche globale

Le shell FAKT est composé d'une sidebar (à gauche, 232px), d'une topbar (56px) et d'une zone main (React Router). La topbar expose le bouton Composer IA (Ctrl+/) et la barre de recherche globale (Cmd/Ctrl+K).

### 2.1 Workflow — Navigation sidebar entre les 6 sections

**Préconditions** : onboarding terminé, workspace créé.

**Étapes**
1. Depuis `/`, cliquer "Devis" dans la sidebar.
2. Cliquer "Factures".
3. Cliquer "Clients".
4. Cliquer "Prestations".
5. Cliquer "Archive".
6. Cliquer "Tableau de bord" pour revenir.
7. Cliquer "Paramètres" dans le footer de la sidebar.

**Assertions**
- URL change à chaque clic : `/`, `/quotes`, `/invoices`, `/clients`, `/services`, `/archive`, `/settings`.
- L'item actif dans la sidebar a le style inversé (`background: var(--ink), color: var(--surface)`).
- Le titre dans la topbar change (Tableau de bord / Devis / Factures / …).

### 2.2 Workflow — Command Palette (Cmd/Ctrl+K)

**Étapes**
1. Depuis n'importe quelle page, presser `Cmd+K` (macOS) ou `Ctrl+K` (Windows/Linux).
2. Vérifier l'ouverture de la modale `CommandPalette` (rendu par `@fakt/ui`).
3. Saisir "dashboard" — la liste doit filtrer en live.
4. Appuyer sur `Entrée` pour sélectionner le premier résultat.
5. Ré-ouvrir avec `Ctrl+K`, taper le nom d'un client existant, sélectionner.

**Assertions**
- La palette s'ouvre/ferme via `Ctrl+K` (toggle).
- Les items incluent au minimum les routes principales + les documents (devis/factures) + les clients.
- La navigation se fait sur sélection (navigate + close).
- Log console `[CommandPalette] time-to-select: Xms` si > 100ms.

### 2.3 Workflow — Raccourci "Nouveau devis" (Cmd+N)

**Étapes**
1. Depuis `/`, presser `Cmd+N` (ou `Ctrl+N`).

**Assertions**
- URL = `/quotes/new?mode=manual`.

### 2.4 Workflow — Raccourci "Nouvelle facture" (Cmd+Shift+N)

**Étapes**
1. Depuis `/`, presser `Cmd+Shift+N`.

**Assertions**
- URL = `/invoices/new`.

### 2.5 Workflow — Raccourci "Toggle Composer IA" (Cmd+/)

**Étapes**
1. Presser `Cmd+/`.
2. Vérifier l'apparition de la sidebar Composer (testid `composer-sidebar`, fixed right 400px).
3. Re-presser `Cmd+/` pour fermer.

**Assertions**
- Le panneau apparaît/disparaît.
- Le bouton topbar `topbar-composer-toggle` change d'état visuel (background inversé).

### 2.6 Workflow — Raccourci "?" affiche overlay aide

**Étapes**
1. Presser `?` (sans modifier).

**Assertions**
- L'overlay `ShortcutsOverlay` s'affiche avec la liste des 4 raccourcis.
- Re-presser `?` ferme l'overlay.

### 2.7 Workflow — URL 404

**Étapes**
1. Naviguer vers `/does-not-exist`.

**Assertions**
- Affichage du placeholder "404 — Page introuvable".
- La sidebar et topbar restent visibles.

---

## 3. Settings — identité, CLI, sessions IA, certificat, télémétrie

Les paramètres sont organisés en 5 onglets accessibles via `/settings`.

### 3.1 Workflow — Modifier l'identité workspace

**Préconditions** : workspace créé via onboarding.

**Étapes**
1. Aller sur `/settings`, onglet "Identité" sélectionné par défaut.
2. Modifier `name="Atelier Mercier SARL"`.
3. Cliquer "Enregistrer".

**Assertions**
- Toast "Paramètres enregistrés".
- `PATCH /api/workspace` appelé avec la nouvelle valeur.
- En rechargeant `/settings`, la valeur est persistée.
- Bouton "Enregistrer" disabled tant que `isDirty === false`.

**Edge cases**
- SIRET invalide → hint erreur, pas de PATCH.
- Double-clic "Enregistrer" → guard `saving` empêche le double POST.

### 3.2 Workflow — Onglet Claude CLI : recheck

**Étapes**
1. Aller sur `/settings`, onglet "Claude CLI".
2. Cliquer "Revérifier".

**Assertions**
- Badge status passe par "Vérification…" → "Détecté — v1.2.3" ou "Manquant".
- Si manquant, bouton "Ouvrir la page d'installation" ouvre `https://claude.ai/code` dans un nouveau onglet.
- Bouton "Documentation" ouvre `https://docs.anthropic.com/en/docs/claude-code/overview`.

### 3.3 Workflow — Onglet Sessions IA : lister et effacer l'historique

**Préconditions** : avoir au moins une session IA (extract_quote ou chat) en historique.

**Étapes**
1. Aller sur `/settings`, onglet "Sessions IA".
2. Vérifier les 2 sections "Actives (N)" et "Historique (M)".
3. Cliquer sur une ligne de session pour ouvrir le détail (expanded).
4. Vérifier la présence du prompt_preview, response_text, tool_calls, raw_events.
5. Cliquer "Effacer l'historique".

**Assertions**
- `invoke("list_ai_sessions")` appelé au mount + auto-refresh toutes les 1500ms (testid `autoRefresh` checkbox).
- Clic ligne → `expandedIds` contient l'id.
- `invoke("clear_ai_sessions_history")` après confirmation.
- Les sessions actives (status=streaming/pending) sont **auto-expanded** et ont un shadow jaune `5px 5px 0 var(--accent)`.

### 3.4 Workflow — Onglet Certificat : régénération (rotate)

**Préconditions** : certificat existant généré lors de l'onboarding.

**Étapes**
1. Aller sur `/settings`, onglet "Certificat".
2. Vérifier l'affichage : DN, Empreinte SHA-256, Expiration ("2027-04-24 — dans 1 an 0 mois").
3. Cliquer "Régénérer" (bouton rouge `variant="danger"`).
4. Confirmer dans la modale de warning.

**Assertions**
- Modale `rotateWarningTitle` affichée, body avertit que les anciennes signatures resteront vérifiables via `cert_archive`.
- `invoke("rotate_cert", { args: { subject_dn, archive_previous: true } })`.
- Toast succès "Certificat régénéré avec succès".
- Le nouveau fingerprint s'affiche.

**Edge cases**
- Workspace null (NOT_FOUND) → bouton Rotate disabled.
- Keychain indisponible → toast erreur + rollback.

### 3.5 Workflow — Onglet Télémétrie : toggle opt-in

**Étapes**
1. Aller sur `/settings`, onglet "Télémétrie".
2. Cocher la checkbox "Activer la télémétrie anonyme".

**Assertions**
- `api.settings.set("telemetry_enabled", "true")` appelé.
- Toast "Télémétrie activée".
- Recharger la page : la checkbox reste cochée.

**Edge cases**
- Erreur API → rollback UI + toast `fr.errors.generic`.

### 3.6 Workflow — Onglet Télémétrie : version app affichée

**Étapes**
1. Onglet Télémétrie.

**Assertions**
- `APP_VERSION` affiché en mono (ex: `v0.1.0`).
- Boutons "Github Issues" et "Changelog" ouvrent les URLs correspondantes.

---

## 4. Clients (CRUD + archive)

Accessible via `/clients`. Hook `useClients` avec filtre `search` + `includeSoftDeleted`.

### 4.1 Workflow — Créer un client nominal

**Préconditions** : onboarding OK, DB vide côté clients.

**Étapes**
1. Aller sur `/clients`. Vérifier le message vide `fr.clients.empty`.
2. Cliquer "Nouveau client".
3. Saisir `name="Studio Kipling"`, `legalForm="SAS"`, `siret="73282932000074"`, `address="5 avenue Montaigne, 75008 Paris"`, `contactName="Jeanne Kipling"`, `email="jeanne@kipling.studio"`, `sector="design"`, `note="Prospect qualifié via LinkedIn"`.
4. Cliquer "Enregistrer".

**Assertions**
- `POST /api/clients` appelé avec le payload normalisé (SIRET sans espaces).
- La modale se ferme.
- Le client apparaît dans la table (`/clients`).
- Les colonnes affichées : Nom, Contact, Email, Statut, Créé le, Actions.

**Edge cases**
- Nom vide → erreur validation "Le nom est obligatoire".
- SIRET invalide Luhn → SiretChecker visible + blocage submit.
- Email malformé → erreur "Email invalide".
- Submit sans SIRET (optionnel) → OK.

### 4.2 Workflow — Rechercher un client

**Préconditions** : 3+ clients en DB.

**Étapes**
1. Aller sur `/clients`.
2. Saisir "kipling" dans le champ search.

**Assertions**
- La liste filtre en live (hook `useClients({ search })`).
- Le filtre matche sur `name`, `email`, `contactName`.
- Chip "Afficher la corbeille" inactive par défaut.

### 4.3 Workflow — Voir le détail d'un client (modale)

**Étapes**
1. Cliquer sur une row dans la table.

**Assertions**
- Modale `ClientDetail` s'ouvre avec :
  - Infos client (legalForm, siret, contactName, email, sector, address, note)
  - Devis liés (max 5) avec `number`, `title`, `totalHtCents`, `StatusPill`.
  - Factures liées (max 5) avec en plus la due date.
- Footer : "Archiver" (danger), "Fermer", "Modifier".

### 4.4 Workflow — Modifier un client depuis le détail

**Étapes**
1. Ouvrir le détail d'un client.
2. Cliquer "Modifier".
3. La modale Detail se ferme, la modale Form s'ouvre pré-remplie.
4. Modifier `email`, cliquer "Enregistrer".

**Assertions**
- `PATCH /api/clients/:id` avec la nouvelle valeur.
- Toast ou refresh liste.

### 4.5 Workflow — Archiver un client (soft delete)

**Étapes**
1. Ouvrir le détail d'un client.
2. Cliquer "Archiver".

**Assertions**
- `DELETE /api/clients/:id` (soft delete, `archivedAt = now`).
- Le client disparaît de la liste principale.
- Il réapparaît avec le StatusPill "Archivé" quand on clique "Afficher la corbeille".

### 4.6 Workflow — Restaurer un client archivé

**Étapes**
1. Activer "Afficher la corbeille".
2. Cliquer "Restaurer" sur un client archivé.

**Assertions**
- `POST /api/clients/:id/restore` (ou équivalent).
- Le client retourne dans la liste active.

### 4.7 Workflow — Tri colonnes

**Étapes**
1. Cliquer sur l'en-tête "Nom" pour trier ASC, re-cliquer pour DESC.
2. Idem avec "Contact", "Email", "Créé le".

**Assertions**
- La table se réordonne via `sortValue`.
- Les colonnes `sortable: true` seulement.

---

## 5. Prestations (bibliothèque + tags)

Accessible via `/services`. Les prestations sont la bibliothèque réutilisable pour pré-remplir les items de devis/factures.

### 5.1 Workflow — Créer une prestation avec tags

**Étapes**
1. Aller sur `/services`, cliquer "Nouvelle prestation".
2. Saisir `name="Développement React"`, `description="Composants TSX typés, tests Vitest"`, `unit="jour"`, `unitPrice="750"` (€).
3. Cliquer sur les tags "dev" et "web".
4. Cliquer "Enregistrer".

**Assertions**
- `POST /api/services` avec `unitPriceCents=75000` (€ × 100).
- Tags stockés en array JSON `["dev", "web"]`.
- La prestation apparaît dans la table avec son prix en mono `750,00 €`.
- Les chips tags s'affichent dans la colonne "Tags" (max 3 visibles, surplus en chip "+N").

**Edge cases**
- Prix négatif → validation zod `nonnegative` refuse.
- Prix non-entier en centimes (ex: `0.5` €) → `Math.round(0.5 × 100) = 50` centimes OK.
- Aucun tag sélectionné → `tags = null`.

### 5.2 Workflow — Rechercher/filtrer prestations

**Étapes**
1. Saisir "react" dans la search bar.

**Assertions**
- Filtre live sur name/description.

### 5.3 Workflow — Archiver et restaurer une prestation

**Étapes**
1. Cliquer "Archiver" sur une row.
2. Activer "Afficher la corbeille".
3. Cliquer "Restaurer".

**Assertions** : identiques à Clients (soft delete).

### 5.4 Workflow — Modifier unité et prix d'une prestation existante

**Étapes**
1. Cliquer sur une row pour ouvrir la modale en mode édition.
2. Changer `unit="jour"` → `unit="heure"`, `unitPrice="100"`.
3. "Enregistrer".

**Assertions**
- `PATCH /api/services/:id` appelé.
- La row met à jour les colonnes unité et prix.

---

## 6. Devis — création manuelle

Route : `/quotes/new?mode=manual`.

### 6.1 Workflow — Créer un devis brouillon (draft, sans numéro)

**Préconditions** : au moins 1 client, 1 prestation.

**Étapes**
1. Depuis `/quotes`, cliquer "Nouveau" → "Manuel" (menu déroulant testid `new-quote-menu` → `new-quote-manual`).
2. Sélectionner un client via `ClientPicker`.
3. Saisir `title="Refonte site vitrine"`.
4. La date d'émission est pré-remplie à `today()`.
5. Changer `validityDays=45` (nombre). La date de validité doit se recalculer (testid `validity-date-display`).
6. Cliquer "Ajouter une ligne".
7. Sélectionner une prestation existante via le picker ou remplir manuellement : `description="Dev frontend"`, `quantity=5` (jours), `unitPrice=750€`, `unit="jour"`.
8. Le `lineTotalCents` se calcule : 5 × 750 × 100 = 375000¢.
9. Le `quote-total` affiche 3 750,00 €.
10. Saisir des notes optionnelles.
11. Cliquer "Enregistrer en brouillon" (testid `save-draft`).

**Assertions**
- `POST /api/quotes` appelé avec `issueNumber=false`.
- Redirection vers `/quotes/:id`.
- Le devis a `status=draft`, `number=null`.
- Le bouton "Émettre" sera disponible depuis le détail.

**Edge cases**
- Titre vide → erreur alert `fr.quotes.errors.missingTitle`.
- Pas de client → erreur alert `fr.quotes.errors.missingClient`.
- Aucun item → erreur alert `fr.quotes.errors.noItems`.
- Double-clic "Enregistrer" → guard synchrone.
- Item sans prestation liée (`serviceId=null`) → OK, ajout manuel.

### 6.2 Workflow — Créer un devis et l'émettre immédiatement (attribue un numéro)

**Étapes**
1. Remplir le formulaire comme ci-dessus.
2. Cliquer "Créer et émettre" (testid `create-and-issue`).

**Assertions**
- `POST /api/quotes` avec `issueNumber=true`.
- Le backend appelle `nextNumberAtomic()` pour allouer un numéro séquentiel type `D2026-001` (cf. `nextNumberAtomic` + `issueQuote` en SQLite BEGIN IMMEDIATE).
- `status=draft` (le devis n'est pas "sent", juste numéroté).
- Le PDF se génère en live dans le détail via `pdfApi.renderQuote`.

### 6.3 Workflow — QuickClientModal depuis le formulaire

**Étapes**
1. Depuis le formulaire devis, cliquer "Créer rapidement" dans `ClientPicker`.
2. Saisir `name="Nouveau Client"`, `email="x@y.fr"`, `siret="73282932000074"`.
3. "Enregistrer".

**Assertions**
- `POST /api/clients` appelé.
- Le client est sélectionné automatiquement dans le picker (`setValues({ clientId: created.id })`).
- La modale se ferme.

### 6.4 Workflow — Modifier la date d'émission recalcule la validité

**Étapes**
1. Dans un formulaire devis neuf, changer `issuedAt=2026-06-15`.

**Assertions**
- `validityDate` passe à `issuedAt + validityDays` = 2026-07-30 (si 45 jours).
- L'affichage mono FR-FR au format long.

---

## 7. Devis — création par IA

Route : `/quotes/new?mode=ai`. Utilise subprocess Claude CLI via `@fakt/ai.getAi().extractQuoteFromBrief()`.

### 7.1 Workflow — Extraction IA depuis un brief libre

**Préconditions** : Claude CLI installé et fonctionnel.

**Étapes**
1. Depuis `/quotes`, "Nouveau" → "IA" (testid `new-quote-ai`).
2. Vérifier que la zone `ai-brief` (textarea) est visible.
3. Saisir un brief :
   ```
   Client : Studio Kipling (jeanne@kipling.studio).
   Mission : refonte vitrine WordPress → React.
   Livraison : 3 semaines, dispo dès lundi.
   Estimatif : 10 jours de dev à 750€/j, 3 jours design à 600€/j.
   ```
4. Cliquer "Extraire" (testid `ai-extract`).

**Assertions**
- Bouton devient "Annuler" (testid `ai-cancel`) pendant streaming.
- Un bloc `ai-loading` apparaît ("Extraction en cours…").
- À chaque event `delta`, l'UI se met à jour progressivement.
- À event `done`, le bloc `ai-extracted` s'affiche avec :
  - Client extrait : nom + email
  - Items avec description, quantity, unit, unitPrice
  - Total (testid `ai-extracted-total`) en mono € FR.
- Bouton "Appliquer et éditer" (testid `ai-apply`).

### 7.2 Workflow — Appliquer l'extraction dans le formulaire

**Étapes**
1. Après extraction OK, cliquer "Appliquer et éditer".

**Assertions**
- Le formulaire standard `QuoteForm` s'affiche préremplement :
  - `title = "Devis — Studio Kipling"` (ou le title extrait)
  - `items` mappés avec `quantity × 1000` (millièmes) et `unitPriceCents = unitPrice × 100`
  - `validityDate` = `extracted.validUntil` ou `today() + 30j`
  - `notes` = `extracted.notes`
- Le client n'est PAS pré-sélectionné (l'utilisateur doit choisir dans la liste ou créer via QuickClient).

### 7.3 Workflow — Annuler pendant le streaming

**Étapes**
1. Lancer l'extraction.
2. Avant `done`, cliquer "Annuler" (testid `ai-cancel`).

**Assertions**
- `AbortController.abort()` appelé.
- L'extraction s'arrête, `extracted` reste partiel ou `null`.
- Le bouton redevient "Extraire".

### 7.4 Workflow — Claude CLI absent bloque le mode IA

**Préconditions** : `getAi().healthCheck() → { installed: false }`.

**Étapes**
1. Aller sur `/quotes/new?mode=ai`.

**Assertions**
- Le bloc `ai-cli-missing` (testid) s'affiche avec titre "Claude CLI introuvable".
- 2 boutons : "Aller aux paramètres" (→ `/settings`) et "Passer en manuel" (→ `/quotes/new?mode=manual`).
- La textarea brief n'apparaît pas.

### 7.5 Workflow — Erreur streaming IA

**Étapes**
1. Mock `provider.extractQuoteFromBrief` pour yield `{ type: "error", message: "…" }`.
2. Lancer extract.

**Assertions**
- Le bloc `ai-error` (testid) affiche le message en fond danger.
- Si message contient "cli" ou "claude", `cliMissing` passe à true au prochain mount.

---

## 8. Devis — liste, détail, édition, duplication

Route liste : `/quotes`. Route détail : `/quotes/:id`. Route édition : `/quotes/:id/edit`.

### 8.1 Workflow — Liste des devis avec filtres chips

**Préconditions** : 5+ devis dans divers statuts.

**Étapes**
1. Aller sur `/quotes`.
2. Cliquer les chips filter : "Tous / Brouillons / Émis / Signés / Facturés / Refusés / Expirés".

**Assertions**
- URL change avec `?status=draft` etc (testid `status-filter-draft`).
- La table filtre en conséquence.
- Le compteur dans le header (`quotes-count`) affiche `N devis · TOTAL €` (toujours sur la liste non filtrée).

### 8.2 Workflow — Recherche texte dans les devis

**Étapes**
1. Saisir "refonte" dans la search (testid `quotes-search`).

**Assertions**
- Filtre sur `number`, `notes`, `title`, client.name.
- URL query `?q=refonte`.

### 8.3 Workflow — Filtre par client et plage de dates

**Étapes**
1. Ouvrir le select `client-filter`, choisir un client.
2. Saisir `from=2026-01-01`, `to=2026-12-31` (testids `date-from-filter`, `date-to-filter`).
3. Cliquer "Tout effacer" (testid `clear-filters`).

**Assertions**
- URL query `?client=UUID&from=…&to=…`.
- Clic "Tout effacer" → tous les query params supprimés.

### 8.4 Workflow — Trier par colonne

**Étapes**
1. Cliquer en-tête "Numéro" (ASC/DESC), "Client", "Total HT", "Statut", "Créé le".

**Assertions**
- Tri applique `sortValue` correspondant.

### 8.5 Workflow — Ouvrir le détail d'un devis

**Étapes**
1. Cliquer sur une row dans la liste.

**Assertions**
- URL devient `/quotes/:id`.
- Affichage : header avec numéro + status pill + title.
- Preview PDF (iframe testid `pdf-iframe`) si `number !== null` et `issuedAt !== null`.
- Placeholder `pdf-placeholder` sinon (message `noPdfDraft` ou `noPdf`).
- Sidebar infos : numéro, client, total HT, date émission, date validité, date création, date signature.
- Mention TVA micro-entreprise (`TVA_MENTION_MICRO`).
- `AuditTimeline` avec au moins l'event "Créé le".
- Boutons contextuels selon status (cf. §9).

### 8.6 Workflow — Édition d'un devis draft

**Étapes**
1. Depuis un devis en `status=draft`, cliquer "Modifier" (testid `detail-edit`).
2. Modifier title/items.
3. "Enregistrer en brouillon".

**Assertions**
- URL `/quotes/:id/edit`.
- Le bouton "Créer et émettre" n'apparaît PAS en mode édition (`editMode`).
- `PATCH /api/quotes/:id`.
- Redirection vers `/quotes/:id`.

**Edge cases**
- Si le devis est non-draft (sent/signed/...), useEffect guard redirige automatiquement vers `/quotes/:id` avec `data-testid="edit-not-found"` ou blocage similaire.

### 8.7 Workflow — Dupliquer un devis

**Étapes**
1. Depuis la liste, cliquer l'action chip "Dupliquer" (testid `dup-{id}`).

**Assertions**
- `POST /api/quotes` avec `title="{original} (copie)"`, `issueNumber=false`, mêmes items.
- La nouvelle row apparaît en haut de la liste avec `status=draft`, `number=null`.
- `refresh()` sur la liste.

### 8.8 Workflow — Télécharger le PDF d'un devis émis

**Étapes**
1. Depuis un devis `status=sent` (numéroté), cliquer "Télécharger PDF" (testid `detail-download`).

**Assertions**
- `pdfApi.renderQuote()` appelé côté front (subprocess Typst via Tauri).
- `pdfApi.saveDialog({filename: "Devis-D2026-001-studio-kipling.pdf"})` ouvre le dialogue OS save.
- `pdfApi.writeFile(path, bytes)` si l'utilisateur valide.

**Edge cases**
- Si `number === null` (draft), le bouton est disabled.
- Erreur Typst → state `pdfError` affiché.

### 8.9 Workflow — Zoom PDF preview

**Étapes**
1. Sur le détail, cliquer "Zoom +" / "Zoom -" / "Plein écran" dans la toolbar PDF.

**Assertions**
- Zoom DOM applique `iframe.contentWindow.document.body.style.zoom = "1.2"` ou `"0.8"`.
- "Plein écran" ouvre l'URL blob dans un nouvel onglet.

---

## 9. Devis — transitions de statut

États : `draft → sent → signed → invoiced`. Branches latérales : `draft/sent → refused/expired`.

### 9.1 Workflow — Transition draft → sent (bouton "Émettre")

**Préconditions** : devis `status=draft`, déjà numéroté (`number !== null`).

**Étapes**
1. Détail devis, cliquer "Émettre" (testid `detail-mark-sent`).
2. Modale de confirmation (testid `detail-mark-sent-confirm`).

**Assertions**
- `POST /api/quotes/:id/mark-sent` appelé (backend `markQuoteSent`).
- `status` passe à `sent`.
- Toast succès `fr.quotes.detail.markSentSuccess`.
- `refresh()` du détail.
- StatusPill passe à "Émis".
- `AuditTimeline` ajoute un event "Émis le".

**Edge cases**
- Double-clic "Confirmer" → guard `markSentSubmitting` évite le double POST (sinon 2 numéros séquentiels alloués, bug CGI).
- Devis non-numéroté → bouton "Émettre" disabled.
- Transition invalide (déjà sent) → backend retourne 422 INVALID_TRANSITION, UI affiche erreur.

### 9.2 Workflow — Transition sent → signed (via signature)

Couvert en §13. La transition est déclenchée par la signature PAdES qui appelle `quotesApi.updateStatus(id, "signed")`.

### 9.3 Workflow — Transition signed → invoiced (création facture from-quote "full")

Couvert en §10. Quand `mode="full"` + `issueNumber=true`, le backend passe le devis de `signed` à `invoiced`.

### 9.4 Workflow — Marquer un devis refusé (manuellement)

**Préconditions** : devis `status=sent` (ou `draft`).

**Étapes**
1. (Assumed UI) : depuis le détail, action "Marquer comme refusé" via menu actions (si exposé v0.1).
2. Ou via API directe `POST /api/quotes/:id/cancel`.

**Assertions**
- `status` passe à `refused`.
- StatusPill met à jour.

### 9.5 Workflow — Marquer un devis expiré

**Préconditions** : `validityDate < today()`, status `sent`.

**Étapes**
1. Appel `POST /api/quotes/:id/expire` (cron job ou manuel).

**Assertions**
- `status=expired`.
- Affichage StatusPill "Expiré".

---

## 10. Factures — création from-quote

Route : `/invoices/new?from=quote`. Trois modes : `deposit30`, `balance`, `full`.

### 10.1 Workflow — Acompte 30 % depuis un devis signé

**Préconditions** : un devis `status=signed` en DB avec `totalHtCents=3750000` (37 500 €).

**Étapes**
1. Aller sur `/invoices`, cliquer "Nouvelle" → "À partir d'un devis" (testid `new-invoice-from-quote`).
2. Sélectionner un devis dans le picker (testid `quote-picker`).
3. Cocher mode "Acompte 30 %" (testid `mode-radio-deposit30`).
4. Vérifier que les items s'auto-calculent : une ligne `description="Acompte 30% — Devis D2026-001"`, `quantity=1000` (1.000), `unitPriceCents = round(3750000 × 0.3) = 1125000`.
5. Ajuster `dueDate` à 30 jours via le champ.
6. Sélectionner `paymentMethod="wire"`.
7. Cliquer "Créer et émettre" (testid `invoice-create-and-issue`).

**Assertions**
- `POST /api/invoices/from-quote/:quoteId` avec `{mode: "deposit30", ...}`.
- Issue via `POST /api/invoices/:id/issue` → numéro `F2026-001`.
- Redirection `/invoices/:id`.
- `kind="deposit"`, `depositPercent=30`, `quoteId=<parent>`.

**Edge cases**
- Devis non-signé dans la liste : `noSignedQuote` (testid) affiché, liste vide.
- Double-clic "Créer et émettre" → guard `submitting`.

### 10.2 Workflow — Solde (balance) après un acompte

**Préconditions** : un devis signé avec déjà une facture `kind="deposit"` de 30 %.

**Étapes**
1. Sélectionner le devis dans le picker.
2. Cocher mode "Solde" (testid `mode-radio-balance`).
3. Vérifier l'auto-calcul : `balance = totalHtCents - sum(deposits) = 3750000 - 1125000 = 2625000` (26 250 €).
4. Créer et émettre.

**Assertions**
- La facture solde a `kind="balance"` et totalHtCents = 2 625 000 ¢.
- Cumul des factures du devis = totalHtCents du devis.

**Edge cases**
- Si `balance <= 0` (pas cohérent), backend `throw invalidTransition("balance is zero or negative")`.

### 10.3 Workflow — Total (full) passe le devis à invoiced

**Étapes**
1. Cocher mode "Total" (testid `mode-radio-full`).
2. Les items sont copiés tels quels du devis.
3. Créer et émettre.

**Assertions**
- Facture créée avec `kind="full"` (ou `independent`, dépend du backend ; cf. mapping).
- Le devis parent passe à `status=invoiced` (transition `signed → invoiced`).
- Redirection vers `/invoices/:id`.

### 10.4 Workflow — Facture non numérotée (save draft)

**Étapes**
1. Cocher un mode, remplir, cliquer "Enregistrer en brouillon" (testid `invoice-save-draft`).

**Assertions**
- `issueNumber=false`.
- Facture créée sans numéro, accessible en détail pour édition ultérieure.

### 10.5 Workflow — Pré-sélection via URL `?quoteId=<uuid>`

**Étapes**
1. Ouvrir `/invoices/new?quoteId=<uuid-devis-signé>`.

**Assertions**
- La section `quote-picker-section` n'est PAS visible (déjà présélectionné).
- Les modes s'affichent directement.

---

## 11. Factures — création from-scratch (indépendante)

Route : `/invoices/new?from=scratch`.

### 11.1 Workflow — Facture indépendante (hors devis)

**Étapes**
1. Depuis `/invoices`, "Nouvelle" → "À partir de zéro" (testid `new-invoice-from-scratch`).
2. Sélectionner un client.
3. Saisir `title="Prestation ponctuelle"`.
4. Ajouter des items via ItemsEditor.
5. Choisir `paymentMethod`, `dueDate`.
6. "Créer et émettre".

**Assertions**
- `POST /api/invoices` avec `kind="independent"`, `quoteId=null`.
- Mentions légales auto-injectées via `buildLegalMentionsSnapshot()` (TVA, pénalités, indemnité 40€).
- Redirection `/invoices/:id`.

**Edge cases**
- Facture à 0€ → backend refuse `POST /issue` (`totalHtCents doit être > 0`). Erreur INVALID_TRANSITION.
- Titre/client manquants → alert errors.

### 11.2 Workflow — Vérifier les mentions légales obligatoires visibles dans le form

**Étapes**
1. Section `legal-mentions-section` (testid).

**Assertions**
- Les 3 items de la liste existent :
  - `mention-tva` : "TVA non applicable, art. 293 B du CGI"
  - `mention-penalty` : "Pénalités de retard : 3× taux légal…"
  - `mention-lumpsum` : "Indemnité forfaitaire 40 € (art. D441-5)"

---

## 12. Factures — liste, détail, édition, paiement, annulation

Route liste : `/invoices`. Détail : `/invoices/:id`. Édition : `/invoices/:id/edit`.

### 12.1 Workflow — Filtres liste factures (chips statut + overdue)

**Étapes**
1. Aller sur `/invoices`.
2. Cliquer chip "En retard" (testid `invoice-status-filter-overdue`).

**Assertions**
- Le filtre calcule `isOverdue = status==="sent" && dueDate < today()`.
- URL query `?overdue=true`.
- Les factures matchent la condition.

### 12.2 Workflow — Recherche texte factures

Identique à 8.2 mais testid `invoices-search`, filtre sur `number`, `title`, `clientName`.

### 12.3 Workflow — Détail facture avec preview PDF

Identique à 8.5 mais testid `invoice-pdf-iframe` et actions différentes selon status.

### 12.4 Workflow — Marquer "Envoyée" (émettre numéro)

Identique à 9.1 mais testid `invoice-detail-mark-sent`, backend `POST /api/invoices/:id/mark-sent`.

### 12.5 Workflow — Marquer "Payée" (modale MarkPaidModal)

**Préconditions** : facture `status=sent` ou `overdue`.

**Étapes**
1. Détail facture, cliquer "Marquer comme payée" (testid `invoice-detail-mark-paid`).
2. Modale `MarkPaidModal` :
   - Saisir `dateIso` (testid `mark-paid-date`) — doit être ≤ today().
   - Choisir `method` (virement, CB, espèces, chèque, autre) (testid `mark-paid-method`).
   - Si `method=="other"`, saisir `customMethod` (testid `mark-paid-custom`).
   - Saisir `notes` optionnelles.
3. Cliquer "Confirmer" (testid `mark-paid-confirm`).

**Assertions**
- `POST /api/invoices/:id/mark-paid` avec payload `{ paidAt, method, notes }`.
- Mapping UI→DB : `"card"` → `"other"` (la DB accepte `wire|check|cash|other`).
- Status passe à `paid`, `paidAt = selected date`.
- Toast succès.
- `AuditTimeline` ajoute event "Payée le".

**Edge cases**
- Date future → validation zod custom `dateFuture`, field error.
- `method="other"` sans `customMethod` → field error `customMethodRequired`.
- Double-clic "Confirmer" → guard.
- Facture draft (pas sent) → backend refuse 422.

### 12.6 Workflow — Annuler une facture brouillon

**Préconditions** : facture `status=draft`.

**Étapes**
1. Détail facture, cliquer "Supprimer" (testid `invoice-detail-delete`).

**Assertions**
- `DELETE /api/invoices/:id` → 204.
- Redirection `/invoices`.

**Edge cases CRITIQUE (CGI art. 289)**
- Si `status !== "draft"` : backend refuse avec 409 CONFLICT "hard delete interdit… archivage légal 10 ans".
- UI affiche `invoice-delete-error` (testid) avec message `fr.invoices.detail.archivalLegalNotice`.
- Le bouton "Supprimer" n'apparaît QUE en status=draft.

### 12.7 Workflow — Annulation d'une facture émise → AVOIR requis

**Préconditions** : facture `status=sent|paid|overdue`.

**Étapes**
1. Tenter `POST /api/invoices/:id/cancel`.

**Assertions**
- Backend retourne 422 INVALID_TRANSITION avec message explicite "une facture émise ne peut pas être annulée — créer un avoir (facture d'avoir négative) conformément à CGI art. 289-I-4".

### 12.8 Workflow — Édition facture draft

**Étapes**
1. Depuis un détail facture draft, cliquer "Modifier" (testid `invoice-detail-edit`).
2. Modifier items/dates.
3. Enregistrer.

**Assertions**
- `PATCH /api/invoices/:id`.
- Si facture non-draft : page bloquée (testid `invoice-edit-blocked`) avec CTA "Créer un avoir" (stub v0.1, testid `invoice-edit-credit-note-stub` disabled).

### 12.9 Workflow — Télécharger PDF facture

Identique à 8.8 testid `invoice-detail-download`, filename `Facture-F2026-001-<client-slug>.pdf`.

### 12.10 Workflow — Marquer "En retard" automatiquement (cron simulation)

**Préconditions** : facture `status=sent`, `dueDate < today()`.

**Étapes**
1. Simuler l'appel `POST /api/invoices/:id/mark-overdue`.

**Assertions**
- `status=overdue`.
- StatusPill passe à "En retard".
- Sur la liste, un filtre "overdue" expose cette facture.

---

## 13. Signature électronique PAdES (dessin ou typo)

Modale `SignatureModal` (testid `signature-pane`). Applicable aux devis et factures.

### 13.1 Workflow — Signer un devis par dessin (mouse/touch)

**Préconditions** : devis `status=draft` ou `sent`, numéroté, PDF prérendu (`pdfBytes` non vide), certificat actif dans le keychain.

**Étapes**
1. Détail devis, cliquer "Signer" (testid `detail-sign`).
2. Modale s'ouvre avec onglet "Dessiner" actif par défaut (testid Tabs).
3. Dessiner la signature dans le canvas (simuler `pointerdown`/`pointermove`/`pointerup`).
4. Cocher la case "J'accepte que ma signature…" (testid `signature-ack`).
5. Cliquer "Signer" (testid `signature-submit`).

**Assertions**
- État passe de `preparing` ("Préparation…") → `signing` ("Horodatage TSA en cours…") → `success`.
- `signatureApi.listEvents(docType, docId)` d'abord pour récupérer le `previousEvent`.
- `signatureApi.sign(...)` appelle le command Tauri `sign_document` (Rust `crypto::sign_document`) avec :
  - PDF bytes + signature PNG
  - Cert depuis keychain
  - TSA call (freetsa.org par défaut)
- Retour `{ signatureEvent, signedPdf }`.
- `signatureApi.appendEvent(event)` → POST `/api/signature-events` avec le hash chain.
- `signatureApi.storeSignedPdf(type, id, bytes)` → stockage Tauri + POST `/api/signed-documents`.
- Toast succès "Document signé".
- `onSigned` callback : essaie `quotesApi.updateStatus(id, "signed")`, en fallback `sent → signed` en 2 étapes si draft.
- Modale se ferme, détail refresh, `StatusPill` passe à "Signé".

**Edge cases**
- Signature vide (canvas non touché) → field error `emptySignature`.
- Ack non coché → field error.
- Cert absent → erreur avec message contenant "cert" / "absent" → UI affiche `certMissingBody` + bouton CTA vers `/settings#certificate`.
- Erreur TSA réseau → retry affiché.
- Double-clic "Signer" → `disabled={submitting}`.
- Chain broken (previousEventHash ne chain pas avec prev.docHashAfter) → détecté côté verify, pas côté sign.

### 13.2 Workflow — Signer par typographie (saisie nom)

**Étapes**
1. Dans la modale, cliquer onglet "Taper" (Tabs testid).
2. Saisir le nom en texte.
3. La signature est rendue visuellement en SVG+canvas.
4. Cocher ack, signer.

**Assertions**
- `TypeSignature.toPngBytes()` génère un PNG du texte.
- Reste identique à 13.1.

**Edge cases**
- Texte vide → `isEmpty()` → field error.

### 13.3 Workflow — Signer une facture

Identique à 13.1 mais `docType="invoice"`, testid `invoice-detail-sign`. Après signature, si status=draft, transition automatique vers `sent` via fallback.

### 13.4 Workflow — Effacer la signature dessinée

**Étapes**
1. Dessiner, cliquer "Effacer" (testid `signature-clear`).

**Assertions**
- Canvas vide, field error clear.

### 13.5 Workflow — Annuler la modale de signature

**Étapes**
1. Ouvrir la modale, cliquer "Annuler" (testid `signature-cancel`) ou la cross.

**Assertions**
- Modale ferme, état reset.
- Si `submitting`, la fermeture est bloquée.

### 13.6 Workflow — Concurrence : 2 signatures simultanées

**Étapes**
1. Depuis 2 webviews (simulation), signer le même document.

**Assertions**
- Backend append-only : les 2 events s'ajoutent à la chain.
- Le hash chain doit rester cohérent (2e event.previousEventHash = sha256(event1)).

---

## 14. Vérification d'une signature (/signatures/:id/verify)

Route : `/signatures/:eventId/verify`. Report `integrity_ok`, `chain_ok`, `brokenChainIndices`.

### 14.1 Workflow — Vérifier une signature valide

**Préconditions** : un signature event existe pour un devis/facture.

**Étapes**
1. Depuis le détail d'un devis signé, dans `AuditTimeline` cliquer "Vérifier" (testid `audit-verify`) sur l'entrée signed.
2. URL devient `/signatures/:eventId/verify`.
3. Attendre le loading (testid `verify-loading`).

**Assertions**
- `signatureApi.verify(docId, eventId)` appelé.
- Affichage des 4 sections :
  - `verify-document` : type, numéro, signataire nom/email.
  - `verify-signature` : horodatage TSA, provider, algorithm, niveau PAdES-B-T + chip eIDAS.
  - `verify-integrity` : StatusPill "OK" (pill verte), `byteRangeHash`, `expectedHash`.
  - `verify-chain` : StatusPill "OK", chainLength, pas de brokenChainIndices.
- Bouton "Télécharger le PDF signé" (testid `verify-download`) fonctionne.
- Bouton "Retour au document" (testid `verify-back`) navigate vers le devis/facture.

### 14.2 Workflow — Chain cassée détectée

**Préconditions** : event avec `previousEventHash ≠ sha256(serialize(prev))`.

**Assertions**
- StatusPill chain "Rompue".
- `brokenChainIndices` non vide → affichage "indices cassés : 2, 5".

### 14.3 Workflow — Hash doc différent (altération PDF)

**Préconditions** : `docHashAfter` reçu par le verify ≠ hash recalculé du PDF en store.

**Assertions**
- `integrityOk=false`, StatusPill "Rompue" sur la section integrity.

### 14.4 Workflow — Eventid introuvable

**Préconditions** : URL avec eventId aléatoire.

**Étapes**
1. Accéder à `/signatures/00000000-0000-0000-0000-000000000000/verify`.

**Assertions**
- Erreur fetch → testid `verify-error` affiché avec message.

### 14.5 Workflow — Téléchargement PDF signé

**Étapes**
1. Sur la page verify, cliquer "Télécharger PDF signé".

**Assertions**
- `signatureApi.getSignedPdf(type, id)` retourne les bytes.
- Blob URL créée, anchor `<a download>` déclenche le téléchargement.
- Filename `signed-<type>-<uuid>.pdf`.

---

## 15. Email — préparation d'un draft (.eml + mailto fallback)

Modale `PrepareEmailModal`. Génère un `.eml` + ouvre via `open_email_draft` (Tauri command) avec fallback `mailto:`.

### 15.1 Workflow — Envoyer un devis émis en draft email

**Préconditions** : devis `status=sent` avec client ayant email.

**Étapes**
1. Détail devis, cliquer "Ouvrir dans ma messagerie" (testid `detail-prepare-email`).
2. Modale s'ouvre :
   - Template pré-sélectionné : `quote_sent` (testid `email-modal-template`).
   - `toEmail` pré-rempli avec `client.email`.
   - `subject` et `body` générés via `renderTemplate(quote_sent, ctx)`.
   - Attachment `D2026-001.pdf`.
3. Modifier éventuellement le body.
4. Cliquer "Ouvrir dans ma messagerie" (testid `email-modal-submit`).

**Assertions**
- `pdfApi.renderQuote` appelé pour obtenir les bytes PDF.
- `buildEml(...)` construit le contenu MIME/multipart avec attachment base64.
- Fichier `.eml` écrit dans `TempDir/fakt-drafts/<number>-<timestamp>.eml`.
- `invoke("open_email_draft", { emlPath })` appelle rundll32 (Windows) / open (macOS) / xdg-open (Linux).
- Toast succès `fr.email.success.draftOpened`.
- Activity log `email_drafted` best-effort.

### 15.2 Workflow — Fallback mailto: si pas de client mail par défaut

**Étapes**
1. Cocher "Utiliser mailto: direct" (testid `email-modal-mailto-toggle`).
2. Cliquer submit.

**Assertions**
- `buildMailtoUrl({ to, subject, body })` construit `mailto:...?subject=...&body=...`.
- `invoke("open_mailto_fallback", { url })` (validate `url.startsWith("mailto:")`).
- Toast `fr.email.success.mailtoOpened`.

### 15.3 Workflow — Erreur `open_email_draft` → fallback auto mailto

**Préconditions** : aucune app mail associée à `.eml`.

**Étapes**
1. Submit sans cocher mailto.

**Assertions**
- `invoke("open_email_draft")` échoue.
- Auto-fallback : `buildMailtoUrl` + `open_mailto_fallback`.
- Toast `fr.email.success.fallbackUsed`.
- Log activity avec `fallback: "mailto"`.

### 15.4 Workflow — Client sans email

**Préconditions** : client avec `email=null`.

**Étapes**
1. Ouvrir la modale.

**Assertions**
- Warning banner (`fr.email.warnings.noClientEmail`) visible en haut.
- Le champ `toEmail` est vide, utilisateur doit saisir.

### 15.5 Workflow — Validation form email

**Étapes**
1. Vider `toEmail`, submit.

**Assertions**
- Error `fr.email.errors.toRequired`.
- Idem pour subject vide et body vide.

### 15.6 Workflow — Template "reminder" pour facture overdue

**Préconditions** : facture `status=sent` avec `dueDate < today()` (donc overdue).

**Étapes**
1. Détail facture overdue, cliquer prepare email.

**Assertions**
- Le template pré-sélectionné est `reminder` (`defaultTemplate(invoice, "overdue")` → `"reminder"`).

### 15.7 Workflow — Template "thanks" pour facture paid

**Préconditions** : facture `status=paid`.

**Assertions**
- Template pré-sélectionné : `thanks`.

### 15.8 Workflow — Sécurité fichier `.eml`

**Préconditions** : tentative d'attaque symlink.

**Étapes**
1. Créer un symlink `/tmp/evil.eml → /etc/passwd`.
2. Appeler `invoke("open_email_draft", { emlPath: "/tmp/evil.eml" })`.

**Assertions**
- Le command Rust `open_email_draft` canonicalise le chemin, détecte que la cible n'est pas `.eml`, retourne erreur "Le chemin doit pointer vers un fichier .eml".

### 15.9 Workflow — Sécurité URL mailto

**Étapes**
1. `invoke("open_mailto_fallback", { url: "http://evil.com" })`.

**Assertions**
- Erreur "URL invalide : doit commencer par mailto:".

---

## 16. Dashboard — KPI, pipeline, activité, suggestions

Route : `/`. Affiche 4 KPI cards, pipeline, activité récente, suggestions IA.

### 16.1 Workflow — Affichage dashboard avec données

**Préconditions** : 5+ devis et factures en divers statuts.

**Étapes**
1. Aller sur `/`.

**Assertions**
- `testid=dashboard-root` visible.
- 4 KPIs (testid `dashboard-kpis`) :
  - `kpi-ca-emis` : somme des factures avec `issuedAt` dans le mois courant.
  - `kpi-ca-encaisse` : somme des factures `status=paid` avec `paidAt` dans le mois.
  - `kpi-devis-attente` : nombre + total des devis `status=sent`.
  - `kpi-factures-retard` : nombre + total des factures overdue.
- Pipeline (testid `dashboard-pipeline`) : 5 stages avec compteurs (draft/sent/signed/invoiced/paid).
- Activité récente (testid `widget-recent-activity`) : liste chronologique DESC, 20 entries max.
- Suggestions IA (testid `dashboard-suggestions`) : factures overdue > 7 jours, avec bouton "Rédiger relance".

### 16.2 Workflow — Clic KPI navigue vers la liste filtrée

**Étapes**
1. Cliquer `kpi-ca-encaisse`.

**Assertions**
- Navigate vers `/invoices?status=paid`.

### 16.3 Workflow — Clic pipeline stage

**Étapes**
1. Cliquer le stage "Signés".

**Assertions**
- Navigate vers `/quotes?status=signed` (ou `/invoices?status=paid` pour stage `paid`).

### 16.4 Workflow — Clic "Rédiger relance" ouvre le Composer avec contexte

**Étapes**
1. Cliquer "Rédiger relance" sur une facture overdue.

**Assertions**
- Composer sidebar s'ouvre avec `pendingContext` pré-rempli (docType, number, clientName, amount).
- Le `pendingMessage` est `fr.dashboard.suggestions.draftRelance`.

### 16.5 Workflow — Clic activity row navigate vers le doc

**Étapes**
1. Cliquer sur une entrée activité.

**Assertions**
- Navigate vers `/quotes/:id` ou `/invoices/:id`.

### 16.6 Workflow — Sparkline KPI CA

**Assertions**
- Les 2 KPIs CA ont un `Sparkline` (30 jours de data points).
- Valeurs calculées via `buildSparkline(invoices, 30, "issued"|"paid")`.

### 16.7 Workflow — Dashboard sans données

**Préconditions** : DB vide après onboarding.

**Assertions**
- KPIs à 0 €, 0 devis, 0 facture.
- Activité : message `fr.dashboard.widgets.recentActivityEmpty`.
- Suggestions : message `fr.dashboard.suggestions.empty`.

---

## 17. Archive — export ZIP workspace (conformité 10 ans)

Route : `/archive`. Génère un ZIP avec `clients.csv`, `prestations.csv`, `quotes/`, `invoices/`, `README.txt`.

### 17.1 Workflow — Export ZIP complet

**Préconditions** : 5+ devis numérotés, 5+ factures numérotées.

**Étapes**
1. Aller sur `/archive`.
2. Vérifier les 3 stat cards (devis émis, factures émises, taille estimée).
3. Cliquer "Exporter l'archive" (testid `archive-export-btn`).
4. Modale de confirmation avec body.
5. Cliquer "Confirmer" (testid `archive-confirm-export`).
6. Dialog OS `plugin:dialog|save` s'ouvre, choisir destination.
7. Attendre la progress bar (0 → 90 → 95 → 100).

**Assertions**
- Pour chaque devis : `pdfApi.renderQuote` → bytes, ajouté à `pdfs_quotes`.
- Idem factures.
- CSV clients/prestations générés via `buildClientsCsv` / `buildPrestationsCsv`.
- `invoke("build_workspace_zip", { payload, destPath })`.
- ZIP écrit sur disque, toast "Export ZIP OK : <path>".

**Edge cases**
- `destPath` sans extension `.zip` → Rust refuse.
- `destPath` dans `/etc`, `C:\Windows`, `C:\Program Files` → Rust refuse (système protégé).
- `entry.name` avec path traversal (`../../etc/passwd`) → sanitize à `passwd`.

### 17.2 Workflow — Table récente des docs archivables

**Étapes**
1. Sur `/archive`, vérifier la section "Archives récentes".

**Assertions**
- Table avec type (Devis/Facture), numéro, date émission.
- Max 15 lignes, triées DESC par `issuedAt`.

### 17.3 Workflow — ZIP vide (pas de documents)

**Préconditions** : onboarding OK mais aucun devis/facture numéroté.

**Assertions**
- Stats à 0.
- Table affiche message `fr.archive.empty`.
- L'export produit néanmoins un ZIP avec README + CSV vides.

---

## 18. Composer IA latéral (Ctrl+/) — chat contextuel

Composant `ComposerSidebar` (fixed right, 400px). Chat bidirectionnel avec Claude CLI.

### 18.1 Workflow — Ouvrir et envoyer un premier message

**Étapes**
1. Ouvrir le composer via `Ctrl+/` ou bouton topbar.
2. La textarea `composer-input` est auto-focus.
3. Saisir "Propose-moi un titre pour un devis refonte".
4. Presser `Entrée` (sans Shift).

**Assertions**
- Message user apparaît en bulle droite (testid `composer-msg-user`).
- Bulle assistant droite apparaît en streaming (testid `composer-msg-assistant`).
- `getAi().chat(history, { signal })` streamé → delta events → content s'étoffe progressivement.
- Indicateur blink de streaming à la fin de la bulle.
- À `done`, streaming=false, le blink disparaît.

### 18.2 Workflow — Contextualisation automatique sur détail doc

**Préconditions** : ouvrir le composer depuis `/quotes/:id`.

**Étapes**
1. Le Composer détecte l'URL via `useDocContextFromRoute`.

**Assertions**
- La context bar (jaune) affiche "Contexte actif : D<number>".
- `activeContext.docType === "quote"` est passé à `ai.chat(history, { context })`.

### 18.3 Workflow — Toggle context OFF

**Étapes**
1. Cliquer le bouton "DÉSACTIVER" dans la context bar.

**Assertions**
- Bar passe en gris papier, label "Contexte désactivé".
- Les prochains messages n'envoient pas le context.

### 18.4 Workflow — Suggestions chip (message zéro)

**Étapes**
1. Ouvrir le composer (pas de messages).
2. 3 suggestions chips visibles : "Relance…", "Ajouter dev…", "Résumer…".
3. Cliquer l'une d'elles.

**Assertions**
- Le message correspondant est envoyé (`sendMessage(s)`).
- Les suggestions disparaissent (conditional `messages.length === 0`).

### 18.5 Workflow — Annuler une réponse en streaming

**Étapes**
1. Envoyer un message.
2. Avant `done`, cliquer "Annuler" (testid `composer-cancel`).

**Assertions**
- `AbortController.abort()`.
- `streaming=false`.
- La bulle assistant garde le contenu partiel mais n'a plus le blink.

### 18.6 Workflow — Reset conversation

**Étapes**
1. Envoyer plusieurs messages.
2. Cliquer "Reset" (testid `composer-reset`).

**Assertions**
- `messages=[]`, input vide, abortRef.abort().

### 18.7 Workflow — Fermer le composer

**Étapes**
1. Cliquer le bouton "x" (testid `composer-close`) ou Ctrl+/.

**Assertions**
- `isOpen=false`, le panneau disparaît.

### 18.8 Workflow — Shift+Enter insère un retour ligne

**Étapes**
1. Dans la textarea, presser `Shift+Enter`.

**Assertions**
- Newline inséré, pas de submit.

### 18.9 Workflow — Erreur dans le stream

**Étapes**
1. Mock provider pour yield `{ type: "error", message: "API rate limit" }`.

**Assertions**
- La bulle assistant affiche "Erreur : API rate limit", `streaming=false`.

---

## 19. Numérotation séquentielle & obligations légales FR

Fonctionnalité critique CGI art. 289 : pas de trou, pas de doublon.

### 19.1 Workflow — Numéros devis séquentiels par année

**Préconditions** : nouveau workspace, aucun devis.

**Étapes**
1. Émettre 3 devis successivement.

**Assertions**
- Premier : `number="D2026-001"`.
- Deuxième : `D2026-002`.
- Troisième : `D2026-003`.
- `year=2026`, `sequence=1, 2, 3`.

### 19.2 Workflow — Numéros factures indépendants

**Assertions**
- Format `F2026-001`, `F2026-002`, etc.
- Unicité `(workspace_id, year, type, sequence)` enforced par UNIQUE DB.

### 19.3 Workflow — Année bascule au 1er janvier

**Préconditions** : dernier devis de 2025 = `D2025-042`.

**Étapes**
1. Émettre un devis avec `issuedAt = 2026-01-05`.

**Assertions**
- `number="D2026-001"` (reset année).

### 19.4 Workflow — Concurrency test : 2 émissions simultanées

**Préconditions** : 2 devis draft créés.

**Étapes**
1. Lancer 2 `POST /api/quotes/:id/issue` en parallèle.

**Assertions**
- Les 2 reçoivent un numéro distinct (001 et 002).
- Pas de trou, pas de doublon.
- `nextNumberAtomic` (BEGIN IMMEDIATE SQLite) bloque l'un des deux le temps du commit.

### 19.5 Workflow — Facture à 0€ bloque l'émission

**Étapes**
1. Créer une facture avec `totalHtCents=0`.
2. Cliquer "Émettre" ou POST `/issue`.

**Assertions**
- Backend 422 INVALID_TRANSITION : "totalHtCents doit être > 0 avant émission".
- Évite qu'un numéro séquentiel soit consommé pour rien.

### 19.6 Workflow — Mentions légales obligatoires présentes sur le PDF

**Préconditions** : facture émise.

**Étapes**
1. Télécharger le PDF d'une facture.

**Assertions** (textuelles via extract)
- SIRET (14 chiffres) présent.
- Forme juridique : "Micro-entreprise".
- Adresse workspace.
- Date émission, date échéance.
- Mention TVA micro : "TVA non applicable, art. 293 B du CGI".
- Mention pénalités : `LATE_PAYMENT_PENALTY_RATE` (3× taux légal).
- Indemnité forfaitaire 40 € (`LUMP_SUM_INDEMNITY`).
- Mentions via `buildLegalMentionsSnapshot()` snapshot sur la facture (immutable après émission).

### 19.7 Workflow — Interdiction hard delete facture émise

Couvert en 12.6/12.7. DB trigger SQL + API refuse.

---

## 20. Robustesse — crashs, réseau down, Claude CLI absent

### 20.1 Workflow — Sidecar API injoignable au démarrage

**Préconditions** : kill le process Bun sidecar avant lancement.

**Étapes**
1. Lancer FAKT.

**Assertions**
- Les `api.xxx.get/list/...` retournent `NETWORK_ERROR`.
- Les écrans Identity/Settings gèrent gracieusement (pas de crash).
- Toast ou bandeau "Sidecar indisponible".

### 20.2 Workflow — Claude CLI subitement désinstallé

**Étapes**
1. Tenter une extraction IA après que CLI ait été désinstallé.

**Assertions**
- `healthCheck()` → `installed=false` → bloc `ai-cli-missing`.

### 20.3 Workflow — Typst absent/crash

**Étapes**
1. Simuler `pdfApi.renderQuote` qui lève une erreur.

**Assertions**
- `pdfError` state affiché.
- Placeholder `pdf-placeholder` dans le détail.
- Boutons Télécharger/Signer disabled si pdfBytes empty.

### 20.4 Workflow — Keychain inaccessible

**Étapes**
1. Tenter signature avec keychain bloqué.

**Assertions**
- Erreur côté Rust `CertMissing`.
- UI modale signature affiche `certMissingBody` + CTA settings.

### 20.5 Workflow — TSA freetsa.org timeout

**Préconditions** : block network egress vers freetsa.org.

**Étapes**
1. Tenter de signer.

**Assertions**
- `signing` state reste long, puis erreur "TSA timeout".
- Bouton "Réessayer" (testid `signature-retry`) disponible.

### 20.6 Workflow — SQLite lock (concurrence write)

**Étapes**
1. Tenter 10 écritures concurrentes.

**Assertions**
- SQLite BEGIN IMMEDIATE gère la queue.
- Pas d'erreur "database locked" remontée user.

### 20.7 Workflow — Reload webview après crash

**Étapes**
1. F5 dans le webview (ou Cmd+R).
2. L'app recharge.

**Assertions**
- L'état persistant (DB) survit.
- L'état in-memory (composer messages, form values) est perdu (expected).
- Onboarding guard re-check `is_setup_completed`.

### 20.8 Workflow — Déconnexion réseau pendant extraction IA

**Étapes**
1. Démarrer extraction, couper le réseau.

**Assertions**
- Stream error `ENETUNREACH` ou équivalent.
- UI affiche `ai-error`, pas de crash.

### 20.9 Workflow — Double process sidecar (port conflict)

**Étapes**
1. Lancer 2 FAKT simultanément.

**Assertions**
- Le 2e sidecar trouve un autre port ou fail.
- Cf. `sidecar::spawn_api_server` auto-port (0 = random free).

### 20.10 Workflow — Fermeture brutale pendant signature en cours

**Étapes**
1. Démarrer signature, fermer fenêtre.

**Assertions**
- `on_window_event(CloseRequested)` → `sidecar_shutdown(ctx)` kill proprement le sidecar.
- Pas de zombie Bun process.

---

## Checklist récapitulative

Cocher au fur et à mesure de l'implémentation Playwright.

### Onboarding
- [ ] 1.1 Onboarding nominal complet (happy path)
- [ ] 1.2 SIRET invalide pédagogique (Luhn-KO)
- [ ] 1.3 IBAN optionnel invalide
- [ ] 1.4 Génération certificat en échec keychain
- [ ] 1.5 Retour en arrière dans le wizard

### Navigation & raccourcis
- [ ] 2.1 Navigation sidebar
- [ ] 2.2 Command Palette Cmd+K
- [ ] 2.3 Raccourci Nouveau devis Cmd+N
- [ ] 2.4 Raccourci Nouvelle facture Cmd+Shift+N
- [ ] 2.5 Toggle Composer IA Cmd+/
- [ ] 2.6 Overlay aide ?
- [ ] 2.7 URL 404

### Settings
- [ ] 3.1 Modifier identité workspace
- [ ] 3.2 Onglet Claude CLI recheck
- [ ] 3.3 Sessions IA : lister + effacer
- [ ] 3.4 Régénérer certificat
- [ ] 3.5 Toggle télémétrie
- [ ] 3.6 Version app affichée

### Clients
- [ ] 4.1 Créer client nominal
- [ ] 4.2 Rechercher client
- [ ] 4.3 Détail client (modale)
- [ ] 4.4 Modifier client
- [ ] 4.5 Archiver client
- [ ] 4.6 Restaurer client
- [ ] 4.7 Tri colonnes

### Prestations
- [ ] 5.1 Créer prestation + tags
- [ ] 5.2 Rechercher prestations
- [ ] 5.3 Archiver/restaurer prestation
- [ ] 5.4 Modifier prestation

### Devis manuels
- [ ] 6.1 Créer devis brouillon
- [ ] 6.2 Créer et émettre immédiatement
- [ ] 6.3 QuickClientModal depuis formulaire
- [ ] 6.4 Recalcul validity date

### Devis IA
- [ ] 7.1 Extraction IA depuis brief
- [ ] 7.2 Appliquer extraction
- [ ] 7.3 Annuler streaming
- [ ] 7.4 CLI absent bloque IA
- [ ] 7.5 Erreur streaming

### Devis liste/détail
- [ ] 8.1 Filtres chips statut
- [ ] 8.2 Recherche texte
- [ ] 8.3 Filtres client/dates
- [ ] 8.4 Tri colonnes
- [ ] 8.5 Ouvrir détail + preview PDF
- [ ] 8.6 Édition draft
- [ ] 8.7 Dupliquer devis
- [ ] 8.8 Télécharger PDF
- [ ] 8.9 Zoom PDF preview

### Devis transitions
- [ ] 9.1 draft → sent
- [ ] 9.2 sent → signed (via signature)
- [ ] 9.3 signed → invoiced (via full invoice)
- [ ] 9.4 Devis refusé
- [ ] 9.5 Devis expiré

### Factures from-quote
- [ ] 10.1 Acompte 30%
- [ ] 10.2 Solde
- [ ] 10.3 Total → passe devis à invoiced
- [ ] 10.4 Save draft sans numéro
- [ ] 10.5 Pré-sélection via ?quoteId

### Factures from-scratch
- [ ] 11.1 Facture indépendante
- [ ] 11.2 Mentions légales dans le form

### Factures liste/détail
- [ ] 12.1 Filtres chips + overdue
- [ ] 12.2 Recherche texte
- [ ] 12.3 Détail + preview PDF
- [ ] 12.4 Marquer envoyée
- [ ] 12.5 Marquer payée (MarkPaidModal)
- [ ] 12.6 Supprimer facture draft
- [ ] 12.7 Annulation facture émise → AVOIR
- [ ] 12.8 Édition draft (non-draft bloqué)
- [ ] 12.9 Télécharger PDF
- [ ] 12.10 Marquer overdue

### Signature
- [ ] 13.1 Signer devis par dessin
- [ ] 13.2 Signer par typographie
- [ ] 13.3 Signer une facture
- [ ] 13.4 Effacer signature
- [ ] 13.5 Annuler modale
- [ ] 13.6 Concurrence 2 signatures

### Vérification
- [ ] 14.1 Signature valide
- [ ] 14.2 Chain cassée détectée
- [ ] 14.3 Hash doc altéré
- [ ] 14.4 EventId introuvable
- [ ] 14.5 Télécharger PDF signé

### Email
- [ ] 15.1 Draft email devis
- [ ] 15.2 Mailto direct
- [ ] 15.3 Fallback auto mailto
- [ ] 15.4 Client sans email
- [ ] 15.5 Validation form
- [ ] 15.6 Template reminder overdue
- [ ] 15.7 Template thanks paid
- [ ] 15.8 Sécurité symlink .eml
- [ ] 15.9 Sécurité URL mailto

### Dashboard
- [ ] 16.1 Affichage avec données
- [ ] 16.2 Clic KPI navigate
- [ ] 16.3 Clic pipeline
- [ ] 16.4 Rédiger relance → composer
- [ ] 16.5 Clic activity row
- [ ] 16.6 Sparkline KPI
- [ ] 16.7 Dashboard vide

### Archive
- [ ] 17.1 Export ZIP complet
- [ ] 17.2 Table récente
- [ ] 17.3 ZIP vide

### Composer IA
- [ ] 18.1 Premier message
- [ ] 18.2 Contexte auto depuis route
- [ ] 18.3 Toggle context OFF
- [ ] 18.4 Suggestions chips
- [ ] 18.5 Annuler streaming
- [ ] 18.6 Reset conversation
- [ ] 18.7 Fermer composer
- [ ] 18.8 Shift+Enter newline
- [ ] 18.9 Erreur stream

### Numérotation & légal
- [ ] 19.1 Numéros devis séquentiels
- [ ] 19.2 Numéros factures
- [ ] 19.3 Bascule année
- [ ] 19.4 Concurrency émissions
- [ ] 19.5 Facture 0€ bloquée
- [ ] 19.6 Mentions légales PDF
- [ ] 19.7 Hard delete interdit

### Robustesse
- [ ] 20.1 Sidecar injoignable
- [ ] 20.2 Claude CLI désinstallé
- [ ] 20.3 Typst crash
- [ ] 20.4 Keychain inaccessible
- [ ] 20.5 TSA timeout
- [ ] 20.6 SQLite lock
- [ ] 20.7 Reload webview
- [ ] 20.8 Réseau coupé pendant IA
- [ ] 20.9 Port conflict sidecar
- [ ] 20.10 Fermeture brutale pendant signature

**Total : 95+ workflows couverts**

---

## Annexe A — Fixtures de test

### A.1 Workspaces (identité solo)

```ts
export const WORKSPACE_MERCIER = {
  id: "ws-00000000-0000-0000-0000-000000000001",
  name: "Atelier Mercier",
  legalForm: "Micro-entreprise",
  siret: "85366584200029",
  address: "12 rue de la République\n13001 Marseille",
  email: "contact@atelier-mercier.fr",
  iban: "FR7630006000011234567890189",
  tvaMention: "TVA non applicable, art. 293 B du CGI",
};

export const WORKSPACE_SASU = {
  id: "ws-00000000-0000-0000-0000-000000000002",
  name: "Kipling SASU",
  legalForm: "SASU",
  siret: "73282932000074",
  address: "5 avenue Montaigne, 75008 Paris",
  email: "contact@kipling.fr",
  iban: null,
  tvaMention: "TVA intracommunautaire FR12345678901",
};
```

### A.2 Clients

```ts
export const CLIENT_KIPLING = {
  id: "cl-00000000-0000-0000-0000-000000000001",
  name: "Studio Kipling",
  legalForm: "SAS",
  siret: "73282932000074",
  address: "5 avenue Montaigne\n75008 Paris",
  contactName: "Jeanne Kipling",
  email: "jeanne@kipling.studio",
  sector: "design",
  note: "Prospect LinkedIn",
};

export const CLIENT_NO_EMAIL = {
  id: "cl-00000000-0000-0000-0000-000000000002",
  name: "Mairie de Marseille",
  legalForm: "Autre",
  siret: "21130055200015",
  address: "Quai du Port\n13002 Marseille",
  contactName: null,
  email: null,
  sector: null,
  note: null,
};

export const CLIENT_ARCHIVED = {
  id: "cl-00000000-0000-0000-0000-000000000003",
  name: "Old Client SARL",
  email: "old@client.fr",
  archivedAt: 1700000000000,
};
```

### A.3 Prestations

```ts
export const PRESTATION_DEV_REACT = {
  id: "sv-00000000-0000-0000-0000-000000000001",
  name: "Développement React",
  description: "Composants TSX typés, tests Vitest",
  unit: "jour",
  unitPriceCents: 75000,
  tags: ["dev", "web"],
};

export const PRESTATION_DESIGN = {
  id: "sv-00000000-0000-0000-0000-000000000002",
  name: "Design Figma",
  description: "Wireframes + prototypes interactifs",
  unit: "jour",
  unitPriceCents: 60000,
  tags: ["design", "web"],
};

export const PRESTATION_CONSEIL = {
  id: "sv-00000000-0000-0000-0000-000000000003",
  name: "Audit stratégique",
  unit: "heure",
  unitPriceCents: 15000,
  tags: ["conseil"],
};
```

### A.4 Devis

```ts
export const QUOTE_DRAFT = {
  id: "qt-00000000-0000-0000-0000-000000000001",
  clientId: CLIENT_KIPLING.id,
  number: null, // draft, pas encore numéroté
  year: null,
  sequence: null,
  title: "Refonte site vitrine",
  status: "draft",
  totalHtCents: 3750000,
  issuedAt: null,
  validityDate: 1767225600000, // 2026-06-30
  items: [
    {
      id: "it-00000000-0000-0000-0000-000000000001",
      position: 0,
      description: "Dev frontend",
      quantity: 5000, // 5.000 jours
      unitPriceCents: 75000,
      unit: "jour",
      lineTotalCents: 375000,
      serviceId: PRESTATION_DEV_REACT.id,
    },
    // …
  ],
};

export const QUOTE_SENT = { ...QUOTE_DRAFT, id: "qt-…-002", number: "D2026-001", status: "sent", issuedAt: 1764633600000 };
export const QUOTE_SIGNED = { ...QUOTE_SENT, id: "qt-…-003", status: "signed", signedAt: 1765238400000 };
```

### A.5 Factures

```ts
export const INVOICE_DRAFT = {
  id: "in-00000000-0000-0000-0000-000000000001",
  clientId: CLIENT_KIPLING.id,
  quoteId: null,
  kind: "independent",
  number: null,
  title: "Prestation ponctuelle",
  status: "draft",
  totalHtCents: 150000,
  dueDate: null,
  items: [/* … */],
};

export const INVOICE_SENT = { ...INVOICE_DRAFT, id: "in-…-002", number: "F2026-001", status: "sent", issuedAt: 1764633600000, dueDate: 1767225600000 };
export const INVOICE_OVERDUE = { ...INVOICE_SENT, id: "in-…-003", dueDate: 1700000000000 /* passé */ };
export const INVOICE_PAID = { ...INVOICE_SENT, id: "in-…-004", status: "paid", paidAt: 1765000000000, paymentMethod: "wire" };
export const INVOICE_DEPOSIT = { ...INVOICE_DRAFT, id: "in-…-005", kind: "deposit", depositPercent: 30, quoteId: QUOTE_SIGNED.id, totalHtCents: 1125000 };
export const INVOICE_BALANCE = { ...INVOICE_DRAFT, id: "in-…-006", kind: "balance", quoteId: QUOTE_SIGNED.id, totalHtCents: 2625000 };
```

### A.6 Signature events

```ts
export const SIGNATURE_EVENT_VALID = {
  id: "ev-00000000-0000-0000-0000-000000000001",
  documentType: "quote",
  documentId: QUOTE_SIGNED.id,
  signerName: "Tom Andrieu",
  signerEmail: "contact@atelier-mercier.fr",
  timestamp: 1765238400000,
  docHashBefore: "a1b2c3…",
  docHashAfter: "d4e5f6…",
  signaturePngBase64: "iVBORw0KGgo…",
  previousEventHash: null, // premier event
  tsaProvider: "freetsa.org",
  tsaResponse: "base64-tsa-token",
};
```

### A.7 Brief IA déterministe

Pour les tests `/quotes/new?mode=ai`, mock la réponse de `getAi().extractQuoteFromBrief(brief)` avec :

```ts
export const MOCK_EXTRACTED_QUOTE = {
  client: { name: "Studio Kipling", email: "jeanne@kipling.studio" },
  items: [
    { description: "Dev frontend", quantity: 10, unit: "day", unitPrice: 750 },
    { description: "Design", quantity: 3, unit: "day", unitPrice: 600 },
  ],
  validUntil: "2026-06-30",
  notes: "Livraison sous 3 semaines",
};
```

### A.8 Payloads API pour test de numérotation séquentielle

```ts
export const seedQuotesBatch = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: crypto.randomUUID(),
    clientId: CLIENT_KIPLING.id,
    title: `Devis test ${i + 1}`,
    totalHtCents: (i + 1) * 100000,
    items: [{ /* … */ }],
  }));
```

### A.9 Certificat test (dev only)

```ts
// Certificat auto-signé mock pour les tests hors keychain réel
export const CERT_MOCK = {
  subjectCn: "CN=Atelier Mercier,O=Atelier Mercier,C=FR,emailAddress=contact@atelier-mercier.fr",
  notBeforeIso: "2026-04-24T00:00:00Z",
  notAfterIso: "2027-04-24T00:00:00Z",
  serialHex: "01",
  fingerprintSha256Hex: "aa:bb:cc:dd:ee:ff:11:22:33:44:55:66:77:88:99:00:aa:bb:cc:dd:ee:ff:11:22:33:44:55:66:77:88:99:00",
};
```

---

## Annexe B — Sélecteurs data-testid

Liste non exhaustive (extraits du code, à étendre au besoin) :

### Navigation & shell
- `topbar-composer-toggle`
- `composer-sidebar`, `composer-close`, `composer-reset`, `composer-input`, `composer-send`, `composer-cancel`
- `composer-msg-user`, `composer-msg-assistant`

### Dashboard
- `dashboard-root`, `dashboard-kpis`, `dashboard-pipeline`, `dashboard-suggestions`
- `kpi-ca-emis`, `kpi-ca-encaisse`, `kpi-devis-attente`, `kpi-factures-retard`
- `kpi-ca-emis-value`, `kpi-ca-encaisse-value`, etc.
- `widget-recent-activity`, `activity-row-<id>`

### Quotes
- `new-quote-menu`, `new-quote-manual`, `new-quote-ai`
- `quotes-count`, `quotes-empty`, `quotes-search`
- `status-filter-all`, `status-filter-draft`, `status-filter-sent`, `status-filter-signed`, `status-filter-invoiced`, `status-filter-refused`, `status-filter-expired`
- `client-filter`, `date-from-filter`, `date-to-filter`, `clear-filters`
- `sign-<id>`, `dup-<id>`
- `save-draft`, `create-and-issue`
- `quote-total`, `validity-date-display`
- `detail-edit`, `detail-download`, `detail-mark-sent`, `detail-mark-sent-cancel`, `detail-mark-sent-confirm`, `detail-mark-sent-error`, `detail-sign`, `detail-prepare-email`
- `pdf-iframe`, `pdf-placeholder`
- `edit-not-found`, `detail-not-found`

### Invoices
- `new-invoice-menu`, `new-invoice-from-quote`, `new-invoice-from-scratch`
- `invoices-count`, `invoices-empty`, `invoices-search`
- `invoice-status-filter-all/draft/sent/paid/overdue/cancelled`
- `invoice-client-filter`, `invoice-date-from-filter`, `invoice-date-to-filter`, `invoice-clear-filters`
- `quote-picker-section`, `quote-picker`, `no-signed-quote`
- `mode-picker-section`, `mode-radio-deposit30`, `mode-radio-balance`, `mode-radio-full`
- `invoice-save-draft`, `invoice-create-and-issue`
- `invoice-total`, `due-date-display`
- `invoice-context-note`
- `invoice-detail-edit`, `invoice-detail-download`, `invoice-detail-mark-sent`, `invoice-detail-mark-paid`, `invoice-detail-sign`, `invoice-detail-prepare-email`, `invoice-detail-delete`
- `invoice-pdf-iframe`, `invoice-pdf-placeholder`
- `invoice-detail-not-found`, `invoice-edit-not-found`, `invoice-edit-blocked`
- `invoice-delete-error`, `invoice-edit-credit-note-stub`
- `legal-mentions-section`, `mention-tva`, `mention-penalty`, `mention-lumpsum`

### MarkPaid modal
- `mark-paid-date`, `mark-paid-method`, `mark-paid-custom`, `mark-paid-notes`
- `mark-paid-confirm`, `mark-paid-cancel`, `mark-paid-error`

### Signature modal
- `signature-pane`, `signature-clear`, `signature-cancel`, `signature-submit`, `signature-retry`
- `signature-ack`, `signature-field-error`, `signature-submit-error`, `signature-cert-cta`

### Verify page
- `verify-loading`, `verify-error`, `verify-back`, `verify-download`
- `verify-document`, `verify-signature`, `verify-integrity`, `verify-chain`

### Audit timeline
- `audit-timeline`, `audit-timeline-loading`, `audit-timeline-empty`, `audit-timeline-error`
- `audit-entry-<kind>`, `audit-verify`

### Siret checker
- `siret-checker`

### AI extract flow
- `ai-brief`, `ai-extract`, `ai-cancel`, `ai-apply`
- `ai-loading`, `ai-error`, `ai-extracted`, `ai-extracted-total`, `ai-cli-missing`

### Archive
- `archive-export-btn`, `archive-confirm-export`

### Email modal
- `email-modal-template`, `email-modal-to`, `email-modal-subject`, `email-modal-body`
- `email-modal-mailto-toggle`, `email-modal-submit`, `email-modal-cancel`, `email-modal-error`

### Form errors générique
- `form-errors`, `submit-error`

---

## Annexe C — Matrice des transitions de statut

### Devis (QuoteStatus)

| Depuis \ Vers | draft | sent | signed | invoiced | refused | expired |
|---|---|---|---|---|---|---|
| **draft** | — | ✓ (mark-sent + issue numéro) | — | — | ✓ (cancel) | ✓ (expire) |
| **sent** | — | — | ✓ (via signature) | — | ✓ (cancel) | ✓ (expire) |
| **signed** | — | — | — | ✓ (via from-quote full) | — | — |
| **invoiced** | — | — | — | — | — | — |
| **refused** | — | — | — | — | — | — |
| **expired** | — | — | — | — | — | — |

### Factures (InvoiceStatus)

| Depuis \ Vers | draft | sent | paid | overdue | cancelled |
|---|---|---|---|---|---|
| **draft** | — | ✓ (mark-sent + issue numéro) | — | — | ✓ (cancel, seul cas autorisé) |
| **sent** | — | — | ✓ (mark-paid) | ✓ (cron ou mark-overdue) | ✗ (CGI art. 289 : AVOIR obligatoire) |
| **paid** | — | — | — | — | ✗ (AVOIR) |
| **overdue** | — | — | ✓ (mark-paid) | — | ✗ (AVOIR) |
| **cancelled** | — | — | — | — | — |

**Règles DB supplémentaires :**
- Trigger `invoices_no_hard_delete_issued` : `DELETE` interdit si `status ≠ draft`.
- Trigger `signature_events_no_update` + `_no_delete` : append-only absolu.
- UNIQUE `(workspace_id, year, type, sequence)` sur `numbering_state`.

---

**Fin du document. Version 1.0 — à mettre à jour à chaque nouveau workflow implémenté dans FAKT.**
