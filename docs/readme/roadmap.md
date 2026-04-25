# Roadmap FAKT

**Audience :** Product Manager · Investisseur · Contributeur · Curieux
**Résumé :** Vision triple-déploiement (modes 1/2/3) et milestones associés.
**Dernière mise à jour :** 2026-04-25

---

## Vision long-terme

FAKT vise à devenir **l'outil unifié devis-factures-signature de référence pour les freelances et petites agences francophones**, avec trois modes de déploiement progressifs qui partagent la même base de code :

```
v0.1 (livré)       →    v0.2 (Q2 2026)    →    v0.3+ (H2 2026+)
Solo desktop            Self-host entreprise   SaaS hébergé
gratuit, hors-ligne     gratuit, multi-user    abonnement
```

Le cap final : **2030-04-21**, conversion automatique de la BSL 1.1 en Apache License 2.0 — projet entièrement libéré.

## Mode 1 — Solo desktop (✅ livré v0.1.0 → v0.1.10)

**Audience :** freelance solo français.

**Statut :** **MVP livré** depuis 2026-04-21. Production-ready.

**Fonctionnalités principales :**
- Devis + factures avec numérotation atomique CGI
- Signature PAdES B-T maison (Rust + keychain OS)
- IA via Claude Code CLI (subprocess, ton propre token)
- Rendu PDF Typst déterministe
- Brouillon email `.eml` ouvert dans le client mail OS
- Export ZIP workspace 10 ans
- Dashboard + activity feed
- 3 plateformes (Windows / macOS / Linux)
- Auto-update Tauri Ed25519

**Roadmap v0.1.x (patches) :**
- [ ] Signature Authenticode Windows (silencer SmartScreen)
- [ ] Notarization macOS (silencer Gatekeeper)
- [ ] i18n EN partielle (UI bilingue, mentions légales restent FR)
- [ ] Templates PDF customisables (override des templates Typst depuis settings)

## Mode 2 — Self-host entreprise (🚧 en cours v0.2)

**Audience :** agences 5-50 collaborateurs internes.

**Statut :** **architecture spécifiée**, implémentation en cours (Sprint 1-7 du plan setup AlphaLuppi).

**Différences clés vs mode 1 :**
- Backend déployé sur serveur (Docker + Postgres + Caddy)
- Auth multi-user (email + password + JWT, prep Google OAuth)
- Web UI responsive (réutilise le bundle desktop)
- Migration data SQLite local → Postgres distant
- Distribution app desktop pré-configurée (URL backend bakée)
- Signature reste poste desktop (clé privée jamais sur le réseau)

**Premier déploiement cible :** `fakt.alphaluppi.fr` (Tom + 4 collègues d'AlphaLuppi).

**Milestones v0.2 :**
- [x] Schéma Drizzle Postgres + tables users/user_workspaces/sessions
- [x] Auth layer JWT (password bcrypt + middleware + routes /api/auth/*)
- [x] Bootstrap api-server dual SQLite/Postgres
- [ ] Frontend desktop dual mode (sidecar local OU backend distant)
- [ ] Login UI + RequireAuth + useAuth hook
- [ ] Onglet Settings Backend (bascule local/remote)
- [ ] Endpoint `/api/render/pdf` serveur (Typst CLI)
- [ ] Build mode web (Vite output `dist-web/`)
- [ ] Audit responsive mobile (Bottom nav, tables → cards)
- [ ] Containerisation (Dockerfile + docker-compose + Caddyfile)
- [ ] Script migration `migrate-sqlite-to-postgres.ts`
- [ ] Workflow `release-alphaluppi.yml` (distribution privée)
- [ ] DNS `fakt.alphaluppi.fr` + TLS Caddy
- [ ] Backups Postgres quotidiens

**ETA v0.2 stable :** Q2 2026 (juin-juillet 2026).

## Mode 3 — SaaS hébergé (📅 planifié v0.3+)

**Audience :** freelances qui ne veulent pas auto-héberger.

**Statut :** **planifié, non commencé**. Démarrage post-v0.2 stable.

**Différences clés vs mode 2 :**
- Multi-tenant (workspaces multiples par compte AlphaLuppi)
- OAuth (Google + GitHub) en plus du password
- Stripe billing (abonnement mensuel)
- RLS Postgres (Row-Level Security par workspace)
- Sentry monitoring + observability
- Domain : `fakt.alphaluppi.fr` (ou `fakt.com` si acquis)

**Pricing prévisionnel :**
- Plan gratuit : 5 docs/mois, signature B (sans timestamp)
- Plan Solo : ~9€/mois — illimité, signature B-T (FreeTSA)
- Plan Team : ~24€/mois par user — multi-user, support
- Plan Enterprise : sur devis — SLA, audit trail premium, HSM signing

**Milestones v0.3 :**
- [ ] Multi-tenant DB schema (workspaces multiples par user)
- [ ] OAuth Google + GitHub (lib `arctic`)
- [ ] Stripe integration (subscriptions + webhooks)
- [ ] RLS Postgres policies par workspace
- [ ] Sentry + Plausible self-host (analytics privacy-friendly)
- [ ] Page pricing + landing fakt.alphaluppi.com
- [ ] DPA template (RGPD)
- [ ] Status page (uptime monitoring)

**ETA v0.3 :** H2 2026 / Q1 2027.

## Mode 4 — Remote signing avec HSM (📅 long-terme v0.4+)

**Audience :** entreprises avec exigence eIDAS qualifiée.

**Statut :** **idée**. Pas démarré.

**Permettrait :**
- Signature qualifiée (QES) avec HSM cloud (Yubico, Thales)
- Signature web (sans desktop requis)
- Workflow "sign request" → notification desktop → user signe sur poste
- Conformité ANSSI accréditation (long, cher)

**ETA :** post-2027, dépend de la traction commerciale du mode 3.

## Au-delà — 2030 et après

**2030-04-21 :** la BSL 1.1 bascule en **Apache License 2.0** (change date). FAKT devient entièrement open-source classique sans restriction commerciale.

À ce stade :
- N'importe qui peut forker / vendre / commercialiser
- AlphaLuppi reste mainteneur principal (mais plus de levier exclusif)
- Le projet survit par la communauté

Cette mécanique BSL → Apache garantit un horizon ouvert pour les utilisateurs tout en protégeant 4 ans la phase d'investissement initial. C'est le même pattern que MariaDB, Sentry, CockroachDB.

## Pour aller plus loin

- [docs/product-brief.md](../product-brief.md) — brief produit complet
- [docs/prd.md](../prd.md) — PRD avec 25 FRs / 12 NFRs / 8 epics
- [features.md](features.md) — fonctionnalités par version
- [self-hosting.md](self-hosting.md) — guide mode 2 self-host
- [about.md](about.md) — modèle économique et license
