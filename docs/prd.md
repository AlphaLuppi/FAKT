# Product Requirements Document — FAKT

**Date :** 2026-04-21
**Auteur :** Tom Andrieu (AlphaLuppi)
**Version :** 1.0
**Type de projet :** Application desktop open-source (Tauri 2, pattern AlphaLuppi « outil interne »)
**Niveau de projet :** 3 (Complex integration — 12-40 stories)
**Statut :** Draft — en attente de validation pour passage à `/architecture`

---

## Document Overview

Ce PRD définit les exigences fonctionnelles et non-fonctionnelles de **FAKT v0.1.0** (MVP). Il s'appuie directement sur le Product Brief validé (`docs/product-brief.md`) et sur les 10 arbitrages par défaut validés par le user (`_bmad-output/product-brief.md`, section finale).

**Documents liés :**
- Product Brief : [`docs/product-brief.md`](./product-brief.md)
- Config BMAD : [`../bmad/config.yaml`](../bmad/config.yaml)
- Status workflow : [`bmm-workflow-status.yaml`](./bmm-workflow-status.yaml)
- Instructions agents : [`../CLAUDE.md`](../CLAUDE.md)
- Design system source : `.design-ref/gestion-de-facture-et-devis/project/` (bundle local)

**Champ d'application :** MVP v0.1.0 cible le **mode solo local** (SQLite, mono-user, pas d'auth). Les modes self-host entreprise (v0.2) et SaaS (v0.3) sont hors du scope de ce PRD — ils feront l'objet d'un PRD dédié au moment venu.

---

> **Addendum 2026-04-22 — NFR-003 révisé à ~100 Mo**
> Suite au bundling Bun compiled du sidecar api-server (refacto sidecar de la v0.1), la taille binaire réelle est ~100 Mo (équivalent Slack/Discord/Obsidian). Port Rust envisagé v0.2 pour revenir à ~20 Mo. Le critère release-blocking est fonctionnel (démarrage ≤ 2 s, app dogfoodable), pas la taille binaire. Voir [CHANGELOG.md](/CHANGELOG.md) section Changed. Les mentions « ~5 Mo » / « ≤ 15 Mo » ci-dessous sont conservées pour traçabilité mais doivent être lues comme « ~100 Mo (objectif v0.2 : ~20 Mo via port Rust sidecar) ».

---

## Executive Summary

FAKT est une application desktop native (Tauri 2 + sidecar Bun compiled, ~100 Mo — objectif v0.2 : ~20 Mo via port Rust sidecar) qui permet à un freelance français en micro-entreprise de piloter son cycle complet de devis et factures : génération IA depuis un brief client, édition, rendu PDF conforme à la législation FR, signature électronique avancée PAdES maison, et préparation de brouillon email.

**Objectif v0.1.0 (échéance 2026-05-12) :** remplacer à 100 % les skills Claude Code `/devis-freelance` et `/facture-freelance` pour l'usage personnel de Tom Andrieu, puis shipper en open-source pour adoption par la communauté freelance FR.

**Contrainte majeure :** la stack est arrêtée (Tauri 2, Bun, Drizzle SQLite, Typst, Claude CLI subprocess, PAdES maison). Les décisions d'architecture détaillées (crates Rust précises, structure Typst, IPC, state management) sont déférées au workflow `/architecture`.

---

## Product Goals

### Business Objectives

1. **Remplacement des skills legacy** — Tom utilise FAKT pour 100 % de ses nouveaux documents dans les 30 jours suivant la release v0.1.0.
2. **Vitrine pattern AlphaLuppi** — établir FAKT comme deuxième référence (après MnM) du pattern « outil interne AlphaLuppi » pour accélérer les projets futurs.
3. **Adoption communauté** — 10 étoiles GitHub à T+1 mois, 50 à T+3 mois.
4. **Fondation revenu SaaS** — préparer v0.2 self-host puis v0.3 SaaS hébergé (~12 €/user/mois) avec 3 premiers clients payants à horizon Q4 2026.

### Success Metrics

- **Adoption perso (go/no-go) :** 0 invocation des skills legacy pendant 30 jours post-launch.
- **Fiabilité signature :** 0 PDF signé par FAKT rejeté par Adobe Reader / Foxit / pyHanko pendant 6 mois.
- **Performance installer :** taille binaire ~100 Mo (objectif v0.2 ~20 Mo via port Rust sidecar) — NFR-003 révisé 2026-04-22 ; le critère release-blocking est fonctionnel (démarrage ≤ 2 s, app dogfoodable), pas la taille binaire. Startup ≤ 2 s sur MacBook Air M1 ou PC Win11 i5.
- **Qualité code :** coverage tests >= 70 % sur `packages/core` et `packages/pdf`, 0 warning lint/typecheck en CI.
- **Star velocity :** ≥ 10 stars GitHub à 30 jours post-release.

---

## Functional Requirements

Les exigences fonctionnelles (FR) définissent **ce que** le système fait. Chaque FR est priorisée selon MoSCoW : **Must Have** = critique MVP, **Should Have** = important mais contournable, **Could Have** = nice-to-have.

---

### FR-001 : Assistant de premier lancement

**Priority :** Must Have

**Description :**
Au premier lancement de FAKT, un assistant multi-étapes guide l'utilisateur pour capturer son identité légale (nom, forme juridique, SIRET, adresse, email, IBAN, mention TVA), vérifier la disponibilité de Claude Code CLI, et générer son certificat X.509 personnel. L'assistant n'est jamais montré à nouveau après complétion.

**Acceptance Criteria :**
- Given : première exécution de l'app (aucune DB SQLite existante)
- When : l'utilisateur lance FAKT
- Then : l'assistant apparaît avec 4 étapes (Identité, Claude CLI, Certificat, Prêt)
- And : chaque étape est validable indépendamment avec feedback visuel brutalist
- And : à la complétion, un workspace mono-user est créé en DB avec les données saisies
- And : au 2e lancement, FAKT ouvre directement le dashboard sans re-afficher l'assistant

**Dependencies :** FR-002, FR-003

---

### FR-002 : Génération et stockage du certificat X.509 personnel

**Priority :** Must Have

**Description :**
FAKT génère automatiquement un certificat X.509 auto-signé (RSA 4096 bits, validité 10 ans) associé au nom légal et email de l'utilisateur. La clé privée est stockée chiffrée dans le keychain OS natif (Windows Credential Manager, macOS Keychain, Linux Secret Service). Le certificat public est stocké dans la DB SQLite pour référence dans les signatures futures.

**Acceptance Criteria :**
- Given : utilisateur à l'étape « Certificat » de l'assistant
- When : il clique « Générer mon certificat »
- Then : une paire de clés RSA 4096 est générée côté Rust (via crate `rsa` ou `openssl`)
- And : le Subject DN du cert contient `CN=<nom_legal>, emailAddress=<email>, O=<nom_workspace>`
- And : la clé privée est persistée dans le keychain OS avec un service name unique FAKT
- And : le certificat public (PEM) est enregistré dans la table `settings` de la DB
- And : en cas d'échec keychain, fallback vers fichier chiffré AES-256 dans `~/.fakt/keys/`

**Dependencies :** aucune (isolé)

---

### FR-003 : Détection de Claude Code CLI

**Priority :** Must Have

**Description :**
FAKT vérifie la présence et la version de Claude Code CLI installée sur la machine (`claude --version`). Si absent, FAKT affiche des instructions d'installation plateform-aware (macOS brew, Windows winget, Linux curl) et permet de continuer en mode manuel (création de documents sans IA).

