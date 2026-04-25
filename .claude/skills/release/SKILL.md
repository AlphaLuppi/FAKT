---
name: release
description: Crée une nouvelle release FAKT (vX.Y.Z) avec changelog rédigé pour humain dans CHANGELOG.md et publication GitHub. À invoquer manuellement avec /release <version>, par ex. /release 0.1.12. Ne jamais déclencher automatiquement.
disable-model-invocation: true
argument-hint: <version sans le v, ex 0.1.12>
allowed-tools: Bash(git *) Bash(gh *) Bash(awk *) Bash(sed *)
---

# Skill : release FAKT

Tu vas piloter la release de la version **$ARGUMENTS** de FAKT, du diff au tag GitHub. Source de vérité : `CHANGELOG.md` à la racine. La release GitHub recopie l'extrait correspondant.

## Pré-requis (à vérifier en début)

1. `git status` doit être propre (rien en working tree). Sinon : stop, demander à Tom.
2. La branche courante doit être `main`. Sinon : stop.
3. Le tag `v$ARGUMENTS` ne doit pas déjà exister : `git tag -l "v$ARGUMENTS"` doit être vide. Sinon : stop.
4. Récupérer le tag précédent : `git describe --tags --abbrev=0` → `<previous-tag>`.
5. Vérifier que `$ARGUMENTS` > version dans `apps/desktop/src-tauri/Cargo.toml` et `apps/desktop/package.json` — sinon il faut bumper d'abord.

## Étape 1 — Lister les commits user-facing

```bash
git log <previous-tag>..HEAD --pretty=format:"%h %s"
```

Tri en 3 catégories. **Bannir** les commits :

- `chore(format): ...` (Biome, prettier, etc.)
- `chore(release): bump X -> Y` (bumps de version pure)
- `chore(deps): ...` (mises à jour de dépendances sans impact user)
- `ci(...): ...` (config CI, signatures, secrets, runners)
- `test(...): ...` ou `fix(test): ...` (tests internes, timeouts CI)
- `docs(...): ...` quand interne (docs/architecture, _bmad)
- `refactor(...): ...` invisible utilisateur

Garder et reformuler :

