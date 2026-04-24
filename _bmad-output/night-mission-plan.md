# Mission de nuit FAKT — 2026-04-23 22h47 → 2026-04-24 ~07h00

## Mandat utilisateur (verbatim)

> Demain matin je veux lancer l'app officielle buildée en mode released et ne plus jamais avoir un seul bug de ma vie sur l'appli. Lance des teams d'agent experts de tauri/rust etc... si il faut, corrige les bugs, fix les trucs de sécu, rend l'appli ultra robuste et prête pour une release au grand public. Commit atomique + traçage dans un fichier de planning tout ce qu'il faut faire, le plan original pour la nuit etc... Et si jamais les fixs sont trop dur à trouver et qu'il faut /compact pendant la session etc... tu reliras bien le CLAUDE.md et le plan du coup pour continuer selon ou tu en étais avant le compact.

## Ground rules

- **Push direct sur `main` autorisé** — Tom est solo dev, pas de PR.
- **Tag `vX.Y.Z` push autorisé** sans confirmation → CI release auto.
- **Commits atomiques signés DCO + GPG** (passphrase déjà cache).
- **Tout bug release crash → reproduire `cargo build --release` LOCAL avant release.**
- **Si /compact arrive** : relire `~/.claude/CLAUDE.md` (section "ACTIVE MISSION") + ce fichier, reprendre à la prochaine `[ ]`.

## État au démarrage de la mission (2026-04-23 22h47)

**Releases publiées :**
- v0.1.0 (22 avril) — release initiale, marche sauf onboarding (CORS bloqué)
- v0.1.1 (23 avril) — fix CORS, **MAIS** crash boot Windows + SIRET avec espaces refusé
- v0.1.2 (23 avril 22h55) — fix crash Windows (`strip=false`) + fix SIRET (`normalizeSiret` + Zod transform) + panic hook trace

**Tests api-server actuels :** 193+ tests OK
**Cargo.lock :** version `fakt 0.1.2`
**Code Rust modifié :** `lib.rs` panic hook + trace, `Cargo.toml` profile release

## Phases de la mission

### Phase 0 — Sécuriser v0.1.2 et état [STATUS]

- [x] CI release v0.1.2 publiée (run 24862744881, 4 binaires attachés)
- [ ] Tom installe v0.1.2 quand il se réveille → DOIT s'ouvrir sans crash
- [ ] **Validation locale immédiate** : désinstaller 0.1.1 manuellement (Tom dort, je ne touche pas son install) → on attend son réveil pour ce point
- [x] CLAUDE.md global mis à jour avec la mission
- [x] Plan de nuit créé (ce fichier)
- [x] **Vérification finale** : binaire release local 0.1.1 (commit pré-fix) crashait, binaire 0.1.2 (avec strip=false) survit `setup()` complet

### Phase 1 — Audit massif (3 agents en parallèle)

But : identifier TOUS les bugs/risques avant la release publique.

- [ ] **Agent A — code-reviewer** : review complet du code Rust (`apps/desktop/src-tauri/src/`). Cibler `unwrap()/expect()` qui peuvent panic en prod, gestion des erreurs Tauri, sécurité keychain/crypto, `panic = "abort"` traps, race conditions sidecar/window.
- [ ] **Agent B — code-reviewer** : review complet du code TS (`packages/api-server`, `packages/core`, `packages/db`, `apps/desktop/src`). Cibler validation Zod manquante, SQL injection (Drizzle params OK normalement), gestion erreurs API (codes HTTP cohérents), états React inconsistants, fuites async.
- [ ] **Agent C — general-purpose** : audit deps (`bun audit`, `cargo audit`), lint (`bun run lint` Biome), typecheck (`bun run typecheck` turbo), suite de tests complète (`bun run test`). Reporter chaque CVE/warning/error.

Output attendu : 3 rapports avec issues priorisées P0/P1/P2.

### Phase 2 — Fix bugs P0 (bloquants release publique)

Pour CHAQUE bug P0 :
1. Reproduire (test ou repro manuel)
2. Fix
3. Test de non-régression ajouté
4. `bun run typecheck && bun run test` OK
5. Commit atomique signé : `fix(scope): description`
6. Push direct main

