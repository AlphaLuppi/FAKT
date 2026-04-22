# Product Hunt — FAKT v0.1.0

**NE PAS POSTER** avant que Tom ait validé le timing de launch.

---

## Tagline (60 chars max)

FAKT — Facturez et signez en local, sans SaaS

---

## Description courte (260 chars max)

Application desktop open-source pour freelances français. Devis + factures conformes CGI, signature PAdES avancée maison (pas Yousign), 100% offline-first, IA Claude intégrée. App desktop ~100 Mo (équivalent Slack/Discord). Windows/macOS/Linux. BSL 1.1.

---

## Gallery prompts (pour les visuels à préparer)

1. Hero : screenshot dashboard FAKT avec KPIs (CA signé, devis en attente)
2. Vue détail devis : split-pane formulaire + preview PDF Brutal Invoice
3. Modale signature : dialogue confirmation PAdES avec audit trail
4. Landing page fakt.alphaluppi.com (screenshot)
5. Screenshot Adobe Reader avec signature verte validée

---

## First comment — Maker's story (à poster par Tom en tant que maker)

Bonjour à tous,

Je suis Tom Andrieu, développeur freelance à Avignon. Pendant 3 ans, j'ai jonglé avec 6 outils pour un cycle simple : Word pour le devis, Yousign pour la signature, Google Drive pour l'archivage, un tableur pour le suivi, Indy pour la numérotation légale, et une IA dans un onglet séparé pour rédiger les relances.

Il y a quelques mois, j'ai commencé à bricoler des skills Claude Code (`/devis-freelance`, `/facture-freelance`) qui généraient des PDF directement depuis le terminal. Gain réel — mais pas de persistence, pas de signature, pas d'UI pour editer.

Alors j'ai décidé d'aller jusqu'au bout : **FAKT** est le résultat.

**Ce qui me tient à cœur dans FAKT :**

1. **La signature maison.** On entend souvent "signez avec Yousign" comme si c'était la seule option. J'ai implémenté PAdES AdES-B-T directement en Rust — clé RSA 4096 dans le keychain OS, horodatage TSA RFC 3161, audit trail append-only chaîné SHA-256. Le PDF est vérifiable dans Adobe Reader. Ça fonctionne à 100% hors-ligne. C'est la même qualité que Yousign Basic, sans l'abonnement SaaS.

2. **Les données restent chez vous.** FAKT ne fait aucun appel réseau critique (seulement le TSA FreeTSA pour l'horodatage). Votre base SQLite est dans `~/.fakt/`. Vous pouvez l'ouvrir avec SQLiteViewer. Vous comprenez ce que fait le code — il est public.

3. **Le design.** Je voulais quelque chose de mémorable, pas un énième SaaS bleu Tailwind. J'ai appelé ça Brutal Invoice : noir encre + papier off-white + jaune vif, Space Grotesk UPPERCASE, ombres plates, zéro border-radius. L'identité visuelle est non-négociable dans le repo.

4. **La conformité FR sans friction.** Numérotation séquentielle sans trous (CGI art. 289), mention TVA non applicable, indemnité forfaitaire 40€, archivage 10 ans via contrainte DB — tout ça est dans le code, pas dans un README.

En v0.2 (dans ~2 mois), je prévois le mode self-host Docker pour les petites agences. En v0.3, un SaaS hébergé pour ceux qui ne veulent pas gérer l'infra.

La licence est BSL 1.1 — open-source lisible et contributable, mais revente en SaaS concurrent interdite jusqu'en 2030, date à laquelle ça bascule automatiquement en Apache 2.0.

Je suis preneur de vos retours, en particulier sur les templates de documents, les cas de TVA assujettie (hors scope v0.1 mais v0.2 candidat), et tout ce qui concerne la conformité légale Belgique/Suisse/Québec.

Merci à Tauri, Typst, et l'équipe Anthropic pour les outils qui rendent tout ça possible.

Tom — contact@alphaluppi.com — [@Seeyko_](https://twitter.com/seeyko_)
