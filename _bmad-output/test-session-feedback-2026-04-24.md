# Session de test FAKT — Feedback Tom — 2026-04-24

## Contexte

Session de test en mode **dev** (`bun run dev`) menée par Tom.
Objectif : lister tous les bugs/frustrations/améliorations UI-UX, prioriser, puis lancer un plan de fix.
Post-fix : génération d'une suite E2E Playwright (cf. `_bmad-output/e2e-workflows-coverage.md`) couvrant tous ces cas + features complètes de l'app.

Progression test → release :
1. ✅ Test dev en cours → ci-dessous la liste des retours
2. ⏳ Test `cargo build --release` local une fois tout fix
3. ⏳ Release publique une fois release local OK

## Captures de référence

Deux captures fournies :
- **C1** — Composer IA : bulle de réponse streamée en `[object Object][object Object][object Object]` avant de flip en markdown propre.
- **C2** — Modale signature : erreur rouge "La signature a échoué — Erreur : id doit être un UUID v4" après "Signer définitivement".

---

## Retours priorisés

Numérotation : conserve la numérotation Tom (0 → 15) pour traçabilité dans la conversation.
Priorités : **P0** = bloquant release publique · **P1** = UX dégradée majeure · **P2** = polish / enhancement.

### [P0] #1 — Streaming IA affiche `[object Object]` avant de flip

- **Symptôme** (capture C1) : en envoyant un message dans Composer IA, des blocs `[object Object]` s'accumulent un par un, puis d'un coup le texte markdown propre s'affiche.
- **Cause probable** : le handler SSE côté front concatène l'event entier (`event.data` ou l'objet parsé) en string au lieu d'extraire le `delta.text` / `content`. Au moment où la réponse est complète, le state bascule sur la version finale propre.
- **Fichiers suspects** : `apps/desktop/src/features/ai/` (composer + hook streaming), côté sidecar `packages/api-server/src/routes/ai*.ts`.
- **Fix** : extraire `text` du delta Anthropic SSE (`content_block_delta.delta.text`), append incrementalement, ignorer les events `message_start`/`ping`/`message_stop`.

### [P0] #4 — PDF devis ne contient pas les mentions légales complètes

- **Symptôme** : le devis généré via Typst n'a pas toutes les mentions administratives/légales requises.
- **Référence** : reprendre ce que fait le skill local `/devis` (`anthropic-skills:devis-freelance`) — il produit un .docx avec toutes les mentions FR micro-entreprise.
- **Fichiers suspects** : `packages/pdf/templates/quote.typ` (template Typst).
- **Action** : auditer le template Typst, comparer au .docx du skill, ajouter les blocs manquants (forme juridique, SIRET émetteur, adresse, date émission, validité, CGV, mode de paiement, pénalités retard, mention TVA 293 B, etc.).

### [P0] #5 — Télécharger PDF ouvre le dialog mais n'enregistre rien

- **Symptôme** : clic "Télécharger PDF" → fenêtre explorer s'ouvre → "Enregistrer" → aucun fichier écrit sur disque.
- **Cause probable** : dialog Tauri `save()` retourne le path mais la commande Rust ne fait pas l'écriture, OU le front lit le path et n'appelle pas la commande d'écriture, OU erreur silencieuse sur le write.
- **Fichiers suspects** : `apps/desktop/src-tauri/src/commands/` (commande `save_pdf` ou équivalent), côté front bouton "Télécharger" sur détail devis/facture.
- **Action** : ajouter un trace + toast d'erreur, reproduire, écrire test unitaire Rust sur la commande.

### [P0] #7 — Signature échoue : "id doit être un UUID v4"

- **Symptôme** (capture C2) : trait dessiné + case cochée + "Signer définitivement" → bannière rouge "Erreur : id doit être un UUID v4".
- **Cause probable** : le front envoie `quote.id` ou `invoice.id` en format non-UUID-v4 (peut-être nanoid, CUID, ou UUID sans version 4) à la route signature ; le schéma Zod rejette.
- **Fichiers suspects** : `packages/api-server/src/routes/signatures.ts` (schéma Zod), `packages/db/src/schema.ts` (génération id), front signature panel.
- **Action** : décider — soit générer des UUID v4 partout, soit relâcher le schéma Zod pour accepter le format réel des ids DB. Bug bloquant le flow complet devis signé.

