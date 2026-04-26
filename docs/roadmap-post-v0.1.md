# Roadmap post-v0.1 — Décisions de scope

**Statut :** Draft de travail, validé en conversation avec Tom le 2026-04-26.
**Auteur :** Tom Andrieu + agent (revue collaborative).
**Document lié :** [`prd.md`](./prd.md) — PRD v1.0 (2026-04-21, partiellement obsolète sur la V0.2).

Ce document **remplace** la section « Champ d'application » du PRD concernant
la V0.2 et la V0.3. Il acte trois décisions :

1. La signature client se fera **par import retour** plutôt que par portail SaaS hébergé.
2. La signature visuelle sur le PDF du devis est désormais **rendue par Typst** (et plus seulement crypto invisible).
3. Le chantier **Factur-X / Réforme Facturation Électronique 2026-2027** devient un objectif structurant pour la V0.3.

---

## 1. Signature visible sur les PDFs (livré v0.1.25)

Avant cette version, la signature PAdES B-T était **invisible** : le PNG dessiné
par l'utilisateur était stocké dans la table `signature_events` pour l'audit
trail uniquement, jamais incrusté dans le PDF rendu. Le commentaire dans
[`pades.rs:50`](../apps/desktop/src-tauri/src-tauri/src/crypto/pades.rs)
prévoyait un Form XObject pour la v0.2.

**Décision :** on a court-circuité le Form XObject (compliqué, gain marginal —
ça ne sert que pour la bannière verte « ✅ Signature valide » d'Adobe Reader,
que le public freelance n'utilise pas pour valider). À la place :

- Le canvas signature génère toujours son PNG.
- Avant le scellement PAdES, on **regénère le PDF du devis via Typst** avec le
  PNG incrusté visuellement dans le bloc signature (`image()` Typst).
- Une mention discrète « *Signature électronique avancée — eIDAS AdES-B-T* »
  est ajoutée sous la signature.
- Le PAdES B-T est ensuite appliqué sur ce PDF visible — l'ordre est
  **non-négociable** : modifier le PDF après PAdES casserait l'intégrité
  cryptographique.

**Pas de signature sur les factures.** Le bouton « Signer » a été retiré du
détail facture car la facture n'a pas de valeur d'engagement contractuel
(art. 1101 du Code civil) — c'est un document de constatation post-vente.
Si on veut un sceau d'intégrité crypto sur la facture archivée, ce sera
un automatisme à l'émission (`draft → sent`), pas un geste utilisateur.

---

## 2. V0.2 — Import retour client (remplace le portail SaaS)

### Le problème

Pour qu'un client signe un devis FAKT depuis chez lui, deux options :

- **Option A — Portail SaaS hébergé** : `app.fakt.alphaluppi.fr` avec
  endpoint public sans auth, page web client, tokens JWT signés, workflow
  DocuSign-like. **Coût** : 1-2 semaines de boulot, dépendance à un
  hébergement (Postgres + Caddy + monitoring), gestion RGPD, support
  multi-tenant de l'API. **Bénéfice** : tracking « client a vu » +
  horodatage côté client.

- **Option B — Import retour signé** : Tom envoie le PDF par email comme
  aujourd'hui, le client signe (à la main + scan, ou Adobe Reader, ou
  DocuSign de son côté), renvoie le PDF, Tom l'importe dans FAKT.
  **Coût** : 2-3 jours. **Bénéfice** : reste 100 % offline, pas
  d'hébergement, pas de RGPD à expliquer.

### Décision

**On part sur l'Option B pour la V0.2.** Raisons :

- L'ICP V0.1 est le freelance solo. 80 % d'entre eux gèrent encore leur
  signature client par email aller-retour aujourd'hui — c'est un workflow
  familier, pas une régression.
- L'Option A devient pertinente quand on vendra FAKT à des agences /
  cabinets avec 50+ devis/mois. Pas le besoin court terme.
- L'Option B n'empêche pas l'Option A plus tard : ce sont des features
  qui se cumulent, pas qui s'opposent.

### Architecture import retour

