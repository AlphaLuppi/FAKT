# Product Brief — FAKT

**Date :** 2026-04-21
**Auteur :** Tom Andrieu (AlphaLuppi)
**Version :** 1.0
**Type de projet :** Application desktop open-source (Tauri 2, Bun monorepo, pattern AlphaLuppi « outil interne »)
**Niveau de projet :** 3 (Complex integration — 12-40 stories)
**Codename :** `FAKT`
**Licence :** BSL 1.1 → Apache 2.0 (Change Date 2030-04-21)
**Repo :** [AlphaLuppi/FAKT](https://github.com/AlphaLuppi/FAKT) (public, à créer)

---

> **Addendum 2026-04-22 — NFR-003 révisé à ~100 Mo**
> Suite au bundling Bun compiled du sidecar api-server (refacto sidecar de la v0.1), la taille binaire réelle est ~100 Mo (équivalent Slack/Discord/Obsidian). Port Rust envisagé v0.2 pour revenir à ~20 Mo. Le critère release-blocking reste fonctionnel (démarrage ≤ 2 s, app dogfoodable), pas la taille binaire. Voir [CHANGELOG.md](/CHANGELOG.md) section Changed. Les mentions « ~5 Mo » / « ≤ 15 Mo » ci-dessous sont conservées pour traçabilité mais doivent être lues comme « ~100 Mo (objectif v0.2 : ~20 Mo via port Rust sidecar) ».

---

## Executive Summary

**FAKT** est une application desktop open-source (Tauri 2 + sidecar Bun compiled, ~100 Mo — objectif v0.2 : ~20 Mo via port Rust sidecar) qui remplace les skills Claude Code `/devis-freelance` et `/facture-freelance` par un outil **unifié, hors-ligne, conforme législation française** pour piloter devis et factures d'un freelance ou d'une petite agence. Le moteur IA repose sur un **subprocess Claude Code CLI** — l'utilisateur fournit son propre token Anthropic. Le document final est **signé cryptographiquement maison** (PAdES B-T, qualité équivalente Yousign Basic), archivé localement avec un audit trail intègre, et préparé pour envoi via un brouillon email ouvert dans le client mail par défaut de l'OS. Le produit suit le **pattern « outil interne » AlphaLuppi** établi par MnM : trois modes de déploiement successifs (solo local → self-host entreprise → SaaS hébergé). Identité visuelle non-négociable : **design system Brutal Invoice** (noir, papier off-white, jaune vif, Space Grotesk UPPERCASE, ombres plates, zéro radius).

---

## Problem Statement

### The Problem

Un freelance français qui facture sérieusement passe aujourd'hui entre **4 et 7 outils disjoints** pour un cycle client simple :
1. Un éditeur Word ou Pages pour modéliser le devis (souvent à partir d'un template .docx maison).
2. Un service email (Gmail/Outlook) pour envoyer au client.
3. Un service de signature électronique (Yousign, Docusign, Signaturit) à 15-30 €/mois pour la signature eIDAS.
4. Un tableur Excel ou Notion pour suivre quel devis est signé, quelle facture est envoyée, payée, en retard.
5. Un logiciel de comptabilité (Indy, Tiime, Freebe) à 10-30 €/mois pour la numérotation légale et le stockage 10 ans.
6. Google Drive ou Dropbox pour archiver les PDF.
7. Un calendrier + un Claude/ChatGPT dans un onglet pour rédiger les messages de relance.

Tom Andrieu a rationalisé cette chaîne en écrivant deux **skills Claude Code** (`/devis-freelance`, `/facture-freelance`) qui génèrent des `.docx` conformes directement depuis le CLI. **Gain réel, problème qui demeure :** ces skills produisent **des fichiers isolés** — pas de persistence (il faut relancer le skill à chaque fois), pas de réutilisation entre devis (on ne récupère pas un client créé la semaine dernière), pas de signature électronique, pas de suivi de cycle, pas de numérotation séquentielle centralisée, pas d'UI pour éditer après génération.

### Why Now?

Trois facteurs alignés en 2026 :
1. **Tauri 2 stable** depuis fin 2025 — on peut enfin shipper une app desktop <10 Mo avec crypto Rust native sans Electron overhead.
2. **Claude Code CLI** mature (v2.x) — le subprocess est fiable, streamé, outillable (tool-use JSON), avec un coût maîtrisable puisque c'est l'utilisateur qui paie son propre token.
3. **Typst** (rendu déterministe de PDF) production-ready — plus besoin de Puppeteer ni de headless Chrome pour rendre un devis pixel-perfect.

Avant 2026, il aurait fallu faire une webapp Electron avec PDF.js + Stripe/Yousign API. Trop cher, trop lourd, pas alignable avec un modèle self-host grand public.

### Impact if Unsolved

Pour Tom Andrieu à court terme : continue à jongler avec ses deux skills + Yousign (~18 €/mois) + Google Drive + un tableur — inefficient, coût récurrent.

Pour AlphaLuppi à moyen terme : sans FAKT, l'agence ne dispose pas du **premier jalon** de sa stratégie « outils internes » au-delà de MnM. Le pattern reproductible (mode local → self-host → SaaS) ne s'installe pas dans la culture tech de la boîte.

Pour la communauté freelance FR : reste dépendante d'outils SaaS étrangers (Docusign US, Honeybook US) ou de logiciels de compta propriétaires fermés (Indy, Tiime, Freebe, Abby) où la data client part sur un serveur non-européen.

---

## Target Audience

### Primary Users

**Freelance tech francophone** (développeur, designer, consultant, product manager) — solo ou en petite équipe (2-5 personnes) :
- Régime fiscal **micro-entreprise** (EI ou EURL), TVA non applicable art. 293 B CGI le plus souvent.
- **Déjà utilisateur avancé de Claude Code CLI** — installe volontiers un binaire depuis GitHub Releases, à l'aise en terminal.
- Émet **5-30 devis + factures par mois**, pour 3-15 clients récurrents.
- Valeur perçue du temps : ~60-100 €/h facturé → 15 min gagnés par cycle = 15-25 € économisés.
- **Allergique aux SaaS comptables propriétaires** (Indy/Tiime/Abby) soit par coût, soit par principe (souveraineté data).
- **Francophone strict** (interface, templates, mentions légales, numérotation) — c'est un tiers-différenciateur par rapport à Freshbooks, Wave, Bonsai.

### Secondary Users

**Petite agence AlphaLuppi-like** (5-15 personnes, plusieurs freelances regroupés) :
- Version self-host Docker entreprise (mode 2), backend PostgreSQL partagé.
- 1 admin qui configure le template corporate, N membres qui émettent des documents à leur nom.
- Besoin additionnel : dashboard consolidé (qui facture quoi, CA par membre).

**Contributeur open-source GitHub** :
- Fork du repo pour son propre usage, propose PR sur features (nouveaux templates régionaux — Belgique, Suisse, Québec — plugins d'export vers sa compta).

**Future cible SaaS (v0.3+) :**
- Freelance non-technique ou « flemmard » qui refuse de self-host, accepte de payer 8-15 €/mois pour une version hébergée.

### User Needs

Top 3 besoins adressés :
1. **« Un seul endroit pour le cycle complet »** — création devis IA → édition manuelle → signature → facture liée → relance → archivage. Sans switch d'outil.
2. **« Conformité FR sans friction »** — numérotation séquentielle automatique, mentions légales pré-remplies, archivage 10 ans, signature eIDAS avancée. Zéro risque URSSAF.
3. **« Data chez moi, code lisible »** — SQLite local, binaires vérifiables, source auditable. Aucun SaaS tiers ne voit mes contrats.

---

## Solution Overview

### Proposed Solution

**FAKT v0.1.0** = application desktop native cross-platform (Windows, macOS, Linux) construite avec **Tauri 2** (Rust + webview). L'application :

1. **Ingère un brief** (texte collé, email `.eml` déposé, ou PDF uploadé) via un composer sobre.
2. **Invoque `claude` CLI en subprocess** avec un prompt orchestré pour extraire client + phases + montants + conditions, puis produire un JSON structuré.
3. **Rend le document final en PDF** via **Typst** — templates repris et améliorés des skills actuels (`/devis-freelance`, `/facture-freelance`), avec toutes les mentions légales françaises.
4. **Permet l'édition manuelle** du document généré (clients, prestations, lignes, totaux, conditions).
5. **Signe cryptographiquement le PDF** en PAdES B-T (Rust `lopdf` + `rsa` + `x509` + horodatage RFC 3161 via FreeTSA). Cert auto-généré stocké dans le keychain OS ; audit trail append-only SQLite.
6. **Génère un brouillon email** (fichier `.eml` + pièce jointe PDF signée), ouvert via l'OS default handler.
7. **Stocke tout en SQLite local** (clients, prestations, devis, factures, signatures, audit).
8. **Exporte CSV / sauvegarde zip** pour bascule éventuelle vers un outil comptable tiers.

### Key Features

- **Design system Brutal Invoice** : identité visuelle radicale et mémorable (noir, papier, jaune, Space Grotesk UPPERCASE, ombres plates), source de vérité `.design-ref/`.
- **Numérotation séquentielle FR auto** (D2026-XXX pour devis, F2026-XXX pour factures, incrémentation atomique SQLite).
- **Bibliothèque de prestations réutilisables** (site vitrine, journée dev, maquette UI, audit UX, formation…).
- **Gestion clients** (nom légal, forme sociale, SIRET, adresse, contact, email, secteur).
- **Dashboard KPIs** : CA signé mensuel, devis en attente de signature, montants à encaisser, taux de signature 90j.
- **Pipeline devis** : brouillon → envoyé → vu → signé / refusé (timeline par document).
- **Suivi factures** : émise → envoyée → payée / en retard.
- **Composer IA** en sidebar (Brutalist, 420px) — chat historisé par document.
- **Signature personnelle PAdES** sur devis et factures (deux niveaux : simple tampon visuel + signature crypto intégrée).
- **Draft email multi-OS** (Windows mailto+`.eml`, macOS AppleScript ou `.eml`, Linux xdg-open `.eml`).
- **Templates éditables** (fork le repo, modifie le `.typ`, rebuild — c'est tout).
- **CLI companion** `fakt` (créer un devis depuis un script, utile pour power-users).

### Value Proposition

> **FAKT, c'est Yousign + Indy + Google Drive fusionnés en une app desktop de ~100 Mo (objectif v0.2 : ~20 Mo via port Rust sidecar), 100 % open-source, hors-ligne par défaut, avec un moteur IA qui prépare ton cycle de facturation en 3 minutes au lieu de 30.**

En une phrase brutalist (on-brand) : *« Un document. Un clic. Signé. »*

---

## Business Objectives

### Goals

**SMART goals v0.1.0 (échéance 2026-05-12, soit T+3 semaines) :**

1. **Specific :** Tom Andrieu remplace 100 % de son usage des skills `/facture-freelance` et `/devis-freelance` par FAKT.
2. **Measurable :** 0 invocation des deux skills legacy sur les 30 jours suivant le launch v0.1.0.
3. **Achievable :** scope restreint MVP (pas de portail client, pas de mobile, pas de backend) permet de shipper en 3 semaines.
4. **Relevant :** valide le pattern AlphaLuppi « outil interne » en tant que modèle reproductible, et libère Tom du coût mental du bricolage entre 4 outils.
5. **Time-bound :** release v0.1.0 publique sur GitHub + landing `fakt.alphaluppi.com` (ou similaire) avant **2026-05-12**.

**SMART goals v0.2 (self-host entreprise, échéance 2026-07-01) :**
- AlphaLuppi utilise FAKT en mode self-host Docker pour l'agence (2-5 utilisateurs actifs).
- Premier contributeur externe mergé sur GitHub (PR acceptée).

**SMART goals v0.3 (SaaS hébergé, indicatif 2026-Q4) :**
- 3 premiers clients payants sur la version hébergée (10-15 €/mois).
- 50 utilisateurs actifs self-host (télémétrie opt-in).

### Success Metrics

- **Adoption perso (critère go/no-go v0.1) :** Tom utilise FAKT pour 100 % de ses nouveaux documents — mesuré par zéro entrée dans les logs d'exécution des skills legacy.
- **Star velocity GitHub :** ≥ 10 étoiles freelance/indie hacker dans le mois qui suit le launch. ≥ 50 à T+3 mois.
- **Intégrité signature :** 0 incident où un PDF signé par FAKT est rejeté par Adobe Reader / Foxit / pyHanko pendant 6 mois.
- **Télémétrie opt-in :** ≥ 20 installations uniques v0.1.x dans les 60 jours (MAU mesuré via beacon anonyme si utilisateur accepte).
- **Taux de complétion cycle :** mesuré dans l'app, % de devis créés qui arrivent à l'état `signed` — cible ≥ 60 %.

### Business Value

**Pour Tom (court terme) :**
- Économie ~18 €/mois Yousign + ~10 €/mois service compta tiers ≈ **336 €/an**.
- Économie temps : 15 min × 25 cycles/mois ≈ 6 h/mois → à 80 €/h facturé, **480 €/mois de capacité débloquée**.

**Pour AlphaLuppi (moyen terme) :**
- FAKT devient **vitrine de la méthode « outil interne »** (comme MnM) — crédibilité technique pour recruter / signer clients agence.
- Accélérateur pour les futurs outils AlphaLuppi : architecture, CI/CD, packaging réutilisés.
- Revenu SaaS potentiel à T+12 mois (hypothèse modeste 30 clients × 12 €/mois × 12 mois = **4 320 €/an**) — scale-up si produit-marché-fit confirmé.

**Pour la communauté OSS FR :**
- Première alternative francophone, souveraine et open-source à Indy/Tiime/Abby.
- Contribution à l'écosystème Tauri/Typst/Claude Code dans un cas d'usage réel.

---

## Scope

### In Scope (MVP v0.1.0)

- **App desktop Tauri 2** cross-platform (Win 10+, macOS 12+, Ubuntu 22.04+).
- **DB locale SQLite** avec Drizzle ORM, migrations versionnées.
- **Entités métier** : `Workspace` (solo/company), `User` (me + membres), `Client`, `Prestation` (bibliothèque), `Quote`, `Invoice`, `DocumentLine`, `Signature`, `AuditEvent`, `Settings`.
- **Numérotation FR séquentielle** atomique (contraintes DB UNIQUE sur `year, num, type, workspace_id`).
- **Templates Typst** des 2 skills portés, y compris mentions légales micro-entreprise.
- **Rendu PDF** Typst → bytes → signature PAdES → fichier final.
- **Composer IA sidebar** : chat + ExtractedCard + upload PDF/email/texte.
- **Subprocess `claude` CLI** avec streaming + tool-use JSON pour extraction structurée.
- **Signature PAdES B-T** maison (cert auto-généré au 1er lancement, stocké keychain OS ; horodatage FreeTSA ; PDF signé vérifiable dans Adobe Reader).
- **Audit trail** append-only SQLite : IP, user-agent, timestamp, docHash, signerName, signatureImageBase64, chaîne de hash.
- **Draft email** `.eml` + attachement PDF + sujet/body préremplis ; ouverture via handler OS default.
- **Dashboard** brutalist + listes triables/filtrables (devis, factures, clients, prestations).
- **Détail document** avec preview PDF, timeline de cycle, actions contextuelles (envoyer, relancer, créer facture depuis devis signé).
- **Import email/brief** (paste texte, drop `.eml` ou `.pdf` jusqu'à 20 Mo).
- **Export** PDF individuel + ZIP archive complète (tous les docs d'une période).
- **Installers signés** : Windows `.msi` (Authenticode), macOS `.dmg` (notarized), Linux `.AppImage`.
- **CI/CD GitHub Actions** pour builds cross-platform + release auto.
- **Docs Mintlify** en FR (EN futur).
- **CLI companion** `fakt` minimal (list quotes, list invoices, create draft).
- **Licence BSL 1.1** + README bilingue + CONTRIBUTING.
- **Landing page** statique (GitHub Pages ou Vercel) sobre.

### Out of Scope (MVP v0.1.0)

- ❌ **Portail client** pour signature côté destinataire → v0.2+.
- ❌ **Application mobile** (iOS, Android, Expo) → v0.4+.
- ❌ **Chat IA persistant in-app** (Claude tourne en subprocess per-action, pas de sessions longues) → v0.2+.
- ❌ **Backend self-host entreprise** (Hono + PostgreSQL, sync desktop↔backend) → v0.2.
- ❌ **SaaS hébergé multi-tenant** (auth cloud, billing Stripe, onboarding) → v0.3+.
- ❌ **Intégration paiement** (Stripe Connect, GoCardless, virements auto) → v0.3+.
- ❌ **Relances automatiques** (cron scheduler interne, emails programmés) → v0.2+.
- ❌ **Multi-devise, multi-TVA, multi-pays** (FR uniquement, TVA non applicable art. 293 B CGI). Belgique / Suisse / Québec → plugins communautaires plus tard.
- ❌ **Export compta** (FEC, EBP, Ciel, Sage) → v0.2+.
- ❌ **OCR** sur factures fournisseurs reçues → hors scope permanent (pas notre métier).
- ❌ **Templates multiples par workspace** (un seul template de base éditable manuellement).
- ❌ **Rôles granulaires** (tous les membres d'un workspace sont admin dans MVP).

### Future Considerations (v0.2 → v1.0)

- Portail client public (token magique pour signature distante).
- Backend Hono + PostgreSQL + Docker Compose pour mode entreprise.
- Sync desktop ↔ backend (mode online/offline, résolution conflits CRDT ou last-write-wins).
- Mobile Expo (iOS + Android) — dictée vocale via Whisper.
- Chat IA persistant in-app (remplacement subprocess CLI par Claude Agent SDK embarqué).
- Relances automatiques + suggestions proactives.
- SaaS hébergé multi-tenant avec RLS PostgreSQL + billing Stripe.
- Export compta FR (FEC).
- Plugin system (templates, pays, intégrations tierces).
- Signature qualifiée eIDAS via partenariat PSCo (Yousign / Universign API).
- Multi-langue UI (EN, ES, DE).

---

## Key Stakeholders

- **Tom Andrieu** (fondateur AlphaLuppi, dev lead) — **Influence : Haute**. Utilisateur #1, décideur produit et tech.
- **Équipe AlphaLuppi** (Léa Vasseur, Nasser B. et autres membres) — **Influence : Moyenne**. Utilisateurs v0.2 (self-host), voix produit sur ergonomie équipe.
- **Communauté freelance FR sur GitHub / Twitter / Indie Hackers** — **Influence : Moyenne**. Source de PR, remontées bugs, démultiplicateur de visibilité.
- **Clients finaux de Tom** (CASA MIA, Maison Berthe, Éditions Jocatop, etc.) — **Influence : Faible (direct)**. N'utilisent pas FAKT (reçoivent juste le PDF signé) mais leur acceptation de la signature PAdES est un critère de succès légal.
- **Anthropic (API Claude)** — **Influence : Faible**. Dépendance technique (tarif token, stabilité CLI). Aucun lien commercial.
- **Claude (moi, l'agent IA développeur du projet)** — **Influence : Exécution**. Responsable de la qualité du code, du respect des conventions, de la conformité FR.

---

## Constraints and Assumptions

### Constraints

- **Budget :** 0 € cash direct — Tom et Claude sont le seul capex, pas de salariés externes. Exception acceptée : **~200 €/an code-signing certs** (Apple Dev Program + Windows Authenticode OV certificate).
- **Délai :** v0.1.0 publique dans ~3 semaines (avant 2026-05-12). v0.2 self-host ~2 mois après. SaaS v0.3 à horizon Q4 2026.
- **Stack imposée :** Tauri 2 + Bun workspaces + Drizzle + Typst + Claude CLI (décisions validées par le user, non réouvrables sans justification technique forte).
- **Juridique FR non-négociable :**
  - Numérotation séquentielle sans trous (CGI art. 289).
  - Mentions légales obligatoires sur facture (SIRET, TVA applicable ou non, adresse, date, échéance, pénalités retard, indemnité 40 €).
  - Archivage 10 ans des factures émises.
  - Audit trail signature intègre et horodaté.
- **eIDAS :** signature FAKT est **avancée (AdES)**, pas qualifiée. Impossibilité d'être qualifié sans accréditation ANSSI (hors scope).
- **Dépendance CLI externe :** Claude Code CLI doit être installé sur la machine user. Fallback gracieux requis (message + lien install + possibilité mode 100 % manuel).
- **Open-source + licence BSL :** revente en SaaS concurrent interdite par la licence, ce qui **limite certaines contributions** (contributeurs voulant lancer leur propre hosting doivent demander une licence commerciale).

### Assumptions

- **Tom a déjà un token Anthropic actif** et accepte que FAKT le consomme.
- **Les templates `.docx` des skills legacy sont portables en Typst** sans perte de fidélité visuelle majeure (à confirmer dans la Phase 1 d'implémentation).
- **FreeTSA.org restera opérationnel et gratuit** pour l'horodatage RFC 3161 pendant la période MVP. Fallback prévu : hébergement d'un TSA maison ou bascule sur une TSA payante (~1 €/mois).
- **Tauri 2 crates crypto** (`openssl`, `rsa`, `lopdf`, `x509-parser`) fonctionnent fiablement sur Windows + macOS + Linux avec la même API — à valider par POC en semaine 1.
- **Les juridictions françaises acceptent la signature PAdES B-T maison** avec audit trail complet en cas de litige. (Reference : CJUE, jurisprudence récente — une signature avancée eIDAS est recevable si l'intégrité et l'identité peuvent être prouvées.)
- **Les utilisateurs freelance sont prêts à installer un binaire non-publisher-store** (téléchargement GitHub Release direct) si l'installer est code-signed correctement.
- **Bun ≥ 1.3 tourne sur l'environnement de dev de Tom** (Windows 11, bash via Git Bash ou WSL) — déjà vérifié partiellement via MnM.
- **La communauté freelance FR trouvera FAKT par GitHub trending, Product Hunt, ou partage Twitter/LinkedIn** — stratégie de launch à définir avant release.

---

## Success Criteria

**Critères binaires go / no-go pour v0.1.0 :**

1. ✅ Un devis créé dans FAKT rend **un PDF visuellement identique** à celui produit par le skill `/devis-freelance` actuel (template de référence dans `.design-ref/gestion-de-facture-et-devis/project/uploads/devis-freelance.skill/references/template.md`).
2. ✅ Idem pour les factures (`/facture-freelance`).
3. ✅ Le PDF signé est **validable dans Adobe Reader** avec mention *« Signed by Tom Andrieu — Timestamp OK »*.
4. ✅ Le brouillon email s'ouvre correctement dans le client mail par défaut sur **les 3 OS** (Windows Mail, macOS Mail, Thunderbird Linux) avec le PDF en pièce jointe.
5. ✅ **Zéro bug critique** signalé dans les 72 h suivant la release.
6. ✅ Tom peut **émettre 5 documents d'affilée sans quitter l'app**.
7. ✅ Le **repo GitHub est public**, a un README bilingue, une licence, un CONTRIBUTING, et une CI verte.
8. ✅ L'install est **one-click** (double-cliquer l'installer, lancer l'app, créer son premier devis en < 5 min).

**Critères de qualité :**

- Coverage tests unitaires ≥ 70 % sur `packages/core` et `packages/pdf`.
- E2E Playwright passant sur le flow « créer devis → signer → draft email » sur les 3 OS (via GitHub Actions matrix).
- Lint + typecheck stricts (0 warning accepté sur la CI).
- Bundle Tauri ~100 Mo (objectif v0.2 : ~20 Mo via port Rust sidecar). _NFR-003 révisé 2026-04-22 — cf. addendum en tête._
- Temps de démarrage à froid ≤ 2 s sur un MacBook Air M1 / PC Win11 i5.

---

## Timeline and Milestones

### Target Launch

**v0.1.0 publique : mardi 2026-05-12** (soit 3 semaines à partir du 2026-04-21).

### Key Milestones

| Date | Milestone | Livrables |
|---|---|---|
| **S1 · 2026-04-22 → 2026-04-26** | Phase 0 · Fondations | Monorepo Bun initialisé, Tauri scaffold, design tokens portés, CI basique verte, repo GitHub public créé |
| **S1-S2 · 2026-04-27 → 2026-05-03** | Phase 1 · Cœur CRUD + templates Typst | CRUD complet Client/Prestation/Quote/Invoice, numérotation FR, rendu PDF Typst fidèle aux skills legacy, dashboard + listes brutalist fonctionnels |
| **S2 · 2026-05-04 → 2026-05-07** | Phase 2 · Signature perso PAdES | POC Rust crypto validé, cert auto-généré, signature PAdES B-T, horodatage FreeTSA, audit trail SQLite, PDF validable dans Adobe Reader |
| **S3 · 2026-05-08 → 2026-05-09** | Phase 3 · IA via Claude CLI + Composer | Subprocess wrapper, tool-use JSON, composer sidebar UI, extraction brief, génération devis auto |
| **S3 · 2026-05-10** | Phase 4 · Draft email multi-OS | `.eml` builder, fallback mailto, test sur 3 OS |
| **S3 · 2026-05-11 → 2026-05-12** | Phase 5 · Launch v0.1.0 | Installers signés cross-platform, GitHub Release, landing page, annonce Twitter/LinkedIn/IH |

### Post-launch (à T+1 à T+3 mois)

| Date | Milestone |
|---|---|
| ~2026-06-01 | v0.1.5 — corrections critiques + feedback early adopters |
| ~2026-06-15 | v0.2-alpha — backend self-host Hono + PG + sync |
| ~2026-07-01 | v0.2.0 — self-host entreprise stable (AlphaLuppi l'utilise) |
| ~2026-10-01 | v0.3-alpha — SaaS hébergé (closed beta) |
| ~2026-12-01 | v0.3.0 — SaaS hébergé public (pricing publié) |
| ~2027-02-01 | v0.4 — mobile Expo iOS + Android |

---

## Risks and Mitigation

- **Risque :** Tauri 2 crates crypto instables ou incompatibles cross-platform (PAdES rendu non fiable).
  - **Likelihood :** Medium
  - **Impact :** High (la signature est le cœur de la proposition de valeur)
  - **Mitigation :** POC crypto en semaine 1 sur les 3 OS simultanément via GitHub Actions matrix. Plan B : fallback sur `node-signpdf` exécuté via Tauri sidecar Node.js embarqué (+~40 Mo, mais éprouvé).

- **Risque :** Juge/URSSAF conteste la validité juridique de la signature PAdES B-T maison (pas qualifiée).
  - **Likelihood :** Low (signature avancée eIDAS est recevable selon règlement eIDAS 910/2014 art. 25)
  - **Impact :** High (perte de confiance utilisateurs)
  - **Mitigation :** Ajouter dans le PDF signé une mention explicite *« Signature électronique avancée eIDAS — niveau AdES-B-T »* + référence audit trail. Documenter dans les FAQ la différence simple/avancée/qualifiée. Proposer intégration Yousign API en option v0.3 pour ceux qui veulent qualifiée.

- **Risque :** Claude Code CLI change d'API breaking (ex: format JSON tool-use modifié) entre la release v0.1.0 et les versions suivantes.
  - **Likelihood :** Medium (API stabilité Anthropic bonne mais pas garantie)
  - **Impact :** Medium
  - **Mitigation :** Isoler l'intégration CLI dans `packages/ai` avec adapters versionnés. Tests de compatibilité sur chaque release Claude CLI. Possibilité de fallback Claude Agent SDK embarqué.

- **Risque :** Code-signing Apple/Windows non-obtenu à temps (délais Apple Dev Program 3-5 jours, Authenticode OV cert 1-2 semaines).
  - **Likelihood :** Medium
  - **Impact :** Medium (impact UX install, pas bloquant)
  - **Mitigation :** Démarrer la procédure d'achat cert dès semaine 1. v0.1.0 peut shipper non-signée avec avertissement Gatekeeper/SmartScreen ; re-release v0.1.1 signée sous 1-2 semaines.

- **Risque :** Adoption communauté freelance faible (pas de star velocity).
  - **Likelihood :** Medium
  - **Impact :** Medium (n'affecte pas usage perso de Tom mais limite la capitalisation)
  - **Mitigation :** Plan de launch : Product Hunt + Hacker News + r/freelance + Indie Hackers + Twitter FR. Screencast 2-min qui montre le flow IA → PDF signé. Landing page soignée avec positionning contre Yousign + Indy. Si < 10 stars à T+30j, on pivote le marketing vers niche « Claude Code users ».

- **Risque :** Templates `.docx` legacy difficilement portables en Typst (perte de fidélité).
  - **Likelihood :** Low (Typst est plus expressif que .docx pour du rendu doc simple)
  - **Impact :** Medium
  - **Mitigation :** Faire un POC template Typst sur le devis en semaine 1. Si rendu insuffisant, plan B : embarquer LibreOffice headless pour rendre le .docx en PDF (moins déterministe mais plus compatible avec les templates existants).

- **Risque :** Dépendance FreeTSA.org qui tombe ou devient payante.
  - **Likelihood :** Low-Medium
  - **Impact :** Low (signature reste valide, juste pas d'horodatage nouveau)
  - **Mitigation :** Supporter plusieurs TSA en configuration utilisateur (FreeTSA par défaut, fallbacks : DigiCert, Sectigo, GlobalSign, TSA maison). Documenter comment self-host un TSA (BouncyCastle + certificat X.509).

- **Risque :** Tom se disperse entre FAKT, MnM et ses projets clients → v0.1.0 glisse.
  - **Likelihood :** High
  - **Impact :** Low-Medium (c'est son projet perso, délai souple)
  - **Mitigation :** Delivery géré par Claude agent (moi) avec jalons hebdo dans `_bmad-output/`. Usage de `/workflow-status` pour tracer. Déprioriser features non-MVP sans merci.

---

## Competitive Landscape & Positioning

**Concurrents directs (SaaS FR compta freelance) :**

| Outil | Positionnement | Tarif | Angle FAKT |
|---|---|---|---|
| **Indy** (indy.fr) | Compta complète freelance, leader FR | 10-30 €/mois | Indy couvre TVA + liasse fiscale, FAKT ne fait **que** devis/factures/signature mais hors ligne + open-source |
| **Tiime** | Compta + banque pro intégrée | 9-15 €/mois | Tiime est cloud-only + fermé, FAKT est self-hostable + auditable |
| **Freebe** | Simple devis/factures freelance | 8-12 €/mois | Plus proche de FAKT fonctionnellement, mais SaaS fermé, 0 IA |
| **Abby** | Devis/factures + auto-entrepreneur | 9-19 €/mois | Même positionnement que Freebe, même angle pour FAKT |
| **Dolibarr** | ERP open-source PHP | Free / 9 €/mois hosted | Dolibarr est lourd (ERP complet), mal design, install PHP/MySQL. FAKT est léger, beau, desktop-first |

**Concurrents signature :**

| Outil | Positionnement | Tarif | Angle FAKT |
|---|---|---|---|
| **Yousign** | Signature eIDAS qualifiée FR | 9-40 €/mois | Yousign est le gold standard FR signature client. FAKT fait de la AdES maison, suffisant pour signer ses propres docs. Yousign intégration optionnelle v0.3+ |
| **Docusign** | Signature US leader mondial | 10-40 €/mois | FAKT est souverain FR, data locale |
| **Signaturit** | Signature + ID | 12-30 €/mois | Idem |

**Concurrents outillage IA :**

| Outil | Positionnement | Tarif | Angle FAKT |
|---|---|---|---|
| **ChatGPT + Word templates** | Setup manuel | 20 €/mois | FAKT structure le prompt et la persistence, pas de copier-coller |
| **Les skills Claude Code actuels** | Génération .docx isolée | Inclus dans Claude | FAKT = les skills + orchestration + signature + suivi |
| **Bonsai** (US) | All-in-one freelance US-first | 17-49 $/mois | Non FR-compliant, cloud-only |

**Positionnement FAKT unique :**

> **Le seul outil desktop open-source francophone qui combine génération IA + signature électronique avancée + gestion cycle complet en hors-ligne par défaut.**

Trois marchés possibles :
1. **Freelance CLI-natif (niche early adopter)** : les users de Claude Code / Cursor qui détestent les SaaS. 500-2 000 users potentiels FR.
2. **Agence tech 5-15 pers** (marché self-host v0.2) : boîtes qui veulent data chez elles, Docker-friendly. ~200 boîtes cibles.
3. **Freelance grand public (SaaS v0.3+)** : compétition frontale avec Indy/Freebe/Abby. Marché ~500 000 freelances FR, CAC élevé. Différentiateur = IA + design unique.

---

## Business Model & Open-Source Strategy

**Licence choisie : Business Source License 1.1 (BSL)**
- **Grant supplémentaire :** usage personnel ou organisationnel autorisé. **Revente en SaaS concurrent interdite** pendant la période de licence.
- **Change Date :** 2030-04-21 (soit 4 ans après release initiale).
- **Change License :** Apache 2.0 automatique à la Change Date.
- **Références similaires :** MariaDB, Sentry, HashiCorp Terraform, CockroachDB.

**Modèle monétaire en 3 étages :**

1. **Free — Mode local (v0.1+)**
   - Binaire desktop téléchargeable gratuitement sur GitHub.
   - Aucune télémétrie obligatoire.
   - 100 % des features.
   - **Cible :** freelance solo adopteur.

2. **Free — Mode self-host entreprise (v0.2+)**
   - Docker Compose gratuit.
   - Multi-user, PostgreSQL, sync desktop↔backend.
   - **Cible :** petites agences tech (AlphaLuppi + équivalents).

3. **Paid — Mode SaaS hébergé (v0.3+)**
   - ~12 €/user/mois (à affiner).
   - Nous gérons hosting, backups, code-signing, updates auto, signature qualifiée Yousign en option.
   - **Cible :** freelance grand public qui ne veut pas bricoler.

**Stratégie open-source :**

- **Repo public AlphaLuppi/FAKT** dès jour 1. Permet la pub, les PR communauté, la transparence.
- **BSL protège le revenu SaaS futur** : personne ne peut légalement lancer « fakt-cloud.com » concurrent basé sur notre code pendant 4 ans.
- **CONTRIBUTING.md explicite** : plugins bienvenus, traductions bienvenues, refactors bienvenus. Nouvelle feature majeure = issue d'abord pour aligner.
- **CLA (Contributor License Agreement)** : oui, léger, pour permettre le dual-licensing futur (offrir une licence commerciale à ceux qui voudraient revendre en SaaS).
- **Landing page `fakt.alphaluppi.com`** sobre brutalist avec 3 CTA : download, self-host, join-waitlist-SaaS.
- **Canaux de launch :** Product Hunt, Hacker News, r/freelance, r/selfhosted, Indie Hackers, Twitter FR tech, LinkedIn FR freelance, newsletter BNF (Biz News Freelance).
- **Messaging clé :** « Yousign + Indy en open-source, app desktop ~100 Mo (équivalent Slack/Discord/Obsidian), hors ligne par défaut. »

---

## Next Steps

1. ✅ **Product Brief — TERMINÉ** (ce document).
2. → **PRD (Product Requirements Document)** : lancer `/prd` pour détailler user stories + acceptance criteria. Obligatoire au Level 3.
3. → **Architecture** : lancer `/architecture` pour arrêter la structure monorepo, les packages, les interfaces entre modules, les choix de librairies crypto, etc.
4. → **Solutioning Gate Check** (optionnel mais recommandé) avant implémentation.
5. → **Sprint Planning** + **Create Story** + **Dev Story** pour livraison itérative.

Parallèle : créer le repo GitHub `AlphaLuppi/FAKT` public dès validation de ce brief, et scaffolder la structure monorepo.

---

## Gaps et hypothèses à valider avec le user avant de passer au PRD

Je liste ici les hypothèses que j'ai faites sans validation explicite, pour t'éviter de découvrir un malentendu au PRD :

1. **Entité juridique dans le Licensor BSL.** J'ai supposé `AlphaLuppi SAS` (ou `Tom Andrieu — AlphaLuppi`). **À confirmer : quelle est la forme juridique qui publie FAKT ?** (SAS, EURL, EI, association…). Ça figera la ligne `Licensor` dans le fichier LICENSE.

2. **Code-signing certs.** J'ai posé ~200 €/an budget (Apple Dev Program 99 $/an + Windows Authenticode OV ~80-200 $/an). **À confirmer : budget accepté ? Si oui, je démarre les achats en semaine 1.**

3. **Domaine landing page.** J'ai posé `fakt.alphaluppi.com` comme hypothèse. **À confirmer : le domaine `alphaluppi.com` est-il propriété AlphaLuppi et disponible pour un sous-domaine ? Alternative : `fakt.dev`, `fakt.app` (domaines libres à vérifier).**

4. **Télémétrie anonyme.** J'ai supposé un beacon opt-in pour mesurer MAU (PostHog self-host ou Plausible). **À confirmer : OK pour ajouter un beacon désactivable ? Défaut activé ou désactivé ?**

5. **CLA (Contributor License Agreement).** J'ai recommandé un CLA léger pour permettre le dual-licensing futur. **À confirmer : OK pour CLA, ou préférence pour DCO (Developer Certificate of Origin, plus léger, pas de dual-licensing possible) ?**

6. **Langue par défaut de l'UI.** FR par défaut, EN en bonus plus tard. **À confirmer : c'est bien ça, ou on prévoit dès le MVP un switch FR/EN ?**

7. **TVA.** MVP supporte UNIQUEMENT « TVA non applicable art. 293 B CGI » (micro-entreprise). Les freelances en SAS assujetties TVA sont **hors cible MVP**. **À confirmer : on shippe la v0.1 mono-régime, TVA ajoutée en v0.2 ?**

8. **Signature : cert auto-généré vs cert du user.** J'ai supposé qu'on génère un cert X.509 auto-signé local au 1er lancement, nommé avec le nom légal du freelance. Le user peut-il importer son propre cert (déjà acheté auprès d'une CA) en alternative ? **À confirmer : important-own-cert en option dans v0.1 ou plus tard ?**

9. **Templates docx legacy à intégrer.** Les 2 skills ZIP actuels contiennent `references/template.md`. **À confirmer : je peux modifier/améliorer visuellement le template (dans le respect de la charte bleu `#2E5090`, Arial) lors du port Typst, ou fidélité pixel-perfect obligatoire ?**

10. **Multi-membre dans le workspace solo.** MVP solo = 1 seul user par workspace, pas d'auth. La v0.2 self-host introduit multi-user. **À confirmer : dans MVP, pas de notion de "qui a créé ce devis" parce que c'est toujours toi ?**

Si tu m'envoies juste « OK décide sur tout ça aussi », je prends des défauts raisonnables et on continue sur le PRD. Sinon précise-moi les points où tu veux un choix à la main.

---

**Ce document a été créé selon BMAD Method v6 — Phase 1 (Analysis).**

*Pour continuer : lance `/prd` pour le Product Requirements Document (obligatoire en projet Level 3), ou `/workflow-status` pour voir l'état global.*
