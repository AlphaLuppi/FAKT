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

### [TIMESTAMP] — [ÉVÉNEMENT]

(à compléter au fil de l'eau)

## Tom au réveil — actions

(section à compléter à la fin de la mission, environ 06h-07h)

## Annexes — Décisions techniques prises pendant la nuit

(à compléter au fil de l'eau, format ADR léger : Contexte / Décision / Alternatives / Conséquence)