| Étape | Détail |
|---|---|
| 1. Hash de contenu à la génération | À la génération du PDF original, FAKT extrait le contenu textuel du PDF (via `lopdf::extract_text`) et stocke un SHA-256 stable du texte normalisé (whitespace folded, line endings unifiés) dans une nouvelle colonne `quotes.original_text_hash`. |
| 2. Bouton « Importer le devis signé par le client » | Sur `quotes/Detail.tsx`, en complément du bouton « Signer ». Ouvre un file picker PDF. |
| 3. Vérification d'intégrité | Le PDF retourné est parsé, son texte extrait et hashé. Comparaison avec `original_text_hash`. **Identique** → on accepte directement. **Différent** → modal diff visuel + confirmation explicite (cas légitime : le client a annoté en marge ; cas malicieux : le client a baissé le prix). |
| 4. Stockage | Le PDF retourné est archivé dans `signed_pdfs/quote/<id>.pdf` (à côté du PDF FAKT original, qui reste lui aussi disponible). |
| 5. Audit event | Événement `signed_by_client_imported` ajouté à la chaîne hashée, avec `signer_email` du client (champ libre rempli au moment de l'import). |
| 6. Statut | Le devis passe à `signed`. Le bouton « Créer une facture » se débloque. |

### Estimation effort

| Tâche | Effort |
|---|---|
| Extracteur texte PDF + hash stable côté Rust | 0,5j |
| Persistance `original_text_hash` + migration DB | 0,5j |
| Commande Tauri `import_signed_quote(quote_id, pdf_bytes)` | 0,5j |
| UI bouton + dialog file picker + diff modal | 1j |
| Audit event chain + tests | 0,5j |
| E2E Playwright | 0,5j |
| **Total** | **~3,5 jours** |

### Hors scope V0.2 (reportés en V0.3+)

- Portail SaaS public (Option A ci-dessus).
- Tracking « client a vu le devis » (impossible sans portail).
- Horodatage qualifié côté client (impossible sans portail ; le PDF
  retourné peut contenir une signature digitale du client — Adobe Sign,
  DocuSign — mais FAKT ne validera pas leur chaîne en V0.2).
- Mode multi-utilisateur / multi-tenant.

---

## 3. V0.3 — Réforme Facturation Électronique 2027 (CHANTIER STRUCTURANT)

### Le contexte réglementaire

La France a voté en 2024 une réforme rendant **obligatoire la facturation
électronique** entre entreprises (B2B). Calendrier actualisé après les
reports de 2024-2025 :

| Date | Obligation |
|---|---|
| **1ᵉʳ septembre 2026** | **Réception** des factures électroniques obligatoire pour TOUTES les entreprises (y compris micro-entreprises). |
| **1ᵉʳ septembre 2026** | **Émission** obligatoire pour les grandes entreprises et ETI. |
| **1ᵉʳ septembre 2027** | **Émission** obligatoire pour les PME, TPE et **micro-entreprises** — c'est l'ICP de FAKT. |

Source : [DGFIP — calendrier officiel](https://www.impots.gouv.fr/specialistes/facturation-electronique).

### Ce que ça implique pour FAKT

Le PDF par email tel que FAKT l'envoie aujourd'hui **ne sera plus
légalement valide** pour les factures B2B émises par les utilisateurs FAKT
à partir du **1ᵉʳ septembre 2027**. Trois exigences techniques :

1. **Format structuré** : la facture doit être au format **Factur-X**
   (PDF/A-3 + XML CII embarqué), **UBL** ou **CII** pur. C'est un standard
   européen (EN 16931).

2. **Transmission via PDP/PPF** : la facture ne peut plus être envoyée
   directement par email. Elle doit transiter par :
   - Une **PDP** (Plateforme de Dématérialisation Partenaire) — opérateur
     privé immatriculé par l'AIFE (Agence pour l'Informatique Financière
     de l'État). Exemples : Pennylane, Iceberg, Sage, Cegid, etc.
   - Ou le **PPF** (Portail Public de Facturation) — service gratuit de
     l'État, plus limité.

3. **e-reporting** : les transactions B2C (vente aux particuliers) et
   internationales doivent transmettre des données agrégées à la DGFIP.

### Impact sur la facturation B2C

Les ventes aux particuliers (B2C) et à l'étranger ne sont **pas concernées
par l'émission e-facture** (toujours autorisé en PDF/papier), mais sont
soumises au **e-reporting** : remontée mensuelle de données agrégées à la
DGFIP via PDP/PPF.

### FAKT va-t-il mourir ?

**Non.** Mais sans adaptation, FAKT sera inutilisable pour les factures B2B
de ses utilisateurs micro-entrepreneurs à partir de septembre 2027.

### Stratégie d'adaptation

L'objectif n'est **pas** que FAKT devienne une PDP (immatriculation AIFE
~3-5 M€ d'investissement, hors scope projet open-source solo). L'objectif
est que FAKT **génère du Factur-X conforme** que l'utilisateur transmet
via la PDP de son choix.

#### Phase 1 — Génération Factur-X (V0.3, échéance idéale T1 2027)

- Templates Typst étendus pour produire du **PDF/A-3** (sous-format PDF
  archive, contraintes spécifiques sur les fonts, métadata XMP, etc.).
  Typst supporte PDF/A-2 nativement, le PDF/A-3 nécessite quelques
  extensions XMP.
- Génération du **XML CII** (Cross-Industry Invoice — UN/CEFACT) à partir
  de l'`InvoiceCtx`. Le mapping est documenté par la spec EN 16931.
- Embed du XML dans le PDF/A-3 via `lopdf` (attachement de fichier avec
  le bon flag de relation EN 16931).
- Validation locale via une lib type **Mustangproject** (Java, mais on
  peut faire du Rust pur — il existe déjà des crates `factur-x-rs`
  embryonnaires).

#### Phase 2 — Intégration PDP (V0.4)

Trois options pour transmettre le Factur-X :

- **2.A Export manuel** (V0.3) : l'utilisateur télécharge le Factur-X et
  l'upload sur sa PDP via leur UI web. Fonctionne dès le départ, zéro
  intégration. Friction acceptable pour 5-10 factures/mois.

- **2.B Intégration API directe** (V0.4) : FAKT expose des connecteurs
  vers les principales PDP françaises (Pennylane, Iceberg, Sage…). Le
  freelance configure une API key dans les paramètres et FAKT envoie
  automatiquement.

- **2.C Pivot via le PPF gratuit** (V0.4 alternative) : intégration
  directe au PPF d'État. Avantage : gratuit pour l'utilisateur.
  Inconvénient : API moins riche, pas de gestion comptable adjacente.

Mon pari personnel : **2.A pour V0.3** (zéro intégration, zéro coût) et
**2.B Pennylane d'abord pour V0.4** (gros acteur FR, API publique).

### Risque calendaire

**Septembre 2027 = ~17 mois à partir d'aujourd'hui (avril 2026).** C'est
serré pour un projet open-source solo. Plan de tir réaliste :

- **V0.2** (juin 2026) : import retour client + dogfooding stabilité.
- **V0.3** (Q1 2027) : Factur-X génération + export manuel PDP. Tom
  utilise FAKT en V0.3 pour ses propres factures B2B avant septembre 2027,
  upload manuel sur Pennylane.
- **V0.4** (T3 2027) : intégration API Pennylane + autres PDP. Avant la
  date butoir.

### Hors scope FAKT

- Devenir une PDP (impossible solo).
- Gérer la compta complète (TVA, déclarations, bilan) — c'est le job
  des PDP comptables type Pennylane/Tiime/Indy. FAKT reste un outil de
  cycle devis/facture, pas une plateforme comptable.

---

## 4. Récapitulatif — séquence recommandée

| Version | Échéance idéale | Contenu | Effort |
|---|---|---|---|
| **v0.1.25** | livré 2026-04-26 | Signature visible PDF, retrait Sign facture | fait |
| **v0.1.x** | mai-juin 2026 | Stabilisation, dogfooding, cleanup branding fixtures, i18n strings | continu |
| **v0.2.0** | T2-T3 2026 | Import retour client signé + (optionnel) port Rust sidecar (~100 Mo → ~20 Mo) | ~1-2 semaines |
| **v0.3.0** | **T1 2027** | Génération **Factur-X** (PDF/A-3 + XML CII) + export manuel PDP | ~3-4 semaines |
| **v0.4.0** | T3 2027 (avant 1ᵉʳ sept 2027) | Intégration API PDP (Pennylane d'abord) | ~2-3 semaines |

Le **chantier critique** en termes de risque projet n'est plus le portail
SaaS V0.2 — c'est le **Factur-X V0.3**, parce qu'il a une date butoir
légale au 1ᵉʳ septembre 2027 et que sans lui FAKT devient illégal pour
les factures B2B de ses utilisateurs micro-entrepreneurs.

---

## 5. Décisions ouvertes

- **Modèle économique des connecteurs PDP** : payants (premium FAKT) ou
  gratuits ? Probablement gratuits pour rester fidèle à l'esprit
  open-source. Mais peut-être premium pour l'auto-envoi (gains de
  productivité) — à trancher.
- **Position vs concurrents Factur-X** : Pennylane et consorts vont
  intégrer la génération Factur-X eux-mêmes. FAKT garde son
  différenciant via : open-source, brutaliste, IA-first, pattern
  AlphaLuppi. La génération Factur-X est nécessaire mais pas suffisante
  pour la valeur produit.
- **Retournement possible — devenir un client de PDP plutôt que
  générer du Factur-X soi-même** : on délègue tout à une PDP via
  proxy/SDK. Plus rapide, mais perd l'aspect open-source intégral.
  À étudier si le développement Rust/Typst PDF/A-3 traîne.
