# Guide d'utilisation FAKT

**Audience :** Freelance · Utilisateur lambda
**Résumé :** Workflow complet en 7 étapes : du client au PDF signé archivé.
**Dernière mise à jour :** 2026-04-25

---

## Workflow standard

### 1. Créer un client

**Menu Clients → Nouveau client.**

Renseignez :
- Nom (raison sociale ou nom complet)
- SIRET (optionnel mais recommandé pour la traçabilité)
- Adresse
- Email de contact (utilisé pour les envois email)
- Secteur d'activité (optionnel, pour vos statistiques)
- Note interne (optionnel)

Validation Zod côté API : email format, SIRET 14 chiffres si fourni.

### 2. Créer un devis

**Menu Devis → Nouveau devis.**

1. Sélectionner un client
2. Donner un titre au devis
3. Ajouter des lignes :
   - Soit depuis votre **bibliothèque de prestations** (réutilisables)
   - Soit en saisie manuelle (description, quantité, prix unitaire HT, unité)
4. Définir les conditions de paiement et la date de validité
5. Ajouter des notes (visibles sur le PDF)

Le numéro `D2026-0001` est attribué **atomiquement** au moment de l'émission (CGI art. 289). Tant que le devis est en statut `draft`, pas de numéro.

### 3. Générer avec l'IA (optionnel)

Si vous avez Claude Code CLI configuré :

1. Ouvrir le **Composer IA** (sidebar droite)
2. Coller votre brief client (email, transcription d'appel, mémo)
3. Cliquer **Extraire**

L'IA extrait : titre, contexte, lignes de prestations probables (avec quantités estimées), conditions usuelles. Vous validez/ajustez ligne par ligne.

**Confidentialité :** votre brief part chez Anthropic via VOTRE token Claude. AlphaLuppi ne voit rien.

### 4. Prévisualiser et émettre

1. Cliquer **Prévisualiser** pour voir le PDF (rendu Typst, fidèle aux templates `/devis-freelance` et `/facture-freelance`)
2. Si OK, cliquer **Émettre** — le devis passe en statut `sent` et reçoit son numéro définitif

### 5. Signer

**Menu Actions → Signer le document.**

1. La modal de signature s'ouvre
2. Tracez votre signature manuscrite à la souris ou au stylet
3. Renseignez nom + email du signataire
4. Cliquer **Signer**

FAKT génère localement :
- Une signature **PAdES B-T** (RSA 4096 + SHA-256 + horodatage RFC 3161 via FreeTSA)
- Une entrée d'audit dans la chaîne de signature (`previous_event_hash` chaîné en SHA-256)
- Le PDF signé est sauvegardé dans `app_data_dir/signed/`

**Niveau eIDAS :** Avancé (AdES-B-T). Pas qualifié (impossible sans accréditation ANSSI).

Vérifiable dans Adobe Reader, Foxit, ou tout outil PAdES standard.

### 6. Préparer l'email

**Menu Actions → Préparer email.**

Sélectionnez un template (relance, envoi devis, envoi facture) — FAKT génère un brouillon `.eml` avec :
- Destinataire : email du client
- Sujet pré-rempli
- Corps formaté FR
- PDF en pièce jointe

Le `.eml` s'ouvre dans **votre client mail OS par défaut** (Outlook, Apple Mail, Thunderbird, etc.). Vous relisez et envoyez vous-même.

> FAKT n'envoie jamais d'email automatiquement. Vous gardez le contrôle de votre boîte d'envoi.

### 7. Convertir en facture

Une fois le devis signé par le client (statut `signed`), un clic depuis le devis :

**Menu Actions → Créer la facture.**

FAKT crée la facture avec :
- Le client copié
- Les lignes copiées
- Un nouveau numéro `F2026-0001` (attribué atomiquement)
- Lien `quoteId` vers le devis source
- Statut initial `draft`

Vous éditez si besoin (acompte, échéance), émettez, signez (idem), envoyez par email.

### 8. Suivre les paiements

**Menu Factures → liste filtrée.**

États : `draft` → `sent` → `paid` ou `overdue`.

Quand le paiement arrive :
1. Ouvrir la facture
2. **Menu Actions → Marquer payée**
3. Renseigner date paiement, méthode (virement / chèque / espèces / autre), notes

L'activity feed enregistre l'événement.

### 9. Archive et compliance

**Menu Archive → Exporter le workspace (ZIP).**

Le ZIP contient :
- `clients.csv` — toute votre base clients
- `prestations.csv` — votre bibliothèque de prestations
- `quotes.csv` + dossier `quotes/` avec tous les PDFs signés
- `invoices.csv` + dossier `invoices/` avec tous les PDFs signés
- `audit.csv` — événements de signature avec hash chaînés

Conservez ce ZIP **10 ans** (obligation légale française pour les factures émises).

## Raccourcis clavier

| Action | Windows / Linux | macOS |
|---|---|---|
| Nouveau client | `Ctrl+Shift+C` | `⌘+Shift+C` |
| Nouveau devis | `Ctrl+Shift+D` | `⌘+Shift+D` |
| Nouvelle facture | `Ctrl+Shift+F` | `⌘+Shift+F` |
| Recherche globale | `Ctrl+K` | `⌘+K` |
| Composer IA | `Ctrl+I` | `⌘+I` |

## Pour aller plus loin

- [features.md](features.md) — Toutes les fonctionnalités v0.1.0
- [troubleshooting.md](troubleshooting.md) — Problèmes courants
- [security-compliance.md](security-compliance.md) — Compliance CGI / eIDAS / RGPD
