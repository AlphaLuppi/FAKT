# FAQ FAKT

**Audience :** Tous (utilisateurs lambda, investisseurs, juristes, curieux)
**Résumé :** Questions fréquentes par audience.
**Dernière mise à jour :** 2026-04-25

---

## Pour les utilisateurs

### Mes données partent-elles sur un serveur ?

**Non, en mode 1 (solo desktop).** 100% de vos données restent sur votre poste : `~/.fakt/db.sqlite`, PDFs signés dans `app_data_dir/signed/`, clé privée RSA dans le Keychain OS. Aucune télémétrie réseau.

**Ça dépend, en mode 2 (self-host).** Vos données vont sur **votre serveur** — AlphaLuppi n'y a pas accès.

**Oui, en mode 3 (SaaS, futur).** Données chez AlphaLuppi avec engagement RGPD strict, hébergement UE.

### Puis-je utiliser FAKT sans installer Claude CLI ?

**Oui.** Toutes les fonctionnalités de base (devis, factures, signature, archive) marchent sans IA. Claude CLI active uniquement l'extraction de devis depuis un brief et la rédaction assistée de relances.

### Compatible avec Indy / Tiime / EBP / Pennylane ?

**Pas d'intégration native en MVP.** Mais l'export ZIP workspace contient `clients.csv`, `prestations.csv`, `quotes.csv`, `invoices.csv` — formats standard que vous pouvez importer dans la plupart des logiciels de compta.

Une **API publique** est planifiée pour v0.3+ (intégrations natives).

### Mes factures sont-elles vraiment juridiquement valides ?

**Oui.** FAKT respecte :
- CGI art. 289 (numérotation séquentielle sans trous)
- Mentions obligatoires factures (SIRET, forme juridique, échéance, pénalités, indemnité 40€, mention TVA)
- Article L102 B (archivage 10 ans, soft delete uniquement)
- Signature eIDAS Avancée (AdES-B-T, RFC 3161 timestamp)

Détails compliance : [security-compliance.md](security-compliance.md).

### Que se passe-t-il si je perds mon ordinateur ?

**Restaurez depuis votre dernier export ZIP** (`Menu Archive → Exporter le workspace`). Vous récupérez toutes vos données + PDFs signés.

**Recommandation :** exportez **chaque mois** vers un cloud sécurisé (votre Drive, Dropbox, NAS).

> En mode 2 self-host : les backups Postgres quotidiens sont gérés serveur-side.

### Puis-je migrer mes données depuis Indy / Word / Excel ?

**Pas d'import automatique en MVP.** Vous saisirez vos clients et créerez vos premiers devis/factures à la main. Pour de gros volumes : ouvrez un issue, on peut écrire un script de migration sur mesure.

### FAKT est-il vraiment gratuit ?

**Oui, en mode 1 et mode 2.** Le mode 3 SaaS (futur) sera payant pour ceux qui ne veulent pas auto-héberger. Voir [about.md](about.md) pour le modèle économique.

---

## Pour les investisseurs / décideurs

### Pourquoi BSL 1.1 et pas MIT ?

**Pour protéger 4 ans la phase d'investissement initial sans bloquer les utilisateurs.** La BSL autorise tout (usage, fork, contribution, self-host) sauf la revente en SaaS concurrent payant. Après 2030-04-21, conversion automatique en Apache License 2.0 — entièrement libéré.

C'est le pattern de MariaDB, Sentry, CockroachDB. Détails : [about.md](about.md#licence--business-source-license-11).

### Quelle est la traction actuelle ?

**v0.1 livré le 2026-04-21.** Premier déploiement réel : Tom Andrieu lui-même + 4 collègues AlphaLuppi (mode 2 en cours). Pas encore d'acquisition externe — projet open-source en phase early.

### Quelle est la stratégie d'acquisition ?

**Bottom-up community-led.**

1. Open-source visible sur GitHub (BSL avec change date claire)
2. Contenu technique sur le pattern "outil interne agence"
3. SEO sur "facture freelance signature électronique" / "alternative Yousign indy"
4. Bouche-à-oreille communauté freelance tech FR
5. Pas de paid acquisition en MVP — too early

### Combien de revenus à terme ?