### [P0] #13 — Barre de recherche ne retourne rien

- **Symptôme** : zone/section de recherche (Cmd+K ou autre ?) → saisie → 0 résultat alors que la DB contient des clients.
- **À préciser avec Tom** : quelle barre de recherche exactement ? Globale (Cmd+K) ou celle d'une liste (clients/devis/factures) ?
- **Fichiers suspects** : `apps/desktop/src/features/search/` ou `CommandPalette.tsx`, côté API `packages/api-server/src/routes/search.ts`.

### [P0] #14 — Bouton "Nouveau avec l'IA" ne fait rien

- **Symptôme** : clic sur le bouton "Nouveau avec l'IA" (sur liste devis ?) → aucune action visible (pas de modale, pas de navigation).
- **À préciser** : doit ouvrir quoi ? Soit une modale brief IA (prompt + contexte client), soit une route dédiée `/quotes/new-ai`.
- **Fichiers suspects** : `apps/desktop/src/features/quotes/NewAi.tsx` ou handler du bouton sur liste devis.

---

### [P1] #0 — Bloc réponse IA doit supporter HTML + SVG + Markdown complet

- **Actuel** : markdown basique seulement, pas de HTML inline ni SVG.
- **Cible** : rendu équivalent Claude Desktop — code highlighted, tables, quote blocks, images, SVG inline, diagrammes.
- **Stack cible** : `react-markdown` + plugins (remark-gfm, rehype-raw pour HTML, rehype-highlight, rehype-sanitize pour sécuriser les iframes/scripts).
- **Fichiers suspects** : `apps/desktop/src/features/ai/ChatMessage.tsx` ou similaire.

### [P1] #2 — Ajouter blocs thinking + tool_use dans Composer IA

- **Cible** : UI identique à Claude Desktop — bloc repliable "Thinking..." pendant le stream des `thinking_delta`, blocs `tool_use` avec nom + input JSON repliable, blocs `tool_result` associés.
- **Action** : côté front, router les events SSE par `type` (text, thinking, tool_use, tool_result) vers des composants dédiés ; côté sidecar, s'assurer que les events thinking sont bien propagés (pas filtrés).
- **Design** : cartes repliables brutalistes (border 2px noir, bg papier, petit accent jaune pour le header "THINKING" / "TOOL").

### [P1] #3 — Devis marqué "envoyé" automatiquement → remplacer par toggle manuel + audit trail

