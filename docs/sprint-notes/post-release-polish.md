# Post-release polish — audit v0.1.0

**Date :** 2026-04-22 (J+1 post code-ready)
**Audit par :** Claude (preview navigateur Vite standalone port 1420)
**Scope :** vérifier que TOUTES les UI et tous les scénarios fonctionnent avant tag v0.1.0.

## Bugs CRITIQUES trouvés (fixés immédiatement)

### 1. Build cassé — `@fakt/email` absent de `apps/desktop/package.json`

- **Symptôme :** `bun run build` échoue à Rollup `Failed to resolve import "@fakt/email"`.
- **Cause :** Track K (Wave 4) a créé `packages/email` et l'a importé dans `PrepareEmailModal`, mais a oublié la dépendance workspace dans `apps/desktop/package.json`.
- **TypeScript l'a laissé passer** parce que les path mappings tsconfig résolvent les workspaces.
- **Impact release :** `.github/workflows/release.yml` aurait échoué au moment du tag `v0.1.0` sur les 3 OS. Aucun installer produit.
- **Fix :** `"@fakt/email": "workspace:*"` ajouté aux dependencies. `bun install` puis rebuild OK.

### 2. CSS orphelin — `packages/ui/src/styles.css` jamais importé

- **Symptôme :** les classes `.fakt-input`, `.fakt-overlay`, `.fakt-modal`, `.fakt-btn`, `.fakt-card`, `.fakt-chip`, `.fakt-status`, `.fakt-table` sont appliquées par les composants `@fakt/ui` mais **non définies dans aucun CSS chargé**.
- **Cause :** `apps/desktop/src/main.tsx` importe uniquement `./styles/globals.css` (tokens + tailwind). Le fichier `packages/ui/src/styles.css` qui contient toutes les classes est orphelin. Aucun agent des 5 Waves ne l'a wiré.
- **Impact release BLOQUANT :** tous les inputs sans bordure, modals en `position: static` qui s'affichent inline dans la page au lieu de flotter en overlay, boutons sans shadow plate, cards sans frame, status pills invisibles.
- **Fix :**
  - `packages/ui/package.json` : exposer `"./styles.css": "./src/styles.css"` dans `exports`.
  - `apps/desktop/src/main.tsx` : `import "@fakt/ui/styles.css";` après `globals.css`.
- **Vérification navigateur :** avant/après screenshot sur modal Nouveau Client — overlay noir 60% + card bordée 2.5px + shadow 5px apparaissent correctement. Identique Nouvelle Prestation, Signature, Command Palette, Composer IA drawer.

## Audit UI par route (post-fix, rendu final)

| Route | Rendu Brutal | Issues |
|---|---|---|
| `/` Dashboard | OK — 4 KPIs + pipeline 5 steps + activity feed + relances | — |
| `/quotes` List | OK — filter chips TOUS/BROUILLONS/ENVOYÉS/SIGNÉS/FACTURÉS/REFUSÉS/EXPIRÉS | headers table sort avec chars `‡ :` au lieu de chevrons haut/bas (mineur) |
| `/quotes/new` | OK — CLIENT picker + OBJET + dates + items table + "AJOUTER UNE LIGNE" + Total HT jaune Brutal + mention TVA 293 B + NOTES + 3 CTAs | — |
| `/invoices` List | OK — filter chips TOUTES/BROUILLONS/ENVOYÉES/PAYÉES/EN RETARD/ANNULÉES | — |
| `/invoices/new/libre` | OK — CLIENT + OBJET + ÉCHÉANCE + MOYEN DE PAIEMENT select + DESCRIPTION | incohérence UX : pas de "NOUVEAU CLIENT RAPIDE" (présent sur `/quotes/new`) |
| `/clients` | OK — list vide + CTA NOUVEAU CLIENT + corbeille | — |
| modal Nouveau Client | OK post-fix — overlay + card + form complet (nom, forme juridique, SIRET, adresse, contact, email, secteur, note) | — |
| `/services` Prestations | OK — list vide + CTA NOUVELLE PRESTATION | — |
| modal Nouvelle Prestation | OK — form avec unité select, prix HT, tags chips (DEV/DESIGN/CONSEIL/...) | — |
| `/archive` | OK — badge ARTICLE 289 CGI + 3 stats cards + CTA EXPORTER ZIP + table empty | — |
| `/settings` Identité | OK — form 4 tabs (IDENTITÉ / CLAUDE CLI / CERTIFICAT / TÉLÉMÉTRIE) | — |
| `/settings` Certificat | OK — CTA GÉNÉRER UN CERTIFICAT visible | bouton apparaît visuellement disabled/grisé en mode web standalone (attend probablement invoke Tauri — OK en runtime desktop réel) |
| Command Palette ⌘K | OK visuellement — overlay + input search | **timeout renderer au typing rapide** (possible re-render coûteux sans debounce sur `useCommandPaletteIndex`) — à investiguer v0.1.1 |
| Composer IA ⌘/ | OK — drawer 400px droite avec header, empty state, 3 chips suggestions, input bottom + ENVOYER | — |
| `/onboarding` step 1 | OK — stepper 4 étapes visible, form IDENTITÉ complet avec placeholders FR riches (SIRET, adresse Marseille exemple, IBAN FR76) | steps 2/3/4 non testés (nécessitent validation Zod du step 1 + invoke Tauri) |

## Ce qui n'a PAS été testé (dépend Tauri ou données)

- `bun run tauri:dev` réel (toolchain Tauri CLI non installée depuis W0 → Tom confirme au dogfood)
- Signature Modal (nécessite devis existant en DB)
- Mark-Paid Modal (nécessite facture existante)
- Detail Devis / Detail Facture avec preview PDF Typst (nécessite PDFs rendus)
- Create devis avec vraies lignes + persistance (nécessite DB SQLite)
- Flow complet devis → signer → email → facture (end-to-end dogfood)
- Export ZIP workspace (nécessite invoke Tauri `build_workspace_zip`)

## Dettes identifiées pendant l'audit (v0.1.1)

1. Command Palette : debounce le filtre sur `useCommandPaletteIndex` ou memoize (`useMemo`) — timeout reproductible sur typing rapide.
2. Form Facture Libre : ajouter CTA "Nouveau client rapide" pour parité UX avec Devis.
3. Sort chevrons table : remplacer les chars `‡ :` par de vrais glyphs `▲ ▼` ou icônes lucide.
4. Playwright E2E flow complet (dette déjà actée W4).

## Gates pre-tag v0.1.0 — update

Les 6 gates Tom restent, mais **ajout implicite d'un gate 0** : « `bun run typecheck && bun run test && bun run build` passent 11/11 + build dist généré sans erreur Rollup ». C'est désormais le cas après les 2 fixes. À re-vérifier côté CI GitHub Actions au prochain push.

## Validation post-fix

```
bun run typecheck → 11/11 ✓
bun run test      → 250+ tests ✓
bun run build     → desktop dist 656 KB JS + landing 1 page ✓
```

Aucune régression fonctionnelle, seul le CSS rend enfin. Les 2 commits de fix ne touchent que des package.json et une ligne d'import.
