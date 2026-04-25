# Troubleshooting FAKT

**Audience :** Freelance · Dev contributeur
**Résumé :** Problèmes connus avec leurs solutions + chemins de logs par OS.
**Dernière mise à jour :** 2026-04-25

---

## Logs — où les trouver ?

### Logs trace runtime (crashes app)

Depuis v0.1.3, l'app écrit un log d'exécution persistant qui permet de diagnostiquer les crashes au boot **même quand stderr est avalé** par le mode `windows_subsystem = "windows"`.

| OS | Chemin |
|---|---|
| Windows | `%APPDATA%\com.alphaluppi.fakt\logs\fakt-trace.log` |
| macOS | `~/Library/Application Support/com.alphaluppi.fakt/logs/fakt-trace.log` |
| Linux | `~/.local/share/com.alphaluppi.fakt/logs/fakt-trace.log` |

Pour les crashes **TRÈS précoces** (avant que Tauri n'ait résolu `app_data_dir`), fallback :
- Windows : `%TEMP%\fakt-trace.log`
- Unix : `/tmp/fakt-trace.log`

### Logs sidecar Bun (API server)

| OS | Chemin |
|---|---|
| Windows | `%APPDATA%\fakt\logs\sidecar.log` |
| macOS | `~/Library/Application Support/fakt/logs/sidecar.log` |
| Linux | `~/.local/share/fakt/logs/sidecar.log` |

Format : JSON structuré (1 événement par ligne). Greppez `level:"error"` pour les erreurs.

---

## Problèmes courants

### L'app ne démarre pas / crash silencieux (Windows)

1. Ouvrir le log trace : `%APPDATA%\com.alphaluppi.fakt\logs\fakt-trace.log`
2. Chercher la dernière ligne avec `level:"error"`
3. Si introuvable, fallback : `%TEMP%\fakt-trace.log`

Causes courantes :
- Port 3117 déjà occupé (cf. ci-dessous)
- DB corrompue (cf. ci-dessous)
- Migration SQLite cassée (rare)

### Sidecar ne répond pas / chargement infini

L'app affiche le splash mais rien ne s'ouvre. Le sidecar Bun n'a pas réussi à bind son port.

1. Lire les logs sidecar (chemin OS-spécifique ci-dessus)
2. Vérifier le port avec :
   ```bash
   # Windows
   netstat -ano | findstr :3117
   # macOS / Linux
   lsof -ti:3117
   ```
3. Si occupé : tuer le processus
   ```bash
   # Windows
   taskkill /PID <pid>
   # macOS / Linux
   lsof -ti:3117 | xargs kill
   ```
4. Relancer FAKT

### Sidecar crash-loop (l'app se ferme 3× de suite en <60s)

Tauri implémente un anti-flap : si l'app crashe 3 fois en moins de 60s, elle s'arrête définitivement pour éviter une boucle infinie.

Causes courantes :
- **DB corrompue** : supprimer `~/.fakt/db.sqlite` et relancer (regénération automatique). ⚠️ Cela perd vos données — restaurez depuis un export ZIP avant si possible.
- **Migration cassée** : ouvrir un issue GitHub avec les logs sidecar.
- **Port 3117 toujours pris** : voir ci-dessus.

### Erreur 401 UNAUTHORIZED en dev

Le token `window.__FAKT_API_TOKEN__` n'a pas été injecté.

**Cause typique :** vous avez lancé Vite seul (`bun --cwd apps/desktop run dev`) au lieu de Tauri (`bun run dev`). Vite standalone ne spawn pas le sidecar et n'injecte pas le token.

**Solution :** lancer toujours `bun run dev` à la racine du repo.

### Erreur "Network error: Failed to fetch" à l'onboarding

Bug fixé en v0.1.1 (CORS sidecar manquant). Mettre à jour vers ≥ v0.1.1.

### Erreur "SIRET INVALIDE" alors que le SIRET est correct

Bug fixé en v0.1.2 (normalisation espaces / tirets). Mettre à jour vers ≥ v0.1.2.

### Écran Identity settings vide / Enregistrer ne fait rien

Bug fixé en v0.1.4 (Tauri commands fantômes remplacées par API sidecar). Mettre à jour vers ≥ v0.1.4.

### Signature trop longue (> 1 seconde)

Performance attendue : **< 500ms** (NFR-002 du PRD) pour signer un PDF de < 1 MB.

Si la signature prend > 1 seconde :
- PDF source > 5 MB ? Le hash SHA-256 augmente linéairement.
- TSA FreeTSA timeout (3 secondes par défaut) ? Vérifier votre connexion réseau. Le mode dégradé `B` (sans timestamp) est utilisé en fallback automatique.

### Adobe Reader affiche "signature non vérifiable"

Causes courantes :
- Cert auto-signé non installé dans le store de confiance Adobe (normal, c'est une signature personnelle)
- Pour silencer le warning : installer votre cert public dans Adobe → Préférences → Signatures → Identités et certificats de confiance

### Le client mail ne s'ouvre pas avec le PDF en pièce jointe

`.eml` s'ouvre normalement avec :
- Windows : Outlook (par défaut), Thunderbird, Mailbird
- macOS : Apple Mail (par défaut), Thunderbird, Spark
- Linux : Thunderbird, Evolution, Geary

Si rien ne s'ouvre :
- Définissez un client mail par défaut OS-level
- Fallback : FAKT ouvrira un `mailto:` simple sans pièce jointe

### Claude CLI introuvable / IA inactive

L'app fonctionne sans IA. Pour l'activer :

1. Installer **[Claude Code CLI](https://claude.ai/code)**
2. Configurer votre token Anthropic (`claude login`)
3. Vérifier dans FAKT → Settings → IA : statut doit être **Connecté**

Si toujours **Non détecté** : vérifier que `claude` est dans le `PATH` du shell qui lance FAKT.

---

## Diagnostic avancé

### Mode debug

Lancer FAKT avec :
```bash
FAKT_LOG_LEVEL=debug FAKT_PDF_STUB=1 ./FAKT_0.1.x
```

- `FAKT_LOG_LEVEL=debug` : verbose dans les logs trace
- `FAKT_PDF_STUB=1` : utilise un PDF stub déterministe au lieu d'invoquer Typst (utile pour CI / debug)

### Reset complet (perte de données !)

```bash
# Windows PowerShell
Remove-Item -Recurse "$env:APPDATA\com.alphaluppi.fakt"
Remove-Item -Recurse "$env:USERPROFILE\.fakt"

# macOS / Linux
rm -rf ~/Library/Application\ Support/com.alphaluppi.fakt  # macOS
rm -rf ~/.local/share/com.alphaluppi.fakt  # Linux
rm -rf ~/.fakt
```

⚠️ **Sauvegardez votre ZIP d'export AVANT** ce reset — toutes les données seront perdues.

---

## Aucune de ces solutions n'a fonctionné ?

Ouvrez un issue GitHub avec :

1. Version de FAKT (`Settings → À propos`)
2. OS et version (Windows 11 23H2 / macOS 14.3 / Ubuntu 22.04)
3. Le log trace (`fakt-trace.log`) — copier les 50 dernières lignes
4. Les étapes pour reproduire

[github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues)

Pour les vulnérabilités sécurité : voir [SECURITY.md](../../SECURITY.md) (divulgation responsable).