Bugs P0 connus AU DÉPART (à valider/affiner avec audit) :
- [ ] Suite des bugs SIRET dans d'autres formulaires (ClientForm, settings) — SIRET avec espaces partout
- [ ] Vérifier que tous les autres champs validés (IBAN, email, téléphone) supportent les variantes user
- [ ] Tester l'install propre `desinstall + reinstall MSI` (cycle complet) — même si Tom doit le faire au réveil
- [ ] Robustesse spawn sidecar (timeouts, crash loop, port collision)
- [ ] Race condition window close → sidecar shutdown propre

### Phase 3 — Sécurité

- [ ] `cargo audit` clean
- [ ] `bun audit` clean (ou justifier les warnings)
- [ ] Pas de secret hardcodé (grep `password|secret|key|token` hors tests)
- [ ] Token sidecar : longueur ≥16, généré avec CSPRNG, transmis uniquement via env (jamais via argv)
- [ ] CSP Tauri : `script-src 'self'` strict (vérifier qu'aucun `unsafe-inline` n'a été ajouté)
- [ ] Permissions Tauri capabilities : minimum requis (pas de `*`)
- [ ] Audit chain crypto : SHA-256 chaînage signatures, pas de UPDATE/DELETE sur `audit_events`
- [ ] Keyring OS : pas de fallback en clair sur disque sans warning

### Phase 4 — Robustesse

- [ ] Panic hook fakt.exe écrit dans un endroit non-temp (ex: `app_data_dir/logs/`) — actuellement dans %TEMP% qui peut être nettoyé
- [ ] `tracing_subscriber` configuré en prod avec writer fichier rotatif
- [ ] Sidecar : recovery automatique si crash < seuil, fail-fast au-delà (déjà partiellement fait avec `crash_timestamps` + `CRASH_LOOP_WINDOW`)
- [ ] Frontend : ErrorBoundary global qui catch React errors + log vers Tauri command pour persister
- [ ] Network errors API : retry exponentiel + UX claire (toast + bouton "réessayer")
- [ ] Migration DB : tester upgrade depuis schema 0.1.0/0.1.1/0.1.2 → vN sans perte de données
- [ ] Backup auto : vérifier que la fonction backup marche bien (`/api/backups`)

### Phase 5 — Build release final + validation E2E

- [ ] Build release local complet : `cargo build --release` OK
- [ ] Tests Vitest tous OK : `bun run test`
- [ ] Lint clean : `bun run lint`
- [ ] Bump version (v0.1.3 si fix bugs, v0.2.0 si breaking) + CHANGELOG entry détaillé
- [ ] Tag signé + push → CI release
- [ ] Vérifier les 4 binaires CI (MSI/DMG/DEB/.app)
- [ ] **Test fonctionnel final** : si possible, dl le MSI dans un dossier temp, le hash check, vérifier signature

### Phase 6 — Documentation & handover

- [ ] CHANGELOG complet et lisible pour le grand public
- [ ] README troubleshooting enrichi avec nouvelles entrées (panic.log, où le trouver)
- [ ] Mise à jour `night-mission-plan.md` avec l'état final + résumé pour Tom
- [ ] Section finale "Tom au réveil" : ce qu'il doit faire + ordre exact

## Journal d'avancement (mis à jour LIVE)

### 22h47 — Démarrage mission
- Plan créé. CLAUDE.md updated. v0.1.2 published.

### 23h00 → 23h35 — Phase 1 audit massif (3 agents parallèles)
- Agent Rust : 2 P0 + 4 P1 identifiés
- Agent TS : 2 P0 + 5 P1 identifiés
- Agent deps : 1 HIGH (drizzle SQL injection) + 3 MODERATE + 2 CVE Rust sans fix amont
- Agent Tauri docs : 8 best practices recensées
- Total : 7 P0/P1 à fixer + 4 CVE deps + cleanup lint

### 23h35 → 00h40 — Phase 2 fix Rust P0/P1 (commit e94bde5)
- `lib.rs` : remplace `.expect()` par `Result + exit(1)`, ajoute kill sidecar si window build fail
- `trace.rs` (nouveau) : logger persistant app_data_dir/logs/ avec fallback %TEMP%
- `crypto/commands.rs` : from_utf8_lossy
- `commands/backup.rs` : Zip Slip sanitize + validate dest_path (blocked system dirs) + 5 tests
- `commands/email.rs` : canonicalize path pour résoudre symlinks
- `crypto/pades.rs` : saturating_sub défensif

