# Twitter / X — Thread de launch

**NE PAS POSTER** avant validation du timing par Tom.

---

## Thread (6-8 tweets)

**Tweet 1 — Accroche**

J'ai arrêté de payer Yousign + Indy + Google Drive.

J'ai fait FAKT.

~100 Mo. Desktop. Open-source. PAdES maison. SQLite local.

Vos devis et factures signés. En local. Pour toujours.

→ https://github.com/AlphaLuppi/FAKT

---

**Tweet 2 — Le problème**

Pendant 3 ans, mon cycle de facturation ressemblait à ça :

• Word pour le devis
• Yousign pour la signature (18 €/mois)
• Google Drive pour l'archivage
• Un tableur pour le suivi
• Indy pour la numérotation légale (12 €/mois)
• Claude dans un onglet pour les relances

30 €/mois pour jongler entre 6 outils. 🙃

---

**Tweet 3 — La solution**

FAKT : tout ça dans une app desktop de ~100 Mo (équivalent Slack/Discord/Obsidian).

✓ Devis + factures conformes (CGI art. 289)
✓ Numérotation séquentielle automatique
✓ Signature PAdES AdES-B-T maison en Rust
✓ Horodatage TSA RFC 3161
✓ Audit trail SHA-256 chaîné
✓ Brouillon email .eml
✓ Export ZIP archive 10 ans

Offline-first. Data chez vous. Zéro SaaS obligatoire.
Port Rust du sidecar prévu v0.2 → ~20 Mo visés.

---

**Tweet 4 — La signature (le truc technique cool)**

J'ai implémenté PAdES en Rust plutôt que d'appeler Yousign.

Concrètement :
• Clé RSA 4096 dans le keychain OS
• SHA-256 du document signé
• Horodatage FreeTSA (RFC 3161)
• Structure CMS dans le PDF via lopdf

Le résultat : signature verte dans Adobe Reader.
100% hors-ligne. Niveau eIDAS avancé (AdES-B-T).

---

**Tweet 5 — Open-source + design**

FAKT est open-source sous BSL 1.1.

Le code est lisible. Vous comprenez ce que fait le logiciel.
La BSL interdit les SaaS concurrents basés sur ce code pendant 4 ans.
En 2030, bascule automatique en Apache 2.0.

Et le design ? "Brutal Invoice" — noir/papier/jaune,
Space Grotesk UPPERCASE, ombres plates, zéro radius.

Parce qu'un outil de freelance peut être beau.

---

**Tweet 6 — IA intégrée**

J'ai intégré Claude Code CLI en subprocess.

Vous collez un brief client → FAKT extrait :
• Le client
• Les lignes de prestations
• Les montants
• Les conditions

Vous avez votre propre token Anthropic. FAKT ne le touche jamais.

C'est l'approche que je voulais : votre IA, vos données, votre machine.

---

**Tweet 7 — Call to action**

FAKT v0.1.0 est disponible.

→ GitHub : https://github.com/AlphaLuppi/FAKT
→ Landing : https://fakt.alphaluppi.com
→ Docs : https://fakt.alphaluppi.com/docs

Win / macOS / Linux.

Si tu factures en micro-entreprise FR et que tu aimes les outils qui font une chose bien — c'est fait pour toi.

---

**Tweet 8 — Roadmap et clôture**

La suite :
• v0.1.1 : signature Windows Authenticode + Playwright E2E
• v0.2 : mode self-host Docker pour les agences
• v0.3 : SaaS hébergé ~12 €/mois si tu veux pas gérer l'infra

Merci à Tauri, Typst et @AnthropicAI pour les briques qui rendent tout ça possible.

RTs appréciés si tu connais des freelances FR tech. 🙏
