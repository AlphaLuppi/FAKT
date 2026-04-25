# Installer FAKT

**Audience :** Freelance · Utilisateur lambda
**Résumé :** Téléchargez l'installeur de votre OS et lancez. ~3 minutes.
**Dernière mise à jour :** 2026-04-25

---

## Télécharger

Rendez-vous sur **[la page Releases GitHub](https://github.com/AlphaLuppi/FAKT/releases/latest)** et téléchargez l'installeur correspondant à votre OS.

### Windows — fichier `.msi`

Double-cliquez sur l'installeur, suivez l'assistant.

> **Note v0.1.0 :** l'installeur Windows n'est pas encore signé Authenticode (signature prévue v0.1.x ultérieure). Windows SmartScreen affichera "Unknown Publisher" — clic sur **"Plus d'infos"** puis **"Exécuter quand même"**.

### macOS — fichier `.dmg` (Universal Intel + Apple Silicon)

Ouvrez le `.dmg` et glissez FAKT dans Applications.

> Si Gatekeeper bloque l'ouverture (l'app n'est pas notarisée en v0.1.0) : clic droit sur l'app dans Applications → **Ouvrir** → confirmer.

### Linux — `.AppImage` ou `.deb`

```bash
# AppImage (toutes distributions)
chmod +x FAKT_0.1.x_amd64.AppImage
./FAKT_0.1.x_amd64.AppImage

# Debian / Ubuntu
sudo dpkg -i FAKT_0.1.x_amd64.deb
```

## Premier lancement

Au premier lancement, FAKT affiche un wizard d'onboarding (~2 minutes) pour configurer votre workspace :

1. **Nom légal** (votre nom de freelance ou raison sociale)
2. **SIRET** (14 chiffres)
3. **Forme juridique** (Micro-entreprise, EI, EURL, SASU…)
4. **Adresse complète**
5. **Email professionnel**
6. **IBAN** (optionnel)
7. **Régime TVA** (par défaut : "TVA non applicable, art. 293 B du CGI" pour micro-entreprise)

Un **certificat X.509 RSA 4096 de signature** est généré automatiquement et stocké dans le keychain de votre OS (jamais sur disque en clair) :

- **Windows** : Windows Credential Manager (DPAPI)
- **macOS** : Keychain.app
- **Linux** : Secret Service / GNOME Keyring

C'est tout — FAKT est prêt. Vous pouvez créer votre premier client et émettre votre premier devis.

## Données stockées

FAKT crée les emplacements suivants sur votre machine :

| Donnée | Emplacement |
|---|---|
| Base de données SQLite (factures, devis, clients) | `~/.fakt/db.sqlite` |
| PDFs signés en cache | `app_data_dir/signed/` |
| Numérotation atomique (CGI art. 289) | `app_data_dir/numbering.sqlite` |
| Logs trace runtime | `app_data_dir/logs/fakt-trace.log` |
| Sessions IA Claude | `app_data_dir/ai-sessions.json` |
| Cert + clé privée | Keychain OS |

`app_data_dir` selon votre OS :
- Windows : `%APPDATA%\com.alphaluppi.fakt\`
- macOS : `~/Library/Application Support/com.alphaluppi.fakt/`
- Linux : `~/.local/share/com.alphaluppi.fakt/`

## Taille de l'installeur

L'installeur fait actuellement **~100 Mo** (Tauri 2 + sidecar Bun bundle). C'est cohérent avec les apps desktop modernes (Slack 200 Mo, Discord 150 Mo, Obsidian 120 Mo).

Un **port Rust du sidecar** est envisagé en v0.2+ pour réduire la taille à ~20 Mo. Cf. [roadmap.md](roadmap.md).

## Configuration IA (optionnel)

Pour utiliser les fonctionnalités IA (extraction de devis depuis un brief, rédaction de relances), installez **[Claude Code CLI](https://claude.ai/code)** et fournissez votre propre token Anthropic. FAKT ne stocke jamais votre token — il appelle Claude CLI en subprocess.

## Et après ?

- [usage.md](usage.md) — Guide d'utilisation pas-à-pas
- [troubleshooting.md](troubleshooting.md) — Si vous rencontrez un problème
- [features.md](features.md) — Toutes les fonctionnalités disponibles