**Acceptance Criteria :**
- Given : lancement de l'assistant ou ouverture du composer IA
- When : FAKT exécute `claude --version` en subprocess (timeout 5 s)
- Then : si retour 0 et version parsée, state `claude_cli_status = "ready"`
- Else : state `claude_cli_status = "missing"`, affichage d'un panel brutalist avec lien de documentation
- And : l'utilisateur peut skipper cette étape et continuer sans IA (toutes les autres features restent fonctionnelles)
- And : re-detection automatique à chaque ouverture du composer IA (pas besoin de relancer l'app)

**Dependencies :** aucune

---

### FR-004 : Paramètres workspace

**Priority :** Must Have

**Description :**
Écran de paramètres permettant d'éditer l'identité du workspace (nom, SIRET, adresse, email, IBAN, mention TVA, logo optionnel), les préférences d'affichage (langue FR seule en v0.1), et les réglages techniques (chemin de stockage, opt-in télémétrie désactivé par défaut, vérification mise à jour).

**Acceptance Criteria :**
- Given : utilisateur connecté au dashboard
- When : il ouvre l'écran Settings (icône engrenage sidebar)
- Then : formulaire brutalist affiche les champs identité + préférences
- And : modification validée met à jour la DB et se reflète immédiatement sur les templates de devis/facture générés par la suite
- And : les documents **déjà émis** ne sont pas rétroactivement modifiés
- And : un bouton « Exporter ma sauvegarde » déclenche FR-021
- And : un toggle « Participer à la télémétrie anonyme (Plausible self-host) » est désactivé par défaut

**Dependencies :** FR-021

---

### FR-005 : CRUD clients

**Priority :** Must Have

**Description :**
Gestion complète des clients : création, édition, désactivation (soft delete — pas de hard delete pour préserver l'intégrité des documents historiques liés). Chaque client a les attributs : nom, forme juridique, SIRET, adresse, contact principal, email, secteur d'activité, date de première collaboration, note libre.

**Acceptance Criteria :**
- Given : utilisateur sur l'écran Clients
- When : il clique « Nouveau client »
- Then : modal brutalist avec formulaire (10 champs listés ci-dessus, SIRET en monospace JetBrains)
- And : validation SIRET format (14 chiffres, algorithme Luhn optionnel en v0.1)
- And : contraintes DB : `name` NOT NULL, `email` UNIQUE par workspace
- And : l'édition d'un client existant affiche une alerte s'il est référencé par ≥ 1 document émis
- And : désactivation (archivage) déplace le client dans un onglet « Archivés » masqué par défaut
- And : tri par nom, date de création, nombre de documents associés

**Dependencies :** aucune

---

### FR-006 : CRUD prestations

**Priority :** Must Have

**Description :**
Bibliothèque de prestations réutilisables pour peupler les lignes de devis et factures. Chaque prestation a : nom, description libre, unité (forfait, jour, heure, page, écran, mois…), prix unitaire HT, tags (dev, design, conseil, formation…).

**Acceptance Criteria :**
- Given : utilisateur sur l'écran Prestations
- When : il crée une nouvelle prestation
- Then : modal avec formulaire (5 champs)
- And : le prix unitaire est en euros, stocké en centimes (integer) pour éviter les erreurs flottantes
- And : les tags sont sélectionnables parmi une liste prédéfinie + ajout libre
- And : lors de la création d'une ligne de devis, l'utilisateur peut soit choisir une prestation de la biblio, soit créer une ligne custom (pas de dépendance hard à la biblio)

**Dependencies :** aucune

---

### FR-007 : Recherche et tri transverse

**Priority :** Should Have

**Description :**
Barre de recherche globale (raccourci clavier `Cmd+K` ou `Ctrl+K`) qui scanne clients, prestations, devis, factures par nom, numéro de document, email client, mot-clé libre. Résultats groupés par type dans un overlay brutalist Raycast-like.

**Acceptance Criteria :**
- Given : utilisateur dans n'importe quelle vue
- When : il appuie `Cmd+K`
- Then : overlay centré avec input search + résultats live
- And : recherche case-insensitive, accent-insensitive (fuzzy matching simple avec `fuse.js` côté front ou SQL `LIKE` côté backend Rust)
- And : sélection d'un résultat navigue directement vers la vue correspondante
- And : `Escape` ou clic backdrop ferme l'overlay

**Dependencies :** FR-005, FR-006, FR-008, FR-013

---

### FR-008 : Création manuelle de devis

**Priority :** Must Have

**Description :**
Création d'un devis depuis un formulaire : sélection du client (ou création rapide inline), intitulé, lignes (description, quantité, prix unitaire HT, unité), conditions de paiement, validité (date d'expiration), notes libres.

**Acceptance Criteria :**
- Given : utilisateur clique « Nouveau devis » (dashboard ou sidebar)
- When : il remplit le formulaire manuellement
- Then : un brouillon (`status = draft`) est créé en DB avec numérotation temporaire
- And : les lignes peuvent être ajoutées depuis la biblio de prestations (FR-006) ou en saisie libre
- And : le total HT est recalculé live à chaque modification de ligne
- And : la validité par défaut est J+30 jours (configurable en settings)
- And : la validation finale (bouton « Émettre ») attribue un numéro définitif D`{année}`-`{sequence}` (FR-010) et passe le statut à `sent` si option cochée

**Dependencies :** FR-005, FR-006, FR-010

---

### FR-009 : Création de devis assistée par IA (subprocess Claude CLI)

**Priority :** Must Have

**Description :**
Depuis un brief client (texte collé, fichier `.eml` déposé, ou PDF uploadé jusqu'à 20 Mo), l'IA extrait client + phases + montants + conditions et propose un devis pré-rempli à éditer avant émission. L'appel se fait par subprocess Claude Code CLI avec un prompt orchestré et une attente de réponse JSON structurée.

**Acceptance Criteria :**
- Given : utilisateur ouvre le composer IA (sidebar brutalist)
- When : il colle un brief ou drop un fichier
- Then : le composer affiche un indicateur de progression pendant que `claude -p "..."` tourne en subprocess
- And : Claude CLI reçoit un prompt structuré incluant le contexte workspace (identité) + le brief + instructions de retour JSON avec schéma client / lignes / conditions
- And : le JSON retourné est validé côté Rust (Zod-équivalent, ex : `serde` + schema validation)
- And : si validation OK, un ExtractedCard brutalist affiche le contenu pré-rempli avec boutons « Générer le devis » et « Ajuster manuellement »
- And : si Claude CLI absent (FR-003 state), un fallback message invite à installer Claude CLI ou utiliser la création manuelle (FR-008)
- And : si le brief est trop long (> 30 000 tokens), affichage d'un warning et troncature intelligente

**Dependencies :** FR-003, FR-005, FR-008, FR-010

---

### FR-010 : Numérotation séquentielle conforme CGI

**Priority :** Must Have (bloquant légal)

**Description :**
Les devis et factures reçoivent un numéro séquentiel sans trous, conforme au Code Général des Impôts (CGI art. 289). Format : `{type}{année}-{sequence}` — exemples `D2026-014`, `F2026-021`. La séquence est incrémentée atomiquement en transaction SQLite. Aucune facture ne peut être supprimée ou réémise avec un numéro recyclé.

**Acceptance Criteria :**
- Given : le workspace a émis 13 devis en 2026 (numéros D2026-001 à D2026-013)
- When : un 14e devis est émis
- Then : il reçoit obligatoirement le numéro D2026-014
- And : l'incrémentation utilise `INSERT ... RETURNING` ou `BEGIN IMMEDIATE` transaction SQLite pour éviter les race conditions
- And : si le devis est annulé avant émission (`draft → deleted`), son numéro n'est PAS recyclé — on saute directement au suivant
- And : au passage d'année (31 décembre 23h59 → 1er janvier 00h00), la séquence redémarre à 001 pour la nouvelle année
- And : la table `numbering_state` stocke `{workspace_id, year, type, last_sequence}` comme source de vérité

**Dependencies :** aucune (FR critique en dépendance de FR-008, FR-013, FR-016)

---

### FR-011 : Édition de devis et recalcul live

**Priority :** Must Have

**Description :**
Un devis en statut `draft` ou `sent` peut être édité. Les champs éditables incluent : client (si remplacement autorisé par règles), lignes, conditions, validité, notes. Les totaux sont recalculés live à chaque modification. Un devis signé (`status = signed`) est verrouillé en lecture seule — une édition crée un nouveau devis avec numéro différent.

**Acceptance Criteria :**
- Given : devis en statut `draft`
- When : utilisateur modifie une ligne ou ajoute une nouvelle ligne
- Then : le total HT se met à jour en temps réel dans l'UI sans reload
- And : la persistence en DB est débouncée (500 ms) pour éviter le spam I/O
- And : un devis en statut `signed` affiche une bannière brutalist « Document signé, verrouillé » et désactive l'édition
- And : un bouton « Dupliquer ce devis » crée un nouveau brouillon pré-rempli avec le contenu du devis signé

**Dependencies :** FR-008

---

### FR-012 : Rendu PDF via Typst et cycle de vie statut

**Priority :** Must Have

**Description :**
La génération du PDF utilise Typst (subprocess ou crate embarquée) avec un template FAKT conforme charte legacy (bleu `#2E5090`, Arial-like ou équivalent, mentions légales micro-entreprise). Le statut du devis suit un cycle : `draft` → `sent` → `viewed` → `signed` ou `refused` ou `expired`.

**Acceptance Criteria :**
- Given : un devis émis
- When : utilisateur clique « Export PDF » ou « Envoyer au client »
- Then : Typst compile le template `.typ` avec le contexte du devis injecté en JSON
- And : le PDF résultant contient toutes les mentions légales obligatoires (cf. NFR-004)
- And : le rendu est déterministe (même input = même output bit-à-bit) grâce à Typst
- And : le temps de rendu est ≤ 3 s sur hardware de référence (NFR-002)
- And : le statut transite vers `sent` au premier export, vers `viewed` si l'utilisateur clique manuellement « Marquer comme vu » (pas de tracking email en MVP), vers `signed` via FR-017
- And : passage automatique à `expired` si `validity_date < today` et `status != signed`

**Dependencies :** FR-008, FR-010

---

### FR-013 : Création de facture depuis devis signé

**Priority :** Must Have

**Description :**
Depuis un devis signé, l'utilisateur peut générer une facture en un clic. Trois options : acompte (30 % par défaut, ajustable), facture totale, facture de solde (si acompte déjà émis). La facture héritée reprend client, lignes, conditions du devis source et référence son numéro (`D2026-014 → F2026-021 (acompte sur D2026-014)`).

**Acceptance Criteria :**
- Given : un devis en statut `signed`
- When : utilisateur clique « Créer facture »
- Then : popup brutalist propose « Acompte 30 % », « Solde », « Total »
- And : la facture créée référence `quote_id` du devis source
- And : le numéro F`{année}-{sequence}` est attribué via FR-010
- And : les mentions légales micro-entreprise sont incluses (NFR-004)
- And : si le devis a déjà une facture d'acompte liée, l'option « Solde » est proposée en priorité, avec le montant solde pré-calculé
- And : si le total des factures liées > montant devis, avertissement bloquant

**Dependencies :** FR-010, FR-012

---

### FR-014 : Création de facture indépendante (sans devis)

**Priority :** Must Have

**Description :**
Création d'une facture « from scratch » pour les abonnements récurrents (hosting, maintenance) ou prestations urgentes sans devis formel.

**Acceptance Criteria :**
- Given : utilisateur sur l'écran Factures
- When : il clique « Nouvelle facture »
- Then : formulaire identique à FR-008 (création devis) mais typé invoice
- And : les mentions légales incluent échéance (J+30 par défaut), pénalités retard, indemnité forfaitaire 40 €
- And : le numéro F`{année}-{sequence}` est attribué via FR-010

**Dependencies :** FR-005, FR-006, FR-010

---

### FR-015 : Cycle de vie et suivi de paiement facture

**Priority :** Must Have

**Description :**
Statuts : `draft` → `sent` → `paid` ou `overdue`. L'utilisateur peut marquer manuellement une facture comme payée avec date de règlement et moyen (virement, chèque, espèces, autre). Les factures dont `due_date < today` et `status != paid` passent automatiquement en `overdue`.

**Acceptance Criteria :**
- Given : facture en statut `sent` avec due_date dépassée de ≥ 1 jour
- When : l'app est ouverte ou qu'un job interne tourne
- Then : le statut passe à `overdue` automatiquement
- And : le dashboard affiche les factures en retard dans un bloc dédié
- And : l'utilisateur peut marquer `paid` avec un modal (date + moyen + note)
- And : un événement `payment_received` est inséré dans `activity` pour l'audit

**Dependencies :** FR-014

---

### FR-016 : Interface de signature (canvas + clavier)

**Priority :** Must Have

**Description :**
Modal ou page dédiée permettant de dessiner sa signature sur un canvas (souris, trackpad, écran tactile) OU de la taper au clavier (rendu en typographie Space Grotesk italique). Le rendu résultant est une image SVG ou PNG transparente.

**Acceptance Criteria :**
- Given : utilisateur clique « Signer ce devis » ou « Signer cette facture »
- When : la modal de signature apparaît
- Then : zone canvas brutalist 400×180 pixels avec bordure noire 2.5px
- And : 2 onglets en haut : « Dessiner » (défaut) et « Taper »
- And : bouton « Effacer » + bouton « Signer et horodater »
- And : la signature est persistée en SQLite (base64) comme asset lié au document

**Dependencies :** FR-012 ou FR-014 (doc à signer existe)

---

### FR-017 : Embed cryptographique PAdES B-T + horodatage RFC 3161

**Priority :** Must Have (bloquant valeur produit)

**Description :**
Après validation de la signature (FR-016), FAKT signe cryptographiquement le PDF en PAdES B-T : le PDF est modifié pour inclure la signature numérique basée sur le cert X.509 personnel (FR-002), un horodatage RFC 3161 est obtenu depuis FreeTSA.org, et la signature + horodatage sont embarqués dans le PDF final. Le résultat est validable dans Adobe Reader.

**Acceptance Criteria :**
- Given : un PDF généré et une signature visuelle validée
- When : l'utilisateur clique « Signer et horodater »
- Then : côté Rust, FAKT :
  1. Calcule le hash SHA-256 du PDF original
  2. Signe le hash avec la clé privée RSA 4096 du keychain
  3. Fait un POST HTTP à `https://freetsa.org/tsr` avec le hash pour obtenir une TSR (TimeStampResponse RFC 3161)
  4. Embarque la signature + la TSR dans le PDF via une lib PAdES (crate à choisir en `/architecture`)
- And : si FreeTSA timeout ou erreur, fallback TSA configurable (DigiCert, Sectigo) ou mode sans horodatage (PAdES B uniquement, avec warning)
- And : le PDF final est validable dans Adobe Reader avec mention « Signé par <Nom> — Horodatage OK »
- And : le PDF final est stocké dans `~/.fakt/documents/{year}/{type}/{num}.signed.pdf`

**Dependencies :** FR-002, FR-012, FR-016

---

### FR-018 : Audit trail append-only des signatures

**Priority :** Must Have

**Description :**
Chaque signature génère un événement dans la table `signature_events` (append-only, aucun UPDATE ni DELETE autorisé en SQL). Champs : `id`, `document_id`, `signer_name`, `signer_email`, `ip_address`, `user_agent`, `timestamp`, `doc_hash_before`, `doc_hash_after`, `signature_png_base64`, `previous_event_hash`. Chaque nouvel événement inclut le hash du précédent pour chaîner la chaîne d'intégrité.

**Acceptance Criteria :**
- Given : une signature est posée
- When : FR-017 s'exécute avec succès
- Then : un événement est inséré dans `signature_events` avec tous les champs remplis
- And : la table a un TRIGGER SQL qui bloque `UPDATE` et `DELETE` (erreur levée)
- And : `previous_event_hash` contient le SHA-256 de la ligne précédente (ou `NULL` pour le premier événement)
- And : une route CLI `fakt audit verify` (post-MVP) permettra de vérifier l'intégrité de la chaîne
- And : l'audit trail peut être exporté en JSON signé (FR-022)

**Dependencies :** FR-017

---

### FR-019 : Génération de brouillon email (.eml) avec pièce jointe

**Priority :** Must Have

**Description :**
Après signature d'un devis ou d'une facture, FAKT génère un fichier `.eml` RFC 5322 avec l'adresse destinataire (email client), sujet pré-rempli, body pré-rempli, et le PDF signé en pièce jointe. Le fichier est ouvert via le handler par défaut de l'OS (`open` macOS, `start` Windows, `xdg-open` Linux).

**Acceptance Criteria :**
- Given : un devis ou facture signé avec PDF final disponible
- When : utilisateur clique « Préparer l'email »
- Then : modal brutalist propose sujet + body éditables (templates par défaut, FR-020)
- And : un fichier `.eml` est généré avec headers `From`, `To`, `Subject`, `Date`, et `Content-Type: multipart/mixed`
- And : le PDF est encodé en base64 comme attachment avec filename
- And : le fichier est stocké temporairement dans `~/.fakt/tmp/drafts/` puis ouvert via l'OS handler
- And : le client mail par défaut ouvre le brouillon prêt à envoyer (vérifié sur Windows Mail, macOS Mail, Thunderbird Linux)
- And : fallback `mailto:` URL si `.eml` handler absent (body tronqué à 2000 chars)

**Dependencies :** FR-017

---

### FR-020 : Bibliothèque de templates email

**Priority :** Should Have

**Description :**
Templates pré-remplis pour les cas standards : envoi devis, envoi facture, relance facture en retard, remerciement paiement reçu. Éditables en settings.

**Acceptance Criteria :**
- Given : utilisateur dans l'étape de préparation d'email (FR-019)
- When : il clique « Choisir template »
- Then : dropdown avec 4 templates pré-remplis (placeholders `{{client_name}}`, `{{doc_num}}`, `{{amount}}`)
- And : les placeholders sont substitués automatiquement avec les valeurs du document
- And : les templates sont éditables dans l'écran Settings et persistés en DB

**Dependencies :** FR-019

---

### FR-021 : Export PDF individuel et sauvegarde ZIP du workspace

**Priority :** Must Have

**Description :**
Export d'un document unique en PDF (copie du fichier signé). Export global du workspace en archive ZIP contenant : tous les PDFs originaux et signés, un dump JSON des clients/prestations/devis/factures, l'audit trail, et un `README.txt` expliquant la structure.

**Acceptance Criteria :**
- Given : utilisateur sur un document (devis ou facture)
- When : il clique « Exporter PDF »
- Then : une copie du fichier signé (ou original si pas signé) est sauvegardée via file dialog OS
- Given : utilisateur dans Settings
- When : il clique « Exporter ma sauvegarde »
- Then : un ZIP est généré en tâche de fond (progress bar brutalist)
- And : le ZIP contient `documents/{year}/{type}/{num}.pdf`, `metadata.json` avec tous les records DB sérialisés, `audit_trail.json`, `README.txt`
- And : le fichier ZIP est nommé `fakt-backup-{workspace_name}-{YYYYMMDD}.zip`

**Dependencies :** toutes les features CRUD

---

### FR-022 : Conformité archivage 10 ans

**Priority :** Must Have (bloquant légal)

**Description :**
Les factures émises (statut != `draft`) ne peuvent être hard-deleted. Une action « Archiver » les déplace dans un état masqué par défaut mais conservé en DB. Les PDFs associés sont conservés sur disque pendant 10 ans minimum.

**Acceptance Criteria :**
- Given : une facture émise (statut `sent`, `paid`, ou `overdue`)
- When : utilisateur tente de supprimer
- Then : le bouton « Supprimer » est remplacé par « Archiver »
- And : l'archivage set `archived_at = NOW()` sans toucher aux autres champs
- And : les factures archivées n'apparaissent pas dans les listes par défaut mais sont visibles via filter « Inclure archivées »
- And : le PDF correspondant reste accessible via un bouton « Télécharger PDF »
- And : une suppression hard est possible UNIQUEMENT sur des brouillons (`status = draft`)

**Dependencies :** FR-014

---

### FR-023 : Dashboard avec KPIs

**Priority :** Should Have

**Description :**
Écran d'accueil brutalist présentant les KPIs clés : CA signé ce mois, devis en attente de signature, montant à encaisser (sent + overdue), taux de signature 90 jours, pipeline devis par statut, activité récente, suggestions IA statiques (v0.1 — v0.2 dynamise).

**Acceptance Criteria :**
- Given : utilisateur sur le dashboard
- When : il ouvre l'app
- Then : 4 KPI cards en haut (CA signé, en attente signature, à encaisser, taux signature 90j)
- And : pipeline devis en 4 colonnes (Brouillon, Envoyé, Vu, Signé) avec compteur
- And : bloc « À encaisser » liste les 4 factures les plus urgentes
- And : bloc « Activité récente » liste les 7 derniers événements (envois, signatures, paiements)
- And : tous les nombres formatés FR (espace fine milliers, `€` après)
- And : dates formatées FR (`21 avr. 2026`)

**Dependencies :** toutes les features CRUD

---

### FR-024 : Listes triables et filtrables

**Priority :** Must Have

**Description :**
Écrans Devis, Factures, Clients, Prestations présentent les entités en table brutalist. Tri par colonne (nom, date, montant, statut). Filtres par statut, par client, par plage de date.

**Acceptance Criteria :**
- Given : utilisateur sur écran Devis
- When : il clique l'en-tête de colonne « Montant »
- Then : tri ASC, re-clic → tri DESC, icône chevron indique la direction
- And : barre de filtres en haut : dropdown statut, dropdown client, date range picker
- And : combinaison de filtres possible (AND logic)
- And : recherche live par mot-clé dans la colonne titre/num
- And : pagination si > 50 résultats (ou virtual scroll)

**Dependencies :** FR-005, FR-006, FR-008, FR-013, FR-014

---

### FR-025 : Vue détail document + composer IA sidebar

**Priority :** Must Have

**Description :**
Ouverture d'un devis ou facture affiche un détail plein écran : preview PDF-like du document à gauche (rendu HTML proche du PDF), timeline d'événements à droite (envoyé, vu, signé, payé), fiche client compacte, actions contextuelles (Signer, Dupliquer, Export PDF, Créer facture). Un bouton « Assistant IA » ouvre le composer sidebar Brutalist 420px qui permet de demander des modifications ou générer un message de relance.

**Acceptance Criteria :**
- Given : utilisateur clique sur un devis dans la liste
- When : la vue détail s'ouvre
- Then : layout 2 colonnes : preview HTML (1fr) + sidebar chronologie (320px)
- And : topbar sticky avec numéro, statut (StatusChip brutalist), titre, client, montant
- And : boutons d'action contextuels selon le statut (Envoyer si draft, Relancer si sent, Créer facture si signed, etc.)
- And : raccourci `Cmd+A` ouvre le composer IA sidebar en sur-overlay (420px, slide-in from right)
- And : composer IA permet de re-prompter Claude avec le contexte du document courant

**Dependencies :** FR-012, FR-014, FR-009

---

## Non-Functional Requirements

Les exigences non-fonctionnelles définissent **comment** le système se comporte. Toutes sont **Must Have** sauf mention contraire.

---

### NFR-001 : Performance — Startup

**Priority :** Must Have

**Description :**
Le temps de démarrage à froid de FAKT doit être ≤ 2 secondes sur hardware de référence (MacBook Air M1 16GB ou PC Win11 i5 16GB, SSD NVMe).

**Acceptance Criteria :**
- Mesure : du double-clic sur l'icône au premier frame du dashboard interactif
- Target p95 : ≤ 2000 ms
- Measured on : CI GitHub Actions (macOS-latest, windows-latest, ubuntu-latest runners)

**Rationale :** un outil quotidien doit démarrer « instantanément » sinon on retombe sur le réflexe « je garde Yousign + mon tableur ouverts ».

---

### NFR-002 : Performance — Rendu PDF

**Priority :** Must Have

**Description :**
Le rendu d'un devis ou facture standard (< 20 lignes) via Typst doit se compléter en ≤ 3 secondes sur hardware de référence.

**Acceptance Criteria :**
- Target p95 : ≤ 3000 ms
- Measured in : Vitest benchmark suite dans `packages/pdf`

**Rationale :** l'UX attend le rendu avant d'afficher la preview. > 3s ressenti comme lent.

---

### NFR-003 : Taille de l'installer

**Priority :** Should Have _(déprionné — voir révision ci-dessous)_

**Description :**
_Révisé 2026-04-22 à ~100 Mo — cf. addendum en tête + CHANGELOG [Unreleased] Changed._ Les installers signés cross-platform pèsent désormais ~100 Mo suite au bundling Bun compiled du sidecar api-server (équivalent Slack/Discord/Obsidian). Le critère release-blocking est fonctionnel (démarrage ≤ 2 s, app dogfoodable), pas la taille binaire.

**Acceptance Criteria (v0.1) :**
- Windows `.msi` : ~100 Mo (cohérent avec apps desktop modernes)
- macOS `.dmg` : ~100 Mo
- Linux `.AppImage` : ~100 Mo (webview GTK bundlé)
- Objectif v0.2 : ~20 Mo via port Rust du sidecar api-server
- Measured on : artefacts CI post-build (monitoring informatif, pas de gate bloquant)

**Rationale :** le positionning « 5 Mo vs Electron 150 Mo » ne tient plus post-refacto sidecar. Le positionning actuel est « app desktop moderne ~100 Mo, objectif ~20 Mo v0.2 ». Cf. CHANGELOG Known Issues.

---

### NFR-004 : Conformité légale française (critique)

**Priority :** Must Have (non-négociable)

**Description :**
Le système respecte les obligations légales françaises pour devis et factures de micro-entreprise : numérotation séquentielle sans trous (FR-010), mentions légales obligatoires, archivage 10 ans.

**Acceptance Criteria :**
- Devis contient : identité émetteur (nom, forme, SIRET, adresse), identité client, date d'émission, durée de validité, lignes détaillées, total HT, mention « TVA non applicable, art. 293 B du CGI », conditions de paiement
- Facture contient : tout ce qui précède + date d'échéance, mention pénalités retard (« Taux d'intérêt légal majoré de 10 points en cas de retard »), indemnité forfaitaire 40 €, RIB/IBAN, date de livraison ou d'exécution de la prestation
- Archivage : aucune facture émise ne peut être hard-deletée (FR-022)
- Numérotation : aucun trou dans la séquence annuelle (FR-010)

**Rationale :** non-conformité = sanctions URSSAF, perte de confiance utilisateurs. Règle n°1 du produit.

---

### NFR-005 : Sécurité — Stockage des secrets

**Priority :** Must Have

**Description :**
Tous les secrets (clé privée X.509, tokens éventuels, mots de passe) sont stockés exclusivement dans le keychain OS natif. Fallback fichier chiffré AES-256 acceptable uniquement si keychain OS indisponible.

**Acceptance Criteria :**
- Windows : Windows Credential Manager via crate Rust `keyring`
- macOS : macOS Keychain via crate Rust `keyring`
- Linux : Secret Service (gnome-keyring, KWallet) via crate `keyring`
- Jamais de secret en clair dans la DB SQLite, les fichiers de log, ni en variables d'environnement

**Rationale :** si un fichier de backup fuite, il ne doit contenir aucun secret exploitable.

---

### NFR-006 : Sécurité — Validation d'entrées

**Priority :** Must Have

**Description :**
Toutes les entrées utilisateur et toutes les réponses externes (Claude CLI subprocess, FreeTSA) sont validées avant insertion en DB ou traitement cryptographique.

**Acceptance Criteria :**
- Côté TypeScript : Zod schémas pour tous les inputs de formulaires
- Côté Rust : `serde` avec schéma strict pour le JSON reçu de Claude
- SQL : toutes les queries via Drizzle ORM (pas de SQL brut string-concat)
- PDF signatures : validation que le PDF entrant est bien un PDF et non un fichier forgé

---

### NFR-007 : Offline-first

**Priority :** Must Have

**Description :**
100 % des fonctions MVP sont utilisables **sans connexion internet**, à deux exceptions près : l'IA via Claude CLI (nécessite connexion Anthropic), et l'horodatage RFC 3161 via FreeTSA (nécessite connexion pour fetch la TSR).

**Acceptance Criteria :**
- Offline : création/édition/suppression de clients, prestations, devis, factures fonctionnelle
- Offline : rendu PDF Typst fonctionnel
- Offline : signature visuelle + embed PAdES B (sans horodatage) fonctionnels — le PDF résultant est `PAdES-B` au lieu de `PAdES-B-T`
- Offline : les brouillons email `.eml` sont générés ; l'ouverture dépend du client mail utilisateur
- Graceful degradation : le composer IA affiche « Connexion requise » si offline ou Claude CLI échoue

---

### NFR-008 : Accessibilité

**Priority :** Should Have

**Description :**
L'UI vise la conformité WCAG 2.1 AA. Navigation clavier complète, contrastes respectés (design system Brutal Invoice facilite car noir/blanc/jaune vif), labels ARIA sur tous les contrôles.

**Acceptance Criteria :**
- Tab/Shift-Tab navigue tous les éléments focusables
- Raccourcis clavier documentés (`Cmd+N` nouveau doc, `Cmd+K` recherche, `Escape` ferme modal)
- Contrast ratio ≥ 4.5:1 sur tout texte (assuré par design system)
- Focus visible 2px outline noir ou jaune
- Axe-core audit en CI visant zéro violation AA

---

### NFR-009 : Internationalisation future-ready

**Priority :** Should Have

**Description :**
L'architecture prépare l'ajout de langues v0.2+ sans réécriture massive. En v0.1, toutes les chaînes UI sont en français et extraites dans des fichiers dédiés (JSON ou TypeScript) pour faciliter la traduction future.

**Acceptance Criteria :**
- Structure `packages/shared/i18n/fr.ts` avec toutes les chaînes UI
- Appel via fonction `t("key")` même si le seul locale est `fr` en v0.1
- Pas de chaîne hardcoded dans les composants React

---

### NFR-010 : Maintenabilité et qualité code

**Priority :** Must Have

**Description :**
Couverture tests unitaires ≥ 70 % sur `packages/core` et `packages/pdf`. Lint strict zéro warning. Types stricts TypeScript (pas de `any`). Tests E2E Playwright sur les 3 OS.

**Acceptance Criteria :**
- CI GitHub Actions exécute : `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:e2e`
- Coverage report via `c8` ou `vitest coverage`
- PR bloquée si coverage descend en dessous du seuil

---

### NFR-011 : Compatibilité plateformes

**Priority :** Must Have

**Description :**
FAKT supporte :
- Windows 10 version 1809+ (x64)
- macOS 12+ Monterey (Intel x64 + Apple Silicon ARM64)
- Ubuntu 22.04+ (x64), Fedora 38+, Arch (community-maintained)

**Acceptance Criteria :**
- Builds CI matrix : `windows-latest`, `macos-latest` (ARM), `macos-13` (Intel), `ubuntu-22.04`
- Tests E2E Playwright sur les 3 OS cibles
- Installers testés manuellement sur hardware réel avant release

---

### NFR-012 : Fiabilité et protection des données

**Priority :** Must Have

**Description :**
Aucune perte de donnée utilisateur acceptable. SQLite en mode WAL, backups automatiques.

**Acceptance Criteria :**
- SQLite PRAGMA `journal_mode = WAL`
- Backup auto toutes les 24h (rotation sur 7 jours) dans `~/.fakt/backups/` au format SQLite dump
- Option « Sauvegarder maintenant » dans Settings
- Crash recovery : SQLite WAL replay au redémarrage après crash
- Pas de perte de devis en cours d'édition (autosave débouncé 500ms → disque toutes les 5s)

---

## Epics

Les epics groupent les FRs et génèreront les user stories détaillées en Phase 4 (Sprint Planning).

---

### EPIC-001 : Onboarding et paramètres

**Description :**
Assistant de premier lancement, génération du certificat personnel, détection de Claude CLI, écran de paramètres workspace. Toute la base « je viens d'installer FAKT, qu'est-ce que je dois faire ? ».

**Functional Requirements :**
- FR-001 Assistant de premier lancement
- FR-002 Génération et stockage du certificat X.509
- FR-003 Détection de Claude CLI
- FR-004 Paramètres workspace

**Story Count Estimate :** 4 stories

**Priority :** Must Have

**Business Value :**
Zéro friction onboarding. L'utilisateur doit pouvoir créer son premier devis en < 5 minutes après double-clic installer.

---

### EPIC-002 : Bibliothèque clients et prestations

**Description :**
CRUD clients et prestations réutilisables, recherche transverse. La base de données métier de l'utilisateur.

**Functional Requirements :**
- FR-005 CRUD clients
- FR-006 CRUD prestations
- FR-007 Recherche et tri transverse (Cmd+K)

**Story Count Estimate :** 3 stories

**Priority :** Must Have

**Business Value :**
Réutilisation = gain de temps sur chaque nouveau devis. Sans biblio, chaque devis demande de re-saisir les mêmes prestations.

---

### EPIC-003 : Devis (Quotes)

**Description :**
Création manuelle ou IA, édition, numérotation conforme, rendu PDF, cycle de vie. Le cœur « côté devis » du produit.

**Functional Requirements :**
- FR-008 Création manuelle de devis
- FR-009 Création de devis assistée par IA
- FR-010 Numérotation séquentielle conforme CGI
- FR-011 Édition et recalcul live
- FR-012 Rendu PDF Typst et cycle de vie statut

**Story Count Estimate :** 6 stories

**Priority :** Must Have

**Business Value :**
Remplace directement le skill `/devis-freelance`. Sans cet epic, FAKT n'a pas de raison d'être.

---

### EPIC-004 : Factures (Invoices)

**Description :**
Création depuis devis signé, création indépendante, conformité légale, suivi paiement.

**Functional Requirements :**
- FR-013 Création de facture depuis devis signé
- FR-014 Création de facture indépendante
- FR-015 Cycle de vie et suivi de paiement

**Story Count Estimate :** 4 stories

**Priority :** Must Have

**Business Value :**
Remplace directement le skill `/facture-freelance`. Ferme la boucle métier devis → facture.

---

### EPIC-005 : Signature électronique PAdES

**Description :**
Capture signature visuelle, embed cryptographique PAdES B-T, horodatage, audit trail. L'élément différenciateur face à Indy/Tiime/Freebe qui ne signent pas.

**Functional Requirements :**
- FR-016 Interface signature (canvas + clavier)
- FR-017 Embed PAdES B-T + horodatage RFC 3161
- FR-018 Audit trail append-only

**Story Count Estimate :** 5 stories (technique complexe)

**Priority :** Must Have

**Business Value :**
Évite le coût Yousign (~18 €/mois). Valeur différenciante unique vs compétiteurs open-source (Dolibarr n'a pas la signature).

**Dépend de :** EPIC-003 (PDF généré) + EPIC-004 + EPIC-001 (cert X.509)

---

### EPIC-006 : Brouillon email

**Description :**
Génération `.eml` avec pièce jointe PDF signée, templates par défaut, intégration OS handler.

**Functional Requirements :**
- FR-019 Génération .eml avec attachment
- FR-020 Bibliothèque templates email

**Story Count Estimate :** 2 stories

**Priority :** Must Have

**Business Value :**
Ferme la boucle « signer → envoyer ». Sans cet epic, l'utilisateur doit copier-coller manuellement un message dans Gmail/Outlook après avoir téléchargé le PDF.

**Dépend de :** EPIC-005

---

### EPIC-007 : Archive et export

**Description :**
Export PDF, ZIP complet du workspace, conformité archivage 10 ans.

**Functional Requirements :**
- FR-021 Export PDF individuel et ZIP workspace
- FR-022 Conformité archivage 10 ans

**Story Count Estimate :** 2 stories

**Priority :** Must Have

**Business Value :**
Souveraineté des données. L'utilisateur peut toujours quitter FAKT en récupérant ses données. Conformité légale archivage = pas de risque URSSAF.

---

### EPIC-008 : UI/UX Brutal Invoice

**Description :**
Dashboard, listes, vue détail, composer sidebar, navigation — l'enveloppe visuelle brutaliste qui relie tout. Techniquement c'est le plus gros epic côté front-end.

**Functional Requirements :**
- FR-023 Dashboard avec KPIs
- FR-024 Listes triables et filtrables
- FR-025 Vue détail document + composer sidebar

**Story Count Estimate :** 5 stories

**Priority :** Must Have

**Business Value :**
L'identité visuelle brutaliste est l'autre axe de différenciation (vs le UI générique de Indy/Freebe). Si on rate le Brutalism, on ressemble à Dolibarr.

**Dépend de :** tous les autres epics (pour afficher les données)

---

## User Stories (High-Level)

Liste préliminaire de user stories pour chaque epic. Les stories détaillées avec estimation seront affinées au sprint planning (`/sprint-planning`).

### EPIC-001 : Onboarding et paramètres

1. **US-001 :** En tant que nouveau utilisateur, je veux compléter un assistant de démarrage en moins de 3 minutes pour pouvoir créer mon premier devis rapidement.
2. **US-002 :** En tant que utilisateur, je veux que FAKT génère mon certificat de signature automatiquement pour ne pas avoir à gérer de crypto moi-même.
3. **US-003 :** En tant que utilisateur, je veux que FAKT détecte si j'ai Claude CLI installé et me guide si non pour éviter les erreurs cryptiques.
4. **US-004 :** En tant que utilisateur, je veux pouvoir modifier mon identité légale dans les paramètres pour refléter mes évolutions (changement adresse, IBAN, etc.).

### EPIC-002 : Bibliothèque clients et prestations

5. **US-005 :** En tant que freelance, je veux ajouter mes clients récurrents une fois pour les réutiliser sans ressaisie à chaque devis.
6. **US-006 :** En tant que freelance, je veux cataloguer mes prestations standards pour remplir mes devis en quelques clics.
7. **US-007 :** En tant que utilisateur, je veux chercher un client ou un devis via `Cmd+K` pour naviguer rapidement dans l'app.

### EPIC-003 : Devis

8. **US-008 :** En tant que freelance, je veux créer un devis à partir d'un brief email collé ou d'un PDF uploadé pour économiser 15 min de rédaction.
9. **US-009 :** En tant que freelance, je veux créer un devis manuellement quand je n'ai pas de brief écrit.
10. **US-010 :** En tant que freelance, je veux que mes devis soient numérotés automatiquement sans trous pour rester conforme CGI.
11. **US-011 :** En tant que freelance, je veux éditer un devis après génération pour ajuster les montants, ajouter des conditions, etc.
12. **US-012 :** En tant que freelance, je veux voir un PDF propre prêt à envoyer, avec mes informations légales.
13. **US-013 :** En tant que freelance, je veux voir le statut de mes devis (brouillon, envoyé, vu, signé) pour savoir quoi relancer.

### EPIC-004 : Factures

14. **US-014 :** En tant que freelance, je veux créer une facture d'acompte ou de solde en un clic depuis un devis signé.
15. **US-015 :** En tant que freelance, je veux créer une facture récurrente (abonnement hosting) sans devis préalable.
16. **US-016 :** En tant que freelance, je veux que mes factures incluent automatiquement les mentions légales obligatoires.
17. **US-017 :** En tant que freelance, je veux marquer manuellement une facture comme payée avec la date et le moyen de règlement.

### EPIC-005 : Signature

18. **US-018 :** En tant que freelance, je veux signer mes devis d'un geste au trackpad pour ne pas avoir à imprimer.
19. **US-019 :** En tant que freelance, je veux que mes PDFs signés soient cryptographiquement valides dans Adobe Reader pour que mes clients fassent confiance.
20. **US-020 :** En tant que freelance, je veux un audit trail complet de mes signatures en cas de litige futur.

### EPIC-006 : Email

21. **US-021 :** En tant que freelance, je veux qu'un brouillon email s'ouvre automatiquement dans Mail/Outlook avec le PDF en pièce jointe pour pas avoir à faire 3 étapes.
22. **US-022 :** En tant que freelance, je veux des templates email pré-remplis pour gagner du temps sur les envois standards.

### EPIC-007 : Archive

23. **US-023 :** En tant que freelance, je veux exporter tous mes documents en un ZIP pour backup externe ou changement d'outil.
24. **US-024 :** En tant que freelance, je veux être empêché de supprimer une facture émise pour rester conforme archivage 10 ans.

### EPIC-008 : UI

25. **US-025 :** En tant que freelance, je veux un dashboard qui me dit en un coup d'œil ce qui bloque (devis à relancer, factures en retard).
26. **US-026 :** En tant que freelance, je veux trier et filtrer mes listes de devis/factures par statut, client, date.
27. **US-027 :** En tant que freelance, je veux ouvrir un document en plein écran avec une timeline des événements à droite.
28. **US-028 :** En tant que freelance, je veux un composer IA en sidebar pour demander à Claude de modifier un devis ou rédiger une relance.

---

## User Personas

### Persona primaire : « Le freelance CLI-natif »

**Nom représentatif :** Tom — développeur fullstack à Avignon, 32 ans.

- Freelance en micro-entreprise depuis 3 ans.
- Émet 10-25 devis et factures par mois, 5-10 clients récurrents.
- Utilise déjà Claude Code CLI + Cursor + Warp quotidiennement.
- Installe volontiers un binaire depuis GitHub Releases.
- Refuse de payer Indy ou Tiime (trop cher pour la valeur, ferme ses data sur un cloud tiers).
- Valeur son temps à 80 €/h — 15 min économisées = 20 € de valeur réelle.
- **Motivation principale :** unifier et automatiser son cycle de facturation sans dépendre d'un SaaS fermé.

### Persona secondaire : « La petite agence »

**Nom représentatif :** Équipe AlphaLuppi (Tom + Léa + Nasser).

- 3-5 personnes freelances regroupées.
- Besoin v0.2 de self-host Docker entreprise + backend partagé.
- Besoin de reporting consolidé (CA total, par membre).
- Membre admin configure la charte commune, les membres émettent sous leur nom.
- **Motivation :** même qu'individuelle + consolidation équipe.

### Persona tertiaire (cible SaaS v0.3+) : « Le freelance non-technique »

**Nom représentatif :** Anne — designer indépendante, 29 ans.

- Régime micro-entreprise.
- N'a pas Claude CLI installé et n'a pas envie de gérer du self-host.
- Prête à payer 12 €/mois pour une version hébergée « tout inclus ».
- Cherche la simplicité d'Indy avec l'esthétique d'un outil moderne.
- **Motivation :** facturer proprement sans devenir dev-ops.

---

## User Flows

### Flow 1 : Premier lancement → premier devis envoyé (< 5 min)

1. Double-clic installer → app ouverte.
2. Assistant : Identité (remplit nom, SIRET, adresse, IBAN) → Claude CLI check (green tick) → Génération cert X.509 (spinner 2s) → Prêt.
3. Dashboard vide, message incitatif « Créez votre premier client ».
4. Cmd+N ou bouton « Nouveau devis » ouvre composer.
5. L'utilisateur colle un brief email dans le composer → Claude CLI traite (~10s) → ExtractedCard s'affiche.
6. Utilisateur valide → devis `D2026-001` généré, PDF rendu.
7. Clic « Signer » → modal canvas → dessin → PAdES embed (~3s).
8. Clic « Préparer l'email » → .eml ouvert dans Mail.
9. Utilisateur clique « Envoyer » dans Mail → devis statut passe à `sent`.

### Flow 2 : Devis signé → facture d'acompte

1. Dashboard affiche « CASA MIA a signé D2026-001 » dans l'activité récente.
2. Clic sur le devis → vue détail, statut `signed`, bouton « Créer facture » visible.
3. Clic « Créer facture » → popup « Acompte 30 % · Solde · Total ».
4. Sélection « Acompte 30 % » → pré-remplissage montant + mentions légales automatiques.
5. Validation → facture `F2026-001` créée, cycle vie `draft → sent` → `paid` quand le virement arrive.

### Flow 3 : Relance facture en retard

1. Dashboard : bloc « À encaisser » affiche facture F2026-012 en retard 7 jours.
2. Clic → vue détail facture.
3. Sidebar composer IA : utilisateur tape « Rédige une relance cordiale pour cette facture ».
4. Claude CLI génère un brouillon email dans le composer.
5. Clic « Envoyer cette relance » → .eml ouvert dans Mail pré-rempli.

---

## Dependencies

### Internal Dependencies

- **`packages/core`** doit être opérationnel avant `packages/pdf`, `packages/ai`, `packages/email`.
- **`packages/design-tokens`** doit précéder `packages/ui` et `apps/desktop`.
- **`packages/db`** (Drizzle schema) précède tout code métier.
- **EPIC-005 (signature)** dépend de EPIC-001 (cert X.509), EPIC-003 (PDF généré).
- **EPIC-006 (email)** dépend de EPIC-005 (PDF signé).
- **EPIC-008 (UI)** dépend de tous les epics CRUD pour afficher des données réelles.

### External Dependencies

- **Claude Code CLI** (v2.x+, installé par l'utilisateur, token Anthropic user-fourni) — pour EPIC-003 FR-009.
- **FreeTSA.org** (HTTPS gratuit) — pour EPIC-005 FR-017 horodatage.
- **Tauri 2 runtime** (webview OS natif : WebView2 Windows, WKWebView macOS, WebKitGTK Linux).
- **Typst CLI ou crate** — pour EPIC-003 FR-012 rendu PDF.
- **Rust crates crypto** (TBD en `/architecture` — candidats `lopdf`, `rsa`, `x509-parser`, `openssl`).
- **Apple Developer Program** (99 USD/an) — pour macOS notarization.
- **Windows Authenticode OV Certificate** (~200 USD/an) — pour signer les installers MSI.

---

## Assumptions

1. Tom dispose d'un token Anthropic actif et accepte que FAKT consomme ce token via `claude` CLI en subprocess.
2. Les templates `.docx` des skills legacy sont portables en Typst avec fidélité raisonnable (validation POC semaine 1 du développement).
3. Le freelance typique accepte d'installer une app depuis GitHub Releases (non App Store) si les installers sont code-signés correctement.
4. FreeTSA restera gratuit et opérationnel pendant la durée MVP. Fallback TSAs configurables supportés.
5. Les crates Rust crypto supportent bien les 3 OS cibles de manière homogène (à valider en POC semaine 1).
6. La législation française accepte PAdES B-T avec cert auto-signé + audit trail complet comme signature électronique avancée recevable (eIDAS règlement 910/2014 art. 25).
7. Le design system Brutal Invoice reste non-négociable — aucune requête de contributeur futur ne sera acceptée pour le « soften ».
8. Bun >= 1.3 et Rust >= 1.75 sont disponibles sur l'environnement de dev de Tom (déjà vérifié via MnM).

---

## Out of Scope (v0.1.0)

Explicitement exclu du MVP — ne pas confondre avec « jamais ».

- ❌ **Portail client distant** pour signature côté client (v0.2+).
- ❌ **Backend self-host entreprise** Hono/PG + sync desktop↔backend (v0.2).
- ❌ **SaaS hébergé multi-tenant** avec billing Stripe (v0.3+).
- ❌ **Application mobile** Expo iOS/Android (v0.4+).
- ❌ **Chat IA persistant in-app** avec sessions longues — en MVP, Claude est appelé per-action en subprocess one-shot (v0.2+).
- ❌ **Intégrations paiement automatiques** (Stripe Connect, GoCardless) — suivi paiement manuel uniquement (v0.3+).
- ❌ **Relances automatiques** avec scheduler interne (v0.2+).
- ❌ **Régimes TVA multi** (micro + BIC/BNC assujettis, auto-entrepreneur > seuil) — micro uniquement en v0.1 (v0.2+).
- ❌ **Multi-langue UI** (EN, ES, DE) — FR only en v0.1 (v0.2 ajoute EN).
- ❌ **Export compta FR** (FEC, EBP, Sage, Ciel) (v0.2+).
- ❌ **OCR factures fournisseurs** reçues — hors scope permanent.
- ❌ **Multi-template** par workspace — un seul template principal customisable (v0.2+).
- ❌ **Rôles granulaires** multi-membre — mono-user uniquement MVP (v0.2+).
- ❌ **Signature qualifiée eIDAS** via PSCo accrédité ANSSI — nécessite intégration Yousign API, ajouté en v0.3+ comme option.
- ❌ **Webhooks et API REST** — pas d'API externe exposée en MVP (v0.2+).
- ❌ **Sortie Factur-X (PDF/A-3 + XML CII embarqué) profil EN 16931** — cible v0.2 dans le cadre de la réforme facturation électronique FR (obligation émission micro/TPE 1er sept. 2027). Cf. `docs/e-invoicing-reform-north-star.md`.
- ❌ **Connecteur PDP (Plateforme de Dématérialisation Partenaire)** pour transmission des factures à une PDP tierce — cible v0.3. FAKT reste compatible PDP, **n'est pas une PDP** (pas d'immatriculation DGFiP). Cf. `docs/e-invoicing-reform-north-star.md`.
- ❌ **e-reporting B2C / paiements** vers DGFiP via PDP — v0.4+, conditionné à la trajectoire SaaS.

---

## Open Questions

Questions laissées ouvertes volontairement pour le workflow `/architecture` :

1. **Crate Rust PAdES exacte :** `lopdf` + `rsa` + `x509-parser` fait-maison ? `sign-pdf-rs` ? Wrapper `openssl` via `openssl-rs` ? POC cross-OS semaine 1 tranche.
2. **Structure des templates Typst :** un fichier `.typ` par type de document (`quote.typ`, `invoice.typ`) avec imports partagés (`partials/header.typ`, `partials/legal-mentions.typ`) ? Ou monolithique avec conditions ?
3. **Protocole IPC frontend ↔ backend Tauri :** `invoke()` classique (commands) vs events (`emit`/`listen`) vs channels (`Channel<T>`) pour chaque type d'opération ? Streaming pour les outputs Claude CLI = channels obligatoires.
4. **State management React :** Zustand ? TanStack Query + local state ? React Context seul ? Décision fonction du volume de state serveur.
5. **ORM stratégie dual SQLite+PostgreSQL :** `@libsql/client` vs `better-sqlite3` vs Drizzle native — et comment garder la parité des migrations ? Drizzle Kit supporte les 2 dialects mais les migrations doivent être testées sur les 2.
6. **Stratégie de backup SQLite :** dump `.sql` ? Copie `.db` avec VACUUM ? Backup incrémental WAL ?
7. **Dev experience Tauri :** `bun run dev` doit lancer Vite HMR + `tauri dev` en parallèle. Concurrently ? Turborepo tasks ? Custom script ?
8. **Testing Tauri side :** Rust `cargo test` pour la crypto + PDF. Playwright avec `tauri-driver` pour E2E. Comment mock Claude CLI dans les tests E2E (sans dépendre d'un vrai token) ?
9. **Installer code-signing pipeline CI :** GitHub Actions avec secrets Apple Developer + Windows cert .pfx → workflow Tauri de packaging ?
10. **Gestion des migrations au premier démarrage :** auto-run au boot ? Ou prompt utilisateur ?
11. **Télémétrie Plausible self-host :** auto-hébergée où (Vercel ? Dokploy AlphaLuppi ?) ? Endpoint fixé ou configurable ?
12. **Branchement future Claude Agent SDK :** garder le subprocess CLI en MVP mais designer l'interface `packages/ai` pour pouvoir swapper vers Agent SDK embarqué en v0.2 sans réécrire l'appelant.

---

## Definition of Done — v0.1.0

Critères binaires à tous remplir pour déclarer la release v0.1.0 publique :

- [ ] Tous les FRs Must Have passent leurs Acceptance Criteria en tests manuels + E2E automatisés.
- [ ] Tous les NFRs Must Have passent leurs Acceptance Criteria en benchmarks + audits.
- [ ] Tom a émis au moins 5 devis + 5 factures réels via FAKT sur ses vrais clients.
- [ ] Zéro incident signalé par Tom pendant 72h d'utilisation continue.
- [ ] CI GitHub Actions verte sur les 3 OS (Windows, macOS, Linux).
- [ ] Installers code-signés Windows (.msi Authenticode) et macOS (.dmg notarized). Linux .AppImage peut être non-signé pour v0.1.
- [ ] README FR complet, CONTRIBUTING complet, docs Mintlify minimum viable.
- [ ] Landing page statique live sur `fakt.alphaluppi.com` ou fallback.
- [ ] GitHub Release v0.1.0 publiée avec changelog et installers attachés.
- [ ] Repo `AlphaLuppi/FAKT` est public avec licence BSL 1.1 lisible.
- [ ] Coverage tests >= 70 % sur `packages/core` et `packages/pdf` validée en CI.
- [ ] Zéro vuln haute dans `bun audit` + `cargo audit`.
- [ ] Message de launch Product Hunt + Hacker News + Twitter + LinkedIn rédigé (lancement J+0).

---

## Approval & Sign-off

### Stakeholders

- **Tom Andrieu** (AlphaLuppi, fondateur, développeur, utilisateur #1) — **Influence : Haute**. Décideur produit et tech.
- **Claude (agent IA, exécution)** — **Influence : Exécution**. Doit respecter FRs + NFRs.
- **Communauté GitHub / utilisateurs OSS** — **Influence : Moyenne**. Feedback via issues et PRs post-launch.

### Approval Status

- [x] Product Owner (Tom) — implicitement validé via les arbitrages par défaut acceptés
- [ ] Engineering Lead — à valider lors du workflow `/architecture`
- [ ] Design Lead — design system Brutal Invoice déjà validé, pas de nouvelle décision ici
- [ ] QA Lead — à valider au moment des tests E2E

---

## Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-04-21 | Tom Andrieu (AlphaLuppi) / Claude agent | Initial PRD — synthèse du product brief + arbitrages par défaut |

---

## Next Steps

### Phase 3 : Architecture (OBLIGATOIRE au niveau L3)

Lancer `/architecture` pour produire `docs/architecture.md` qui couvrira :
- Choix final des crates Rust (PAdES, crypto, keychain)
- Structure détaillée du monorepo Bun (apps/, packages/, server/, ui/, cli/)
- Schéma DB Drizzle (SQLite + adapter PostgreSQL)
- Interfaces IPC Tauri frontend↔Rust backend
- Pipeline CI/CD GitHub Actions complet (build + test + sign + release)
- State management TypeScript choix final
- Templates Typst structure

### Phase 4 : Sprint Planning

Après architecture validée, lancer `/sprint-planning` pour :
- Décomposer les 28 user stories en tâches actionnables
- Estimer en story points
- Répartir sur les 3 sprints (S1 Fondations, S2 Cœur, S3 Signature+Launch)
- Identifier les tâches bloquantes et parallélisables

---

## Appendix A : Requirements Traceability Matrix

| Epic ID | Epic Name | Functional Requirements | Story Count (Est.) |
|---|---|---|---|
| EPIC-001 | Onboarding et paramètres | FR-001, FR-002, FR-003, FR-004 | 4 stories |
| EPIC-002 | Bibliothèque clients et prestations | FR-005, FR-006, FR-007 | 3 stories |
| EPIC-003 | Devis | FR-008, FR-009, FR-010, FR-011, FR-012 | 6 stories |
| EPIC-004 | Factures | FR-013, FR-014, FR-015 | 4 stories |
| EPIC-005 | Signature PAdES | FR-016, FR-017, FR-018 | 5 stories |
| EPIC-006 | Brouillon email | FR-019, FR-020 | 2 stories |
| EPIC-007 | Archive et export | FR-021, FR-022 | 2 stories |
| EPIC-008 | UI/UX Brutal Invoice | FR-023, FR-024, FR-025 | 5 stories |
| **Total** | **8 epics** | **25 FRs + 12 NFRs** | **~28 stories** |

---

## Appendix B : Prioritization Details

**Par MoSCoW :**

- **Must Have (MVP bloquant)** : 23 FRs + 9 NFRs = 32 items.
- **Should Have (important, contournable)** : 2 FRs (FR-007 recherche globale, FR-020 templates email) + 2 NFRs (NFR-008 a11y, NFR-009 i18n) = 4 items.
- **Could Have (nice-to-have, skipable)** : 0 items en v0.1.0 (tout ce qui était Could a été déplacé en Out of Scope v0.2+).

**Justification :** le MVP est déjà minimum par construction — toutes les features Must Have sont requises pour que FAKT remplace effectivement les skills legacy. Les Should Have peuvent être reportés au dernier sprint si timing serré.

**Par complexité technique (estimation subjective Claude agent) :**

- 🔴 **Haute** (risque POC obligatoire S1) : FR-002 cert X.509 keychain, FR-017 PAdES B-T, FR-018 audit trail chaîné, NFR-003 taille installer.
- 🟡 **Moyenne** (implémentation standard mais volume important) : FR-012 Typst render, FR-008/009 composer IA, FR-023 dashboard brutalist, NFR-010 tests cross-OS.
- 🟢 **Basse** (CRUD standard) : FR-005, FR-006, FR-010, FR-011, FR-013, FR-014, FR-015, FR-021, FR-022, FR-024, NFR-012 backup.

---

**Ce document a été créé selon BMAD Method v6 — Phase 2 (Planning).**

*Pour continuer : lance `/architecture` pour la Phase 3. PRD et product brief constituent ensemble les intrants obligatoires.*