- **Symptôme** : création devis → statut `sent` direct, alors qu'aucun email n'est envoyé (pas d'intégration mail réelle en MVP).
- **Cible** : créer devis = statut `draft`. Bouton/toggle "Marquer comme envoyé" (+ date) sur le détail, action qui log un `audit_event` (`actor=user, type=quote_marked_sent`).
- **Fichiers suspects** : `packages/api-server/src/routes/quotes.ts` (`POST /quotes/:id/issue` ?), détail devis front (`QuoteDetail.tsx`).

### [P1] #6 — Bouton "Éditer un devis" grisé sans tooltip

- **Symptôme** : bouton disabled, aucune explication.
- **Cause probable** : les devis `sent`/`signed` sont read-only (légal — devis émis ≈ engagement).
- **Action** : ajouter `title=` ou tooltip UIKit expliquant "Impossible d'éditer un devis envoyé — dupliquer pour créer une nouvelle version".

### [P1] #15 — Animation streaming texte moche (block par block)

- **Actuel** : le texte apparaît par paquets visuellement saccadés.
- **Référence design** : [Anthropic Text Streaming Animations](https://api.anthropic.com/v1/design/h/OmRt6vG0zFEcaQUG3wXDDQ?open_file=Text+Streaming+Animations.html) — animations caractère par caractère avec fade / blur / typewriter cursor.
- **Action** : récupérer le design ref, choisir une animation alignée Brutal Invoice (privilégier typewriter pur + curseur clignotant plutôt que fade/blur qui clashe avec le design system), implémenter.

---

### [P2] #8 — Segmented control pour "Dessiner au trackpad" / "Taper au clavier"

- **Actuel** (capture C2) : deux boutons côte à côte, un surligné jaune.
- **Cible** : composant `SegmentedControl` pleine largeur, 2 segments égaux, segment actif jaune + texte noir, inactif papier + texte noir, border 2px noir continu.
- **Action** : créer `packages/ui-kit/src/SegmentedControl.tsx` (réutilisable) + refactor de la modale signature.

### [P2] #9 — Signature trackpad : support Ctrl+Z pour undo dernier trait

- **Actuel** : seul "Effacer" (reset total) est dispo.
- **Cible** : garder un stack de strokes, Ctrl+Z (ou Cmd+Z macOS) pop le dernier, redraw canvas.
- **Fichiers suspects** : `apps/desktop/src/features/signature/SignatureCanvas.tsx`.

### [P2] #10 — Détail client : clic sur devis/factures liés + pagination

- **Actuel** : liste des devis/factures liés sur la fiche client, non cliquable.
- **Cible** : 
  - Chaque ligne cliquable → navigation vers détail devis/facture.
  - Si > 5 items, paginer OU afficher "Voir tous les devis de ce client" qui renvoie vers liste filtrée par `clientId`.
- **Fichiers suspects** : `apps/desktop/src/features/clients/ClientDetail.tsx`.

### [P2] #11 — UX "bibliothèque de prestations" sur description ligne devis mal intégrée

- **Actuel** : dropdown/picker bibliothèque prestations intrusif dans le champ description de la ligne devis.
- **Cible** : repenser — soit icône discrète "+" à côté du champ qui ouvre une palette, soit autocomplete inline non intrusif.
- **À préciser avec Tom** : direction UX souhaitée (icône latérale, autocomplete, palette modale).

### [P2] #12 — Description ligne devis : single-line par défaut

- **Actuel** : textarea multi-ligne par défaut.
- **Cible** : input single-line comme les autres champs ; auto-expand vers textarea si l'utilisateur tape un retour chariot ou dépasse une certaine longueur.
- **Fichiers suspects** : `apps/desktop/src/features/quotes/LineItemRow.tsx` ou équivalent.

---

## Synthèse priorisée

### Bloquants release publique (P0) — 6 items
- [ ] #1 — Streaming IA `[object Object]`
- [ ] #4 — PDF mentions légales incomplètes
- [ ] #5 — Télécharger PDF n'écrit rien
- [ ] #7 — Signature échoue (UUID v4)
- [ ] #13 — Recherche vide
- [ ] #14 — Bouton "Nouveau avec l'IA" inactif

### UX majeure (P1) — 5 items
- [ ] #0 — Markdown/HTML/SVG dans chat IA
- [ ] #2 — Blocs thinking + tool_use
- [ ] #3 — Toggle "marquer envoyé" + audit
- [ ] #6 — Tooltip sur bouton "Éditer" disabled
- [ ] #15 — Animation streaming texte

### Polish (P2) — 5 items
- [ ] #8 — Segmented control full-width
- [ ] #9 — Ctrl+Z signature trackpad
- [ ] #10 — Navigation client ↔ devis/factures liés
- [ ] #11 — UX bibliothèque prestations
- [ ] #12 — Description ligne single-line par défaut

**Total : 16 retours (6 P0 + 5 P1 + 5 P2)**

---

## Décisions prises avec Tom (2026-04-24)

1. **#13** → barre de recherche globale **Cmd+K** (command palette).
2. **#14** → le bouton doit router vers la page existante `/quotes/new-ai` (`apps/desktop/src/routes/quotes/NewAi.tsx`) : workflow dédié "brief texte → IA extrait un devis structuré → form pré-rempli". Diff avec Composer IA : Composer = chat libre, NewAi = workflow de création guidé.
3. **#11** → **autocomplete inline** dans le champ description : `>= 2` chars → suggestions biblio en dropdown sous le champ, Tab/Enter pour sélectionner. Non intrusif.
4. **#7** → **UUID v4 partout** (standard). Régénérer les ids existants si nécessaire, ou vérifier la source de génération côté DB/front.
5. **#4** → sources de vérité confirmées :
   - Devis : `~/.claude/skills/devis-freelance/SKILL.md` + `~/.claude/skills/devis-freelance/references/`
   - Factures : `~/.claude/skills/facture-freelance/SKILL.md` + références
   - Objectif : reprendre les mentions légales + structure de mise en page pour le template Typst.

---

## Retours additionnels (Round 2 — session en cours)

### [P1] #16 — Thinking blocks / tool calls invisibles dans Composer IA
- **Symptôme** : pas de blocks thinking/tool visibles, pas d'animation de chargement.
- **Root cause** : la CLI actuelle (`packages/ai/src/providers/claude-cli.ts`) n'émet que des events `token` (text) + `done`. Jamais de `thinking_delta` ni `tool_use`. Les composants React `ThinkingBlock`, `ToolUseBlock`, `ToolResultBlock` existent mais sans source de données.
- **Fix Phase 1 (fait, commit `e5adfe6`)** : composant `StreamingStatus` avec spinner braille + "L'IA RÉFLÉCHIT…" affiché pendant tout le stream.
- **Fix Phase 2 (à lancer)** : refonte bridge Rust pour parser SSE Anthropic natifs et forwarder `thinking`/`tool_use` events au front + toggle Settings "Mode verbose IA" pour afficher les blocks.
- **Option alternative** : mini-résumé Haiku parallèle qui explique ce que l'IA fait en live.

### [P0] #17 — Extraction IA produit 0€ / aucun item
- **Symptôme** (capture Tom) : brief "Un site web pour casa mia, 100 euros pour l'hosting / an et le site est gratuit" → "INFORMATIONS EXTRAITES / Total HT estimé 0,00€" + bouton "Utiliser cet extrait" grisé.
- **Cause probable** : `spawn_claude` côté Rust renvoie probablement du texte brut au lieu du JSON structuré `ExtractedQuote`, ou l'event `done` arrive avec un result mal parsé. Ou le prompt `extract_quote` ne produit pas un JSON exploitable.
- **Action de debug** : ajouter un bouton "Voir le raw output" sur la page NewAi qui montre ce que la CLI a renvoyé — permet de diagnostiquer en live. Puis fix selon ce qu'on voit.

### [P1] #18 — Drag/drop de fichiers (devis, emails) dans la page brief IA
- **Cible** : zone dropzone autour de la textarea "COLLE TON BRIEF" qui accepte `.txt`, `.md`, `.pdf`, `.docx`, `.eml`.
- **Action** :
  1. Phase A (rapide) : support `.txt`, `.md`, `.eml` via FileReader + parsing regex → append au brief.
  2. Phase B : support `.pdf` via `pdfjs-dist` (~400kb gzip, extraction client-side), `.docx` via `mammoth`.
- **UX** : drop zone stylée Brutal (dashed 2px noir, fond papier au hover), feedback "CHARGEMENT…" pendant extraction, erreur claire si fichier illisible.

### [P1] #19 — "Utiliser cet extrait" désactivé sans explication
- **Observation dérivée capture** : bouton grisé probablement parce que `extracted.items.length === 0`. Ajouter tooltip "Aucune ligne extraite — reformule ton brief avec plus de détails" ou similaire.

## Next step

Attendre le go de Tom pour lancer le plan de fix.
Stratégie suggérée :
1. Confirmer les 5 questions ouvertes ci-dessus.
2. Attaquer les 6 P0 en priorité (parallélisables : 2 agents sur front/back).
3. Puis P1 batch UI chat IA (#0 + #2 + #15 ensemble, cohérents).
4. Puis P2 (peuvent être différés post-release publique).
5. Après chaque fix : test manuel Tom → commit atomique signé DCO+GPG → push main.
6. Fin du batch : `bun run test && bun run typecheck && bun run lint` → `cargo build --release` → test release local → tag + release.
7. Post-release : implémenter la suite Playwright d'après `_bmad-output/e2e-workflows-coverage.md` pour capturer définitivement ces régressions.
