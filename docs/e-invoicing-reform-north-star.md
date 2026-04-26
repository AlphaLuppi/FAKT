# Réforme facturation électronique FR — North Star FAKT

**Audience :** Mainteneur, contributeur, agent IA.
**Résumé :** FAKT vise à être **compatible PDP** (émet des factures lisibles par toute Plateforme de Dématérialisation Partenaire et sait les transmettre via API), **sans devenir une PDP** au sens de l'immatriculation DGFiP. Tout choix v0.2+ doit préserver cette trajectoire sans bloquer le portage futur des couches concernées.
**Dernière mise à jour :** 2026-04-26

---

## Origine de la décision

Question posée par Tom (mainteneur) le 2026-04-26 :

> "Tu penses que c'est possible de faire de ce projet une Plateforme agréé par l'état pour gérer la facturation ?"

Trois trajectoires ont été examinées :

1. **Compatible PDP, sans l'être** — FAKT émet du Factur-X normé et sait pousser à une PDP tierce via API. → **Choisi.**
2. Devenir Opérateur de Dématérialisation (OD) adossé à une PDP partenaire — envisageable v0.4+, hors-scope tant que la trajectoire SaaS n'est pas confirmée.
3. Devenir PDP en propre — incompatible avec le mode solo desktop, exige SecNumCloud + ISO 27001 + immatriculation DGFiP, ~6-12 mois et plusieurs centaines de k€. Hors-scope du projet open-source freelance.

Ce document cadre la trajectoire 1.

## Contexte réglementaire (à re-vérifier au moment de planifier)

La réforme française de la facturation électronique (article 26 LF 2022 + ordonnance 2021-1190) impose à terme aux entreprises B2B françaises de transiter par une PDP ou par le PPF (Portail Public de Facturation) pour leurs factures.

Calendrier officiel (état 2026-04, **vérifier impots.gouv.fr avant de planifier une release**) :

| Date | Obligation | Impact freelance micro |
|---|---|---|
| 1er sept. 2026 | Réception électronique pour TOUTES les entreprises | Bas (le freelance reçoit peu de factures B2B) |
| 1er sept. 2026 | Émission obligatoire pour grandes entreprises et ETI | Indirect (les clients GE/ETI exigeront du Factur-X reçu de FAKT) |
| 1er sept. 2027 | Émission obligatoire pour PME, TPE et micro-entreprises | **Direct, scope FAKT** |

Le PPF a été recentré sur le rôle de concentrateur/annuaire. La PDP devient le canal d'émission/réception principal. Conséquence pour FAKT : un freelance utilisateur de FAKT devra, à partir du 1er sept. 2027, soit déposer ses factures dans une PDP, soit utiliser un outil qui le fait pour lui.

## Position de FAKT — invariant

FAKT n'est pas une PDP. FAKT est un **outil d'édition + un connecteur** :

- **Édition** : devis, facture, signature, archivage local 10 ans (déjà v0.1).
- **Sortie normée** : à v0.2, le PDF émis est un **PDF/A-3 Factur-X profil EN 16931**, contenant l'XML CII embarqué. Lisible humainement *et* par n'importe quelle PDP.
- **Connecteur PDP** : à v0.3, FAKT pousse la facture vers la PDP de l'utilisateur via API standardisée et reçoit en retour les statuts cycle de vie (déposée, rejetée, encaissée…).
- **Reception + e-reporting B2C** : v0.4+, dépend de la trajectoire SaaS.

**Aucune fonctionnalité n'est gated derrière un statut PDP.** Si une feature exige d'être PDP pour fonctionner, elle est hors-scope ou doit passer par une PDP tierce.

## Roadmap par milestone

### v0.2 — Émission Factur-X EN 16931

Livrables :

