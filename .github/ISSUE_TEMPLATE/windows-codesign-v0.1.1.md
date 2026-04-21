---
name: "Windows Authenticode signing (v0.1.1)"
about: "Suivi de l'ajout de la signature Authenticode sur l'installeur Windows .msi"
title: "feat: Windows Authenticode code-signing pour installer .msi (v0.1.1)"
labels: ["release", "platform/windows", "security"]
assignees: ["Seeyko"]
---

## Contexte

En v0.1.0, l'installeur Windows `.msi` est distribué **non signé**.
Windows SmartScreen affiche un avertissement « Unknown Publisher » à l'installation.
Ce comportement est documenté dans les release notes v0.1.0 et CHANGELOG.md.

Décision Tom Andrieu 2026-04-22 : skip v0.1.0, implémenter en v0.1.1.

## Travail à effectuer

- [ ] Commander un certificat OV (Organization Validated) Authenticode chez DigiCert, Sectigo, ou GlobalSign (~80-200 USD/an).
- [ ] Exporter le certificat au format `.pfx` + mot de passe.
- [ ] Ajouter les secrets GitHub dans `AlphaLuppi/FAKT` → Settings → Secrets :
  - `WINDOWS_CERTIFICATE` (base64 du `.pfx`)
  - `WINDOWS_CERTIFICATE_PASSWORD`
- [ ] Mettre à jour `.github/workflows/release.yml` pour déclarer ces secrets dans l'env du step `tauri-action`.
- [ ] Vérifier que le `.msi` généré affiche bien "AlphaLuppi" comme Publisher dans SmartScreen.
- [ ] Tagger v0.1.1 avec les installers signés.

## Références

- [tauri-apps/tauri-action : Windows signing](https://github.com/tauri-apps/tauri-action#windows)
- [Documentation Tauri : Code signing Windows](https://tauri.app/distribute/sign/windows/)
- Workflow release : `.github/workflows/release.yml`
