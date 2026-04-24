# Release process — FAKT

Ce document décrit la procédure complète pour publier une release FAKT
signée et auto-updatable côté utilisateur via `tauri-plugin-updater` v2.

> Audience : Tom Andrieu (mainteneur principal). Pour la première mise en
> place ou en cas de rotation des clés, suivre la section
> [Génération de la keypair](#génération-de-la-keypair).

---

## TL;DR — Release habituelle (keypair déjà configurée)

1. Bump la version dans `apps/desktop/package.json`,
   `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/tauri.conf.json`.
2. Mettre à jour `CHANGELOG.md` avec l'entrée de la nouvelle version.
3. Commit DCO + GPG : `git commit -s -S -m "release(vX.Y.Z): ..."`
4. Tag : `git tag -s vX.Y.Z -m "FAKT vX.Y.Z"` (signé GPG).
5. Push : `git push && git push --tags`.
6. La CI (`.github/workflows/release.yml`) :
   - Build MSI/NSIS Windows, .app+DMG macOS universal, .deb Linux.
   - Signe les artifacts updater (`.sig`) avec la clé privée stockée en secret.
   - Publie tous les artifacts + `latest.json` sur la GitHub Release.
7. Dès que la release est publiée, n'importe quelle FAKT déjà installée chez
   un utilisateur affichera la bannière « Mise à jour disponible » au boot.

---

## Architecture du système d'update

```
                                                     +---------------+
  Tom : git push tag vX.Y.Z                          | GitHub        |
            │                                        | Release       |
            ▼                                        | vX.Y.Z        |
  +-------------------+      build + sign           +---------------+
  | release.yml CI    |─────────────────────────►   │ FAKT_X.Y.Z_   │
  | tauri-action      |                             │   x64-setup.exe│
  | TAURI_SIGNING_*   |                             │ FAKT_X.Y.Z_   │
  +-------------------+                             │   x64-setup.exe.sig│
                                                    │ FAKT.app.tar.gz │
                                                    │ FAKT.app.tar.gz.sig │
                                                    │ latest.json     │
                                                    └─────┬───────────┘
                                                          │
            ┌─────────────────────────────────────────────┘
            │ HTTPS (poll au boot)
            ▼
  +-------------------+
  | FAKT.exe installé |  endpoints = [https://github.com/AlphaLuppi/FAKT/
  | tauri-plugin-     |    releases/latest/download/latest.json]
  | updater v2        |
  | + pubkey embed.   |  ─ vérifie sig minisign ed25519 contre pubkey
  +-------------------+    ─ si OK : DL artifact + relaunch via plugin-process
```

Points clés :

- L'endpoint `releases/latest/download/latest.json` est résolu par GitHub
  vers la **dernière release** (pas un tag fixe). Pas de DNS/serveur custom
  à maintenir.
- La signature est **minisign ed25519** (clé Tauri standard, pas
  Authenticode Windows ni notarization Apple). Elle vérifie l'intégrité +
  l'origine du paquet, **pas** le code signing OS.
- Authenticode (Windows SmartScreen) et Notarization (macOS Gatekeeper)
  sont des features distinctes prévues pour v0.1.1+.

---

## Génération de la keypair

À faire **une seule fois** au moment de configurer le système d'update sur
un repo neuf (ou en cas de rotation de la clé compromise — note : rotation
casse l'auto-update pour les users sur l'ancienne version, ils devront
réinstaller manuellement).

### 1. Générer la paire de clés

```bash
# Sans mot de passe (plus simple en CI, OK pour repo personnel)
bun --cwd apps/desktop tauri signer generate \
  --write-keys ~/.tauri/fakt-updater.key \
  --force --ci

# Avec mot de passe (recommandé long-terme)
bun --cwd apps/desktop tauri signer generate \
  --write-keys ~/.tauri/fakt-updater.key \
  --password 'MOT_DE_PASSE_FORT'
```

Cela produit :
- `~/.tauri/fakt-updater.key` (privée — **ne jamais commit**, à backup en
  password manager).
- `~/.tauri/fakt-updater.key.pub` (publique — à coller dans
  `tauri.conf.json` → `plugins.updater.pubkey`).

### 2. Insérer la pubkey dans la config Tauri

```jsonc
// apps/desktop/src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/AlphaLuppi/FAKT/releases/latest/download/latest.json"
      ],
      "pubkey": "<contenu-de-fakt-updater.key.pub>",
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

La pubkey est une string base64 commençant par `dW50cnVzdGVkIGNvbW1lbnQ6...`.

### 3. Pousser la clé privée en secret GitHub

```bash
# Avec gh CLI (recommandé)
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/fakt-updater.key

# Si la clé a un mot de passe, ajouter aussi :
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --body 'MOT_DE_PASSE'
```

Sinon, via l'UI GitHub :
1. Settings → Secrets and variables → Actions → New repository secret.
2. Nom : `TAURI_SIGNING_PRIVATE_KEY`, Valeur : contenu **brut** du fichier
   `.key` (pas le path, le contenu base64).
3. Si la clé a un mot de passe, second secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### 4. Backup de la clé privée

**Critique.** Si la clé privée est perdue :
- Plus moyen de signer de nouvelles updates compatibles avec les versions
  déjà déployées.
- Tous les users existants devront DL+installer manuellement la prochaine
  version (qui aura une nouvelle pubkey).

Backup recommandés :
- Password manager (1Password, Bitwarden) : ajouter le contenu
  `.key` + `.pub` en note sécurisée.
- Disque externe chiffré.
- **Pas** de cloud non chiffré, **pas** de gist GitHub privé.

---

## Tester en local avant release

### Mode dev — endpoint local

1. Bump `apps/desktop/src-tauri/tauri.conf.json` → `version` à
   **moins** que la dernière release publiée (ex : si prod = 0.1.10, mettre
   localement 0.1.9 pour simuler une vieille install).
2. `bun --cwd apps/desktop tauri:dev` (ou `bun run dev`).
3. Au boot, l'app contacte l'endpoint GitHub et la bannière jaune
   « Mise à jour disponible — vX.Y.Z » apparaît en haut.
4. Clic « Installer maintenant » → modale + DL + relaunch (en dev, le
   relaunch ne fonctionne pas car le bundle dev n'est pas installé, mais le
   DL et la vérification de signature sont testés).

### Test E2E — flow complet (post-release)

1. Faire une release de test : tag `v0.1.10-test1` push.
2. Sur une machine vierge : DL la précédente version stable (ex 0.1.9), installer.
3. Lancer l'app : la bannière apparaît immédiatement.
4. Clic install : DL + sig check + relaunch dans la nouvelle version.
5. Vérifier `Settings → À propos` (ou About menu) que la version est bien
   la nouvelle.

---

## Bump de version (checklist)

Avant tout `git tag`, vérifier que les **3 fichiers de version** sont
synchronisés :

| Fichier                                           | Champ                       |
|---------------------------------------------------|-----------------------------|
| `apps/desktop/package.json`                       | `"version"`                 |
| `apps/desktop/src-tauri/Cargo.toml`               | `[package] version`         |
| `apps/desktop/src-tauri/tauri.conf.json`          | top-level `"version"`       |

Le `latest.json` généré par `tauri-action` reflète ces valeurs.

---

## Diagnostic en cas de problème

| Symptôme | Cause probable | Fix |
|----------|----------------|-----|
| App au boot ne montre pas de bannière alors qu'une release est dispo | endpoint 404, pubkey mismatch, version locale ≥ remote | console DevTools → erreur du plugin updater |
| Erreur « signature mismatch » à l'install | la release a été signée avec une clé ≠ celle dont la pubkey est dans le binaire | re-générer la release CI (peut-être un secret pas à jour) |
| Bannière OK mais install fail Windows | NSIS bundle absent de la release | vérifier `bundle.targets` contient `"nsis"` + `updaterJsonPreferNsis: true` dans release.yml |
| Sur Linux, pas d'auto-update proposée | `.deb` ne supporte pas l'auto-update in-place ; on n'expose pas Linux dans `latest.json` en v0.1.x | user re-DL le `.deb` manuellement |

Logs côté app : `%APPDATA%\fakt\logs\` (Windows) ou
`~/Library/Application Support/fakt/logs/` (macOS) — fichier `trace.log`
inclut les erreurs du plugin updater.

---

## Rotation de clé (cas critique)

Si la clé privée est compromise :

1. Générer une nouvelle keypair (étape 1 ci-dessus).
2. Remplacer la pubkey dans `tauri.conf.json`.
3. Update les secrets GitHub avec la nouvelle clé privée.
4. Bump version (**majeure** si possible — signal aux users).
5. Communiquer aux users existants qu'ils doivent **DL+install manuellement**
   la nouvelle version (l'auto-update va échouer car la pubkey embarquée
   dans leur binaire ne match plus la nouvelle clé). Mention dans le
   CHANGELOG + bannière sur le site.
6. Une fois tous les users migrés (~ semaines), oublier l'ancienne clé.