- Rendu PDF/A-3 conforme (Typst → post-traitement Rust pour l'embed XML + métadonnées XMP).
- Génération de l'XML CII (Cross Industry Invoice, UN/CEFACT D16B) profil EN 16931 à partir des données invoice.
- Validation schématron EN 16931 dans la CI (golden invoices testées).
- Mention UI "Facture conforme Factur-X EN 16931" + badge dans la facture détail.
- Settings : SIRET destinataire requis (déjà facultatif en v0.1), code TVA intra (si fourni), mode de règlement, terms code (UN/CEFACT 4461).
- Flag par workspace : `facturx_enabled` (default true en v0.2 pour les workspaces FR).

**Non-livré v0.2 :** envoi à PDP, reception, e-reporting.

### v0.3 — Connecteur PDP (push)

Livrables :

- Interface `PdpConnector` en TS (côté `packages/api-server` ou nouveau `packages/pdp`) avec implémentations pluggables.
- 2 implémentations cibles : générique **Peppol BIS Billing 3.0** (AS4) + 1 PDP française au choix (probable Iopole ou Pennylane selon disponibilité d'une API publique testable).
- UI : Settings → onglet "PDP" (URL endpoint, credentials chiffrés keychain OS, test connexion).
- Bouton "Transmettre via PDP" sur la vue détail facture (en plus de "Préparer email").
- Réception webhook statuts cycle de vie + colonne `pdp_status` sur `invoices`.
- Annuaire SIREN (résolution destinataire via PDP) — fallback saisie manuelle si l'API n'expose pas l'annuaire.

**Non-livré v0.3 :** reception de factures fournisseurs, e-reporting B2C automatique.

### v0.4+ — Reception + e-reporting

Livrables (dépendant de la trajectoire SaaS hébergée AlphaLuppi) :

- Mode "boîte de réception" : factures fournisseurs reçues via PDP, parsées (Factur-X import), proposées à la validation.
- e-reporting des transactions B2C (paiements en cash / clients particuliers) vers DGFiP via PDP.
- e-reporting des paiements (suivi encaissement) vers DGFiP via PDP.

À écrire en PRD dédié quand la trajectoire SaaS sera validée.

## Implications concrètes (à respecter dès maintenant)

Ces règles doivent être respectées **par CHAQUE contribution** au code (humaine ou IA) qui touche aux entités facture, client, settings ou rendu PDF.

### Côté DB (`packages/db/`)

- `invoices` doit avoir (ou pouvoir recevoir sans migration cassante) : `pdp_status`, `pdp_message_id`, `pdp_submitted_at`, `pdp_lifecycle_status`. Ajouter en v0.2 même si `null` partout, pour éviter une migration douloureuse en v0.3.
- `clients` : champ `siret` doit pouvoir devenir requis en v0.2 (warning UI maintenant, hard requirement à venir). Ajouter `intra_vat`, `address_country_iso2`, `peppol_id` (nullable).
- `settings` workspace : ajouter `facturx_profile` (`MINIMUM` / `BASIC` / `EN16931` / `EXTENDED`, default `EN16931`), `pdp_endpoint_url`, `pdp_credentials_keychain_id` (clé keychain, jamais le secret en DB).
- `invoice_items` : champ `unit_code` UN/ECE Rec 20 (`HUR` heure, `DAY` jour, `H87` pièce…) — nullable v0.1, à pousser en v0.2.
- **Aucune perte de données possible** entre l'édition utilisateur et l'XML CII : si la facture est éditable en UI, son XML doit être régénérable bit-pour-bit identique. Pas de champ XML dérivé qu'on perdrait au save.

### Côté rendu PDF (`packages/pdf/`)

- Le pipeline Typst → PDF reste le rendu humain. Le post-traitement Rust ajoute :
  - Conversion PDF/A-3 (couleurs ICC, fonts embarquées, métadonnées XMP étendues).
  - Embedded file `factur-x.xml` avec relationship `Alternative` et MIME `text/xml`.
  - XMP packet déclarant `fx:DocumentType=INVOICE`, `fx:DocumentFileName=factur-x.xml`, `fx:Version=1.0`, `fx:ConformanceLevel=EN 16931`.
- **Pas de second PDF** pour la version Factur-X. Le PDF émis EST déjà le Factur-X. Sinon dérive entre les deux artefacts.
- Le Typst template doit afficher 100% des données présentes dans l'XML (pas de champ XML caché de l'utilisateur). Règle de transparence légale.

### Côté API / connecteur (`packages/pdp/` à créer en v0.3)

- Interface unique `PdpConnector` : `submit(invoice) → MessageId`, `getStatus(messageId) → Lifecycle`, `subscribeWebhook(handler)`.
- Implémentations dans des sous-modules (`peppol-as4`, `iopole`, `pennylane`…). Le user choisit son adapter dans Settings.
- **Aucune dépendance dure à une PDP unique** dans le cœur métier. Si Iopole disparaît demain, le user swap d'adapter sans data loss.
- Credentials PDP stockés en keychain OS (même règle que le cert X.509, NFR-005).

### Côté UI

- Le mot "PDP" reste dans les Settings et l'aide contextuelle. Il n'apparaît pas dans le flow de création de facture standard (le user émet une facture, le système choisit le canal selon ses Settings).
- Badge conformité `Factur-X EN 16931` visible sur la vue détail facture dès qu'elle est émise.
- **Ne jamais afficher "transmise à la DGFiP" ou "validée par l'État"** : FAKT ne valide rien, c'est la PDP qui transmet et la DGFiP qui valide.

## Anti-patterns à refuser en review

| Pattern | Pourquoi c'est mauvais |
|---|---|
| Stocker l'XML CII en DB comme source de vérité | L'XML est dérivé. Source = `invoices` + `invoice_items` + `clients` + `settings`. Sinon, dérive éditeur. |
| Coupler `packages/pdf` à une PDP spécifique | Le rendu PDF/A-3 Factur-X est universel. Le routage PDP est une couche au-dessus. |
| Mettre des credentials PDP dans `settings` table | Keychain OS uniquement. Même règle que cert X.509. |
| Champ `is_facturx_compliant: boolean` sur invoice | Toute facture émise v0.2+ EST conforme. Pas de mode dégradé silencieux. Si non-conforme → erreur bloquante au moment de l'émission. |
| Prétendre dans l'UI que FAKT est "agréé DGFiP" ou "PDP" | Faux et passible de sanction. FAKT est compatible PDP, pas PDP. |
| Endpoint API REST exposant l'XML factur-x sans auth + workspace check | Fuite cross-workspace. Toujours filtrer par `workspaceId`, voir `multi-workspace-north-star.md`. |
| Hard delete d'une facture transmise à PDP | Archivage 10 ans déjà non-négociable v0.1. Ajouter en v0.3 : pas de delete possible si `pdp_message_id IS NOT NULL`. |

## Points d'extension futurs (non-cadrés)

- **Reception Factur-X** entrant (factures fournisseurs) avec parsing automatique vers une boîte d'inbox.
- **e-reporting B2C** automatique (transactions cash / particuliers) vers DGFiP via PDP.
- **e-reporting paiements** (suivi encaissement) vers DGFiP via PDP.
- **Multi-PDP** : émettre via PDP A et PDP B selon le client (cas filiale étrangère).
- **PEPPOL BIS Billing 3.0** sortie EU directe (clients hors France).
- **Annuaire interne** des destinataires SIREN avec cache local + invalidation par webhook PDP.

## Comment vérifier qu'on respecte la north star

Avant de merger une PR qui touche aux entités factures, clients, settings, ou au rendu PDF :

1. **L'XML CII est-il régénérable depuis la DB sans perte ?** Si une donnée affichée dans l'UI ou dans le PDF n'a pas son équivalent dans `invoices` / `invoice_items` / `clients` / `settings`, la PR est bloquante.

2. **Le rendu PDF reste-t-il agnostique de la PDP choisie ?** Aucun import depuis `packages/pdp` dans `packages/pdf`. Sinon couplage cassant.

3. **Les nouveaux champs DB sont-ils additifs et nullable ?** Pas de `NOT NULL` rétroactif sur table existante en v0.2. Migration progressive avec warning UI puis hard requirement à n+1.

4. **Si la PR touche aux Settings PDP, les credentials restent-ils en keychain OS ?**
   ```bash
   rg "pdp.*(secret|password|token|api_?key)" packages/db/src/schema/
   ```
   Doit retourner zéro résultat.

5. **L'UI ne prétend-elle pas plus que ce qu'elle est ?**
   ```bash
   rg -i "agré|certifié.*état|validé.*dgfip|nous.*pdp|fakt.*pdp" apps/desktop/src/ landing/
   ```
   Toute occurrence doit être justifiée en review.

## Références externes

- DGFiP — Réforme facturation électronique : https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique
- FNFE-MPE — Factur-X (spec officielle) : https://fnfe-mpe.org/factur-x/
- UN/CEFACT — Cross Industry Invoice : https://unece.org/trade/uncefact/cl-recommendations
- PEPPOL BIS Billing 3.0 : https://docs.peppol.eu/poacc/billing/3.0/
- Norme EN 16931 (semantic data model) : https://www.cen.eu — recherche "EN 16931"

## Pour les agents IA

Quand tu travailles sur FAKT et que ton changement touche aux factures, clients, settings ou rendu PDF, **lis ce document avant de proposer une architecture**. Si tu hésites entre deux approches, choisis celle qui préserve la trajectoire option 1 (compatible PDP sans l'être) — même si elle ajoute un peu de friction v0.1.

Ce fichier est référencé dans [`CLAUDE.md`](../CLAUDE.md) — toute session Claude Code le lit automatiquement.
