# À propos de FAKT

**Audience :** Investisseur · Curieux · Juriste · Décideur
**Résumé :** Qui fait FAKT, pourquoi, modèle économique, license, crédits.
**Dernière mise à jour :** 2026-04-25

---

## Qui fait FAKT ?

FAKT est développé par **[AlphaLuppi](https://alphaluppi.com)**, agence tech basée à Avignon (France). Mainteneur principal : **Tom Andrieu** (`contact@alphaluppi.com`).

Le projet est open-source (BSL 1.1) et suit le pattern « outil interne AlphaLuppi » établi par [MnM](https://github.com/AlphaLuppi/mnm) : un outil construit pour les besoins internes de l'agence, puis ouvert à la communauté en triple déploiement (solo local → self-host entreprise → SaaS hébergé).

## Pourquoi FAKT ?

Les freelances et petites agences françaises qui facturent sérieusement jonglent entre 4 à 7 outils distincts pour un cycle simple :

1. Un éditeur (Word, Pages, Google Docs) pour le devis
2. Un service de signature (Yousign, Docusign) à 19-49€/mois
3. Un tableur pour le suivi
4. Un logiciel de compta (Indy, Tiime, EBP) pour la numérotation légale et l'archivage
5. Un système de stockage (Drive, Dropbox)
6. Un mailer pour envoyer
7. Optionnellement un assistant IA pour rédiger

**FAKT réunit tout ça dans un seul outil desktop.** De ton brief client à un PDF signé : 3 minutes au lieu de 30. Hors-ligne par défaut. Souverain.

## Pour qui ?

**ICP MVP (Ideal Customer Profile) :**

- Freelance tech francophone, micro-entreprise ou EI
- Émet 5-30 factures par mois
- Déjà à l'aise avec un terminal CLI (signal d'autonomie)
- Veut garder ses données souveraines (pas de cloud obligatoire)
- Revenu annuel 30-80k€

**Cas d'usage validé v0.1 :** Tom Andrieu lui-même, et sa première équipe AlphaLuppi (5 utilisateurs).

## Modèle économique

FAKT suit un modèle **open-core BSL → SaaS** :

1. **Mode 1 (v0.1)** — App desktop solo, gratuite, auto-hébergée. Open-source BSL 1.1.
2. **Mode 2 (v0.2+)** — Self-host entreprise pour les agences. Same code, deploiement Docker. Gratuit pour usage interne (pas de revente).
3. **Mode 3 (v0.3+)** — SaaS hébergé, abonnement mensuel. Géré par AlphaLuppi.

Les modes 1 et 2 restent **gratuits pour l'utilisateur final**. La monétisation passe par le SaaS (mode 3) pour ceux qui ne veulent pas auto-héberger, et par les licences commerciales (entreprises qui voudraient bypasser la BSL pour un usage commercial concurrent).

## Licence — Business Source License 1.1

FAKT est sous **[BSL 1.1](../../LICENSE)** avec change date **2030-04-21** → Apache License 2.0.

**Ce que la BSL autorise :**
- Usage personnel et professionnel illimité
- Self-host dans votre organisation (mode 2)
- Fork, modification, contribution
- Lecture intégrale du code source

**Ce que la BSL interdit pendant 4 ans (jusqu'au 2030-04-21) :**
- Vendre un SaaS concurrent payant basé sur FAKT
- Revente sous une autre marque (white-label commercial)

À partir du **2030-04-21**, FAKT bascule automatiquement en **Apache License 2.0** (open-source classique sans restriction). Ce mécanisme garantit un horizon ouvert tout en protégeant la phase initiale d'investissement.

**Licence commerciale anticipée** disponible : `contact@alphaluppi.com`.

## Pourquoi BSL et pas MIT direct ?

Le risque MIT/Apache : un acteur cloud reprend le code, le déploie en SaaS managé concurrent et capte la majorité de la valeur sans contribuer au projet (cf. drama Elastic / AWS, MongoDB / AWS, Redis / AWS). La BSL protège contre ce scénario en imposant 4 ans d'exclusivité commerciale **uniquement sur le SaaS concurrent**, sans rien interdire d'autre. Après 4 ans, le code est entièrement libéré (Apache 2.0).

C'est le même pattern que **MariaDB MaxScale**, **Sentry**, **CockroachDB Core**, **HashiCorp Vault**.

## Données et confidentialité

**Mode 1 (solo desktop) :**
- 100% des données restent sur le poste utilisateur (`~/.fakt/db.sqlite` + Keychain OS pour la clé privée)
- Aucune télémétrie réseau, aucun analytics
- L'IA passe par votre propre token Anthropic (Claude Code CLI subprocess)

**Mode 2 (self-host entreprise) :**
- Données dans votre Postgres, sur votre serveur
- Aucune fuite vers AlphaLuppi

**Mode 3 (SaaS hébergé, futur) :**
- Données chez AlphaLuppi avec engagement RGPD strict
- Région d'hébergement UE
- DPA fourni sur demande

Détails compliance : [security-compliance.md](security-compliance.md).

## Crédits

FAKT est rendu possible par les projets open-source suivants :

- **[Tauri](https://tauri.app)** — framework desktop Rust + webview
- **[Typst](https://typst.app)** — rendu PDF déterministe sans headless Chrome
- **[Anthropic](https://anthropic.com)** — Claude Code CLI pour la génération IA
- **[FreeTSA](https://freetsa.org)** — horodatage RFC 3161 gratuit (PAdES B-T)
- **[Biome](https://biomejs.dev)** — lint et format ultra-rapide
- **[Hono](https://hono.dev)** — micro-framework HTTP
- **[Drizzle ORM](https://orm.drizzle.team)** — TypeScript ORM portable

Et tout le travail open-source francophone qui inspire le pattern « outil interne agence ».

## Contact

- **Email** : `contact@alphaluppi.com`
- **GitHub Issues** : [github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues)
- **Discussions** : [github.com/AlphaLuppi/FAKT/discussions](https://github.com/AlphaLuppi/FAKT/discussions)
- **Sécurité (vuln)** : voir [SECURITY.md](../../SECURITY.md)