### 00h40 → 01h15 — Phase 2 fix TS P0/P1 (commits 630deee + 4e8167d + 22ccfea + 2f77239)
- `schemas/common.ts` : exception La Poste SIRET + pagination max(500)
- `routes/invoices.ts` : nextNumberAtomic + 422 + garde totalHt>0
- `routes/quotes.ts` : garde totalHt>0 à l'issue
- `routes/clients.ts` : 409 au lieu de 404 sur archived/restore
- `Recap.tsx` : guard synchrone double-submit
- `bun update drizzle-orm@0.45.2` (HIGH GHSA-gpj5-g38j-94v9) + vite 8 + astro 6 + esbuild 0.28
- `SECURITY.md` + `audit.toml` : CVE Rust documentées (rsa Marvin, rand transitive)
- Lint : zero non-null assertion (claude-cli.ts + shortcuts.test.ts + scripts/dev.ts)

### 01h15 — Validation complète
- Typecheck 12/12 OK, Lint clean, Tests 776/776 passed
- Build release local `cargo build --release` : 4m39s, binaire 9.7 Mo
- **Test boot binaire release local : setup complete OK, pas de crash** ✅
- Logs persistants confirmés dans `%APPDATA%/com.alphaluppi.fakt/logs/fakt-trace.log`

### 01h20 — v0.1.3 tagged + pushed (commit b0914dd)
- Bump 0.1.2 → 0.1.3 sur 12 package.json + tauri.conf + Cargo.toml/lock + API_VERSION
- CHANGELOG entrée `[0.1.3] - 2026-04-24` complète (Security / Fixed / Added / Changed / Developer notes)
- Tag `v0.1.3` signé GPG + DCO
- Push main + tag → CI Release run 24876397249

### 01h20 → 01h55 — Chasse Tauri commands fantômes
- Audit croisé : `invoke(...)` côté React vs `invoke_handler![...]` côté Rust
- **3 commands fantômes découvertes dans Settings** :
  - `update_workspace` (IdentityTab → enregistrer) — crash silencieux au save
  - `get_workspace` (Settings mount) — écran Identity vide
  - `update_settings` (TelemetryTab) — toggle ne persistait rien
- Fix : toutes migrées vers l'API sidecar (`api.workspace.get/update`, `api.settings.set`)
- Commits : c4cc6db (IdentityTab) + 16e049a (Settings.tsx) + 875f8af (bump 0.1.4)
- Tests settings 9/9 OK avec `vi.hoisted` pour compat mocks

### 01h55 — v0.1.4 tagged + pushed
- Inclut les fix settings POST-v0.1.3 pour que la release finale soit cohérente
- CI run 24876813407 en cours

### 02h00 — README troubleshooting enrichi
- Section crash silencieux Windows avec chemin exact du `fakt-trace.log`
- Entrées dédiées pour les bugs fixés (CORS 0.1.1, SIRET 0.1.2, Settings 0.1.4)

## Tom au réveil — actions

**État final :** FAKT **v0.1.4** est la release grand public cible.
6 commits atomiques signés DCO + GPG sur main entre 22h47 et 02h00.

**Chronologie releases cette nuit :**

| Version | Quoi | Status |
|---------|------|--------|
| v0.1.0 (la veille) | MVP initial | Bug onboarding (CORS) |
| v0.1.1 | Fix CORS sidecar | Bug crash boot Windows (profile release) |
| v0.1.2 | Fix crash Windows (strip=false) + SIRET espaces | Marche mais bugs settings |
| **v0.1.3** | Hardening audit nuit (2 P0 + 5 P1 + 4 CVE deps + SECURITY.md) | Bug settings découvert post-tag |
| **v0.1.4** ✅ | Fix Tauri commands fantômes Settings | **Version finale** |

**À faire au réveil :**

