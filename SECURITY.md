# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ (stable) |
| < 0.1.0 | ❌ |

## Reporting a vulnerability

Email : **contact@alphaluppi.com** avec `[SECURITY] FAKT` en objet.
Réponse sous 72h. Disclosure coordonnée, fix prioritaire.

Ne **jamais** ouvrir d'issue publique pour un rapport de sécurité.

## Known issues (vulnérabilités acceptées sans fix upstream)

### RUSTSEC-2023-0071 — `rsa 0.9.10` — Marvin Attack timing sidechannel

**Où :** dépendance directe de `fakt` (apps/desktop/src-tauri/Cargo.toml) pour la
signature PAdES B-T + transitive via `cms`.

**Vecteur :** attaque de timing sur les opérations RSA privées. Requiert un
attaquant capable de mesurer avec précision des temps d'exécution sur la même
machine (contexte cloud multi-tenant, adversaire local avec accès shell).

**Impact FAKT :** l'app est **100% locale sur le poste du freelance**. Pour
exploiter il faudrait déjà un accès local au poste — auquel cas l'attaquant a
déjà les clés en mémoire via un debugger. Risque résiduel **très faible**.

**Status upstream :** aucune release de `rsa` ne corrige l'issue ; la crate
est maintenue mais la refonte API pour ECDSA hors timing demande un travail
significatif. Suivi : [rustsec/advisory-db #1631](https://github.com/rustsec/advisory-db/issues/1631).

**Décision :** accepté, documenté ici + `audit.toml`. Re-évaluation à chaque
release de `rsa`.

### RUSTSEC-2026-0097 — `rand 0.7.3` transitive via tauri-utils

**Où :** chaîne `tauri 2.10.x → tauri-utils 2.8.x → kuchikiki → selectors →
phf_generator → rand 0.7`. Aucun contrôle direct.

**Vecteur :** unsoundness dans l'implémentation custom logger de `rand`. Pas
exploitable dans l'usage FAKT (on n'utilise pas le custom logger).

**Impact FAKT :** nul — `rand 0.7` n'est pas dans le chemin runtime de FAKT ;
la crate est tirée uniquement pour le build CSS parser côté Tauri.

**Décision :** ignoré en attendant un bump `tauri` qui upgrade `kuchikiki`.

## Audit policy

- `cargo audit` doit passer en CI — les entrées ignorées sont documentées
  explicitement dans `apps/desktop/src-tauri/audit.toml`.
- `bun audit` : aucune vulnérabilité HIGH ou CRITICAL tolérée. Les MODERATE
  dev-only peuvent être acceptées temporairement avec ticket de suivi.

## Hardening appliqué à FAKT

- **Isolation sidecar** : le sidecar Bun n'écoute que sur `127.0.0.1`, token
  32 bytes en timing-safe comparison (`timingSafeEqual`).
- **CORS whitelist** : `http://localhost:1420`, `tauri://localhost`,
  `http(s)://tauri.localhost` uniquement.
- **CSP Tauri** : `default-src 'self'; script-src 'self'; style-src 'self'
  'unsafe-inline' https://fonts.googleapis.com; font-src 'self'
  https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:*
  https://freetsa.org https://timestamp.digicert.com
  https://timestamp.sectigo.com`.
- **Keychain OS** pour les clés privées signature (Windows Credential Manager
  / macOS Keychain / Linux Secret Service).
- **Fallback keystore chiffré** AES-256-GCM + PBKDF2-SHA256 100k iter si
  keychain indisponible.
- **Audit chain append-only** sur les events de signature (SHA-256 chainé,
  trigger SQL `signature_events_no_update` + `_no_delete`).
- **Numérotation atomique** CGI art. 289 : `BEGIN IMMEDIATE` SQLite + unique
  constraint DB sur `(workspace_id, year, type, sequence)`.
- **Zip Slip protection** : `build_workspace_zip` sanitize tous les `entry.name`
  avant construction du path ZIP.
- **Symlink resolve** : `open_email_draft` canonicalise le path avant de
  dispatcher vers `rundll32`/`open`/`xdg-open`.
- **Shell injection** : jamais de `cmd /C start` — toujours `rundll32
  url.dll,FileProtocolHandler` (pas de shell parsing).

## Release signing

- **Windows** : Authenticode **non signé** en v0.1.x — SmartScreen affichera
  "Unknown Publisher". Fix prévu en v0.2.0 avec certificat OV/EV.
- **macOS** : **non notarisé** en v0.1.x — Gatekeeper peut bloquer. Clic droit
  → Ouvrir pour contourner.
- **Linux** : `.deb` non signé par clé GPG pour le moment.

Les hash SHA-256 des binaires de release sont disponibles sur la page GitHub
Release correspondante.