- **Nouveautés** = `feat(...)` qui ajoute une capacité visible.
- **Améliorations** = `feat(...)` ou `refactor(...)` qui rend une capacité existante plus utilisable, ou changements UX visibles.
- **Corrections** = `fix(...)` user-facing (bug que Tom ou un beta tester pouvait croiser dans l'app).

## Étape 2 — Reformuler en français user-friendly

Règles de réécriture :

- **Pas de jargon code.** `feat(signature): canvas mac trackpad-flavor` → "Signature au trackpad sur Mac — vous pouvez désormais signer un devis avec votre trackpad, comme sur papier."
- **Pas de scope code.** `feat(quotes/new-ai)` devient juste un point dans Nouveautés ; le scope est implicite (l'utilisateur voit l'écran "Nouveau devis IA", pas le path du fichier).
- **Sujet "vous" ou impersonnel.** Pas de "j'ai ajouté", pas de "le système gère maintenant".
- **Une phrase par point**, deux max. Si un point demande plus, ouvrir un lien commit.
- **Lien commit autorisé** quand utile : `(détails techniques : [abc1234](https://github.com/AlphaLuppi/fakt/commit/abc1234))`. Optionnel.

## Étape 3 — Mettre à jour `CHANGELOG.md`

Si le projet utilise encore le **fichier unique** `CHANGELOG.md` (par défaut) :

1. Ouvrir `CHANGELOG.md`.
2. Trouver la section `## [Unreleased]` en haut.
3. Renommer en `## [$ARGUMENTS] - YYYY-MM-DD` (date du jour, format ISO). **Sans le `v` dans le header** — le tag git porte le `v`, le header du changelog non (cohérence avec l'historique existant).
4. Ré-insérer une section `## [Unreleased]` vide juste au-dessus, avec les 3 sous-sections vides (`### Nouveautés`, `### Améliorations`, `### Corrections`).
5. Compléter la nouvelle section `[$ARGUMENTS]` avec les points reformulés.

Si **dossier `changelogs/`** existe (mode large) :

1. Renommer `changelogs/unreleased.md` → `changelogs/v$ARGUMENTS.md`.
2. Mettre à jour le header avec la date.
3. Recréer un `changelogs/unreleased.md` vide.
4. Mettre à jour `changelogs/README.md` (l'index) avec le nouvel entry.

Bascule **fichier unique → dossier** quand `CHANGELOG.md` dépasse ~500 lignes ou ~10 versions. Le faire dans une session séparée, pas pendant un release.

## Étape 4 — Bumper la version dans le code

Si pas déjà fait :

- `apps/desktop/src-tauri/Cargo.toml` : champ `version = "..."`
- `apps/desktop/src-tauri/tauri.conf.json` : champ `version` si présent
- `apps/desktop/package.json` : champ `version`
- `package.json` racine : champ `version` si présent

Vérifier qu'aucun autre `package.json` du workspace n'a la version codée en dur.

## Étape 5 — Commit + tag + push

```bash
# 1. Commit du CHANGELOG + bumps
git add CHANGELOG.md changelogs/ apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/tauri.conf.json apps/desktop/package.json package.json
git commit -s -m "chore(release): v$ARGUMENTS"

# 2. Tag annoté signé GPG (passphrase déjà cachée)
git tag -s "v$ARGUMENTS" -m "FAKT v$ARGUMENTS"

# 3. Push commit + tag (autorisé direct sur main, pattern Tom solo dev)
git push origin main
git push origin "v$ARGUMENTS"
```

## Étape 6 — Créer la release GitHub

Extraire la section du changelog dans un fichier temporaire :

```bash
# Extraire la section [$ARGUMENTS] jusqu'à la prochaine section ##
awk "/^## \\[$ARGUMENTS\\]/{flag=1; next} /^## \\[/{flag=0} flag" CHANGELOG.md > /tmp/release-notes.md
```

Si dossier `changelogs/` : `cp changelogs/v$ARGUMENTS.md /tmp/release-notes.md`.

Puis créer la release :

```bash
gh release create "v$ARGUMENTS" \
  --title "FAKT v$ARGUMENTS" \
  --notes-file /tmp/release-notes.md
```

**Ne jamais utiliser `--generate-notes`** (c'est l'option qui fout les notes auto-générées GitHub : signatures CI, bumps, etc.). Tout doit venir de `CHANGELOG.md`.

## Étape 7 — Vérification finale

1. Ouvrir `https://github.com/AlphaLuppi/fakt/releases/tag/v$ARGUMENTS` et lire les notes : doivent être identiques au `CHANGELOG.md`, lisibles, sans jargon.
2. Si binaires sont uploadés par CI (workflow `release.yml`), attendre que la CI termine et confirmer leur présence sur la release.
3. Reporter à Tom : version publiée + lien release + nombre de points par catégorie (ex : "3 nouveautés, 2 améliorations, 1 correction").

## Format `CHANGELOG.md` attendu (à partir de v0.1.12)

```markdown
## [Unreleased]

### Nouveautés
### Améliorations
### Corrections

## [0.1.12] - 2026-05-01

### Nouveautés
- **Signature au trackpad sur Mac** — vous pouvez désormais signer un devis avec votre trackpad, comme sur papier.

### Améliorations
- Le canvas de signature est plus naturel et réagit mieux aux gestes lents.

### Corrections
- Le bouton "Annuler" dans le modal IA répond maintenant immédiatement.
```

**Important :** les sections antérieures à v0.1.12 dans `CHANGELOG.md` conservent leur format historique (Added/Changed/Fixed en anglais avec détails techniques). Ne pas les réécrire — c'est de l'archive technique précieuse pour Tom et la mémoire du projet.

## Garde-fous

- **Si le diff `<previous-tag>..HEAD` ne contient AUCUN commit user-facing** (uniquement chore/test/ci) : ne pas créer de release. Demander à Tom s'il veut quand même un tag de maintenance, et dans ce cas mettre une seule ligne dans Améliorations type "Stabilité interne (CI, tests, dépendances)".
- **Si une release existe déjà** pour `v$ARGUMENTS` : ne jamais l'écraser. Stopper et demander.
- **Ne jamais utiliser `--no-verify`** sur le commit de release.
- **Ne jamais skip la signature GPG** sur le tag.