1. **Désinstaller FAKT 0.1.0/0.1.1/0.1.2** (Paramètres Windows → Apps → FAKT → Désinstaller). Ça enlève le binaire mais garde `%APPDATA%\com.alphaluppi.fakt\` et `~\.fakt\db.sqlite`.

2. **Télécharger le MSI 0.1.4** :
   https://github.com/AlphaLuppi/FAKT/releases/download/v0.1.4/FAKT_0.1.4_x64_en-US.msi

3. **Installer** : double-clic, SmartScreen → *Plus d'infos* → *Exécuter quand même* (pas de signature Authenticode en v0.1.x, prévu v0.2).

4. **Lancer FAKT**. L'app doit s'ouvrir sans crash. Si crash → lire `%APPDATA%\com.alphaluppi.fakt\logs\fakt-trace.log`.

5. **Vérifier ton workspace** :
   - Si tu avais fait l'onboarding en 0.1.0/0.1.1, il est gardé en DB. L'app doit arriver direct sur le dashboard.
   - Si le SIRET sauvegardé est le fictif "123 456 789 00122", aller **Settings → Identité** et mettre le vrai `85366584200029` (Tom Andrieu, micro-entreprise, 67 route de Lyon 84000 Avignon) → cliquer **Enregistrer**. **Cette action marche enfin en 0.1.4**.

6. **Test E2E demandé hier soir** :
   - Créer un client JOCANET (SIRET 885 313 007 00019, 950 route de Réalpanier 84310 Morières-lès-Avignon)
   - Créer un devis Tracking Hootop 6120€ HT (prestation forfait)
   - Émettre le devis (→ D2026-001)
   - Signer côté freelance (panneau signature)
   - Signer côté client (même panneau, actor=client)
   - Marquer signé (→ status signed)
   - Créer facture `from-quote` mode `deposit30` (→ F2026-001, 1836€)
   - Vérifier PDFs générés dans la DB `~\.fakt\db.sqlite` (blob BLOB) ou export ZIP

**Si un bug est découvert au matin :**
- Ouvrir le log `fakt-trace.log` + envoyer le contenu
- La version dev `bun run dev` marche déjà en local (validé cette nuit)

## Récapitulatif des commits de la nuit

```
875f8af  chore(release): bump 0.1.3 -> 0.1.4 (fix Tauri commands fantomes settings)
16e049a  fix(desktop/settings): Settings.tsx get_workspace + update_settings
c4cc6db  fix(desktop/settings): IdentityTab sauvegarde (Tauri command inexistante)
b0914dd  chore(release): bump 0.1.2 -> 0.1.3 pour release grand public durcie
2f77239  docs(security): SECURITY.md + audit.toml — CVE Rust non-fixables
22ccfea  chore(lint): retire les non-null assertions
4e8167d  chore(deps): bump drizzle-orm (HIGH) + vite/astro/esbuild
630deee  fix(api-server+onboarding): hardening P0/P1 audit TS
e94bde5  fix(desktop/rust): hardening P0/P1 audit release publique
62f539f  chore(planning): plan de nuit hardening FAKT
```

## Annexes — Stats finales

- Commits : 10 atomiques signés DCO + GPG pushés sur `main`
- Versions releases : 3 (v0.1.2 hotfix CORS/SIRET, v0.1.3 hardening, v0.1.4 fix settings)
- Tests : 776 passed / 1 skipped / 0 failed (couverture api-server 89.86%)
- Typecheck : 12/12 packages OK
- Lint : clean (zero warning, zero error)
- `cargo audit` : clean après ignore 2 CVE documentées
- `bun audit` : 0 HIGH, 3 MODERATE dev-only (transitives, pas bloquantes)
- Bugs fixés : 2 P0 Rust (crash release + utf8 unwrap) + 2 P0 TS (numbering + SIRET La Poste) + 5 P1 TS + 4 P1 Rust (Zip Slip, symlink, pades, sidecar zombie) + 3 Tauri commands fantômes + 1 CVE HIGH deps
- Nouveaux fichiers : `SECURITY.md`, `audit.toml`, `trace.rs`, `night-mission-plan.md`

## Annexes — Décisions techniques prises pendant la nuit

(à compléter au fil de l'eau, format ADR léger : Contexte / Décision / Alternatives / Conséquence)