Hypothèses TAM/SAM (à valider) :
- Freelances FR ICP cible : ~200k personnes (micro-entreprises tech)
- Pénétration objectif 5 ans : 1% = 2000 utilisateurs
- ARPU mode 3 (SaaS) : 9-24€/mois selon plan
- ARR potentiel 5 ans : ~300-700k€

C'est un projet **lifestyle / sustainable** plus qu'un VC play. Pas d'objectif "unicorn".

### Investissement nécessaire ?

**Aucun externe en MVP.** Tom finance via revenus AlphaLuppi (agence). FAKT s'auto-finance par le mode 3 SaaS quand il sera lancé.

Si levée envisagée à terme : plutôt **revenue-based financing** ou **equity small** que VC classique.

---

## Pour les juristes / DPO

### Qui est responsable de traitement RGPD ?

- **Mode 1 (solo) :** vous. AlphaLuppi n'a aucun accès aux données.
- **Mode 2 (self-host) :** vous (votre serveur, votre Postgres).
- **Mode 3 (SaaS) :** AlphaLuppi (sous-traitant), DPA fourni sur demande.

### Niveau eIDAS de la signature ?

**Avancée (AdES-B-T)** — niveau 2 sur 3. Pas qualifiée (impossible sans accréditation ANSSI).

L'avancée est suffisante pour la plupart des cas d'usage commerciaux freelance/agence. La qualifiée n'est requise que pour des actes spécifiques (signatures de baux notariés, marchés publics > seuil européen, etc.).

Détails techniques : [security-compliance.md](security-compliance.md).

### L'archivage 10 ans est-il garanti ?

**Oui, structurellement :**
- Pas de hard delete sur les factures émises (soft delete `cancelled` uniquement)
- Pas de UPDATE/DELETE sur l'audit trail signature (table append-only)
- Export ZIP workspace pour transmission à l'expert-comptable / contrôle fiscal

À votre charge :
- Backup régulier de votre `~/.fakt/db.sqlite` ou Postgres
- Conservation des ZIPs annuels

### FAKT a-t-il été audité ?

**Pas encore par un organisme tiers.** Audit pen-test possible sur demande pour les déploiements self-host enterprise (`contact@alphaluppi.com`).

---

## Pour les développeurs

### Pourquoi Tauri et pas Electron ?

- **Taille** : Tauri ~100 Mo, Electron 200-300 Mo
- **Sécurité** : sandbox webview natif vs. Chromium embarqué
- **Performance** : Rust core vs. Node main process
- **Updater** : Ed25519 signed natif

### Pourquoi Bun et pas Node ?

- **Bundle compile standalone** (`bun build --compile`) — sidecar packagé en 1 binaire
- **Performance** sur les workloads I/O-heavy (sidecar Hono)
- **Built-ins** : `bun:sqlite`, `Bun.password`, `Bun.serve` — moins de deps
- **DX** : `bun install` 10x plus rapide que `npm install`

### Pourquoi Hono et pas Express / Fastify ?

- **Edge-ready** (Cloudflare Workers, Bun, Deno)
- **TypeScript-first** avec inférence de routes
- **Léger** (~20 KB vs 500 KB Express)
- **Middleware moderne** (CORS, JWT, ETag intégrés)

### Pourquoi Typst et pas headless Chrome / wkhtmltopdf ?

- **Déterministe** : même input = même PDF byte-à-byte (critique pour la signature PAdES)
- **Pas de Chromium** dans le bundle (gain de 100+ Mo)
- **Templates plus lisibles** que CSS print + HTML

### Pourquoi PAdES maison et pas Yousign / Docusign ?

- **Coût** : Yousign ~19-49€/mois récurrent vs. zéro
- **Souveraineté** : clé privée jamais transmise à un tiers
- **Hors-ligne** : signature même sans réseau (sauf timestamp TSA)
- **Open-source** : code auditable, pas de boîte noire

### Comment contribuer ?

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — guide complet
- [contributing.md](contributing.md) — version courte
- [architecture-overview.md](architecture-overview.md) — vue tech
- [github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues) — issues ouvertes

---

## Question pas dans la FAQ ?

- **Issues GitHub** : [github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues)
- **Discussions GitHub** : [github.com/AlphaLuppi/FAKT/discussions](https://github.com/AlphaLuppi/FAKT/discussions)
- **Email** : `contact@alphaluppi.com`
- **Sécurité (vuln)** : voir [SECURITY.md](../../SECURITY.md)
