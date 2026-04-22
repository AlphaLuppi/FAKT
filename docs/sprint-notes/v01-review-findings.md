# FAKT v0.1 — Review findings (Phase 3)

**Démarré :** 2026-04-22
**Team :** fakt-phase3-review
**Scope :** tout le code mergé Phase 1 + Phase 2 (commits 239fafd..ae73852 sur main)

## Règles d'append (tous les agents)

- Un finding = un bloc `###` avec header `### [PRIORITY] [AGENT] titre court`
- PRIORITY ∈ {P0, P1, P2, P3}
  - **P0** : release-blocking (crash, bug légal FR, faille sécu exploitable, data loss, build cassé)
  - **P1** : blocker pour DoD v0.1 mais pas critique (UX manquante sur un flow, régression, signature mal affichée, CHANGELOG incomplet)
  - **P2** : nice-to-have, peut attendre v0.1.1 (polish UI, doc secondaire, test manquant non critique)
  - **P3** : tech debt / suggestion future
- Toujours inclure : `**Path:**` fichier:ligne si applicable, `**Fix suggéré:**`, `**Reproduction:**` si bug runtime
- Ne rééditez pas les findings d'autres agents — append-only sous votre section.
- Cochez `- [x]` au début du titre quand le fix est commit.

## Sommaire des priorités (mis à jour en fin de review)

- P0 : _(à compléter)_
- P1 : _(à compléter)_
- P2 : _(à compléter)_
- P3 : _(à compléter)_

---

## Section : security-reviewer

_Scope :_ OWASP top 10 sur packages/api-server, secrets, crypto PAdES (apps/desktop/src-tauri/src/crypto/), token X-FAKT-Token binding 127.0.0.1 strict, CORS, SQL injection Drizzle, audit trail append-only intégrité, capabilities Tauri least-privilege.

_(append findings ci-dessous)_

---

## Section : bugs-reviewer

_Scope :_ logic errors, null safety, edge cases (from-quote deposit30 boundary 30%, numbering year transition 2026→2027, empty workspace, soft-delete/restore race, concurrence).

_(append findings ci-dessous)_

---

## Section : qa-smoke-live

_Scope :_ lance `bun run tauri:dev` + parcourt end-to-end onboarding → client → prestation → devis 2 lignes + issue → signer canvas → facture from-quote total → mark-paid avec notes → préparer email → export archive ZIP. Screenshot chaque régression. Vérifie sidecar api-server spawn + répond.

_(append findings ci-dessous)_

---

## Section : ui-ux-reviewer

_Scope :_ Brutal Invoice strict (bordures 2-2.5px, shadows plates 3/5/8px, zéro radius, Space Grotesk UPPERCASE titres, hover inversion #000↔#FFFF00), accessibilité clavier (⌘K palette, ⌘/ composer, ⌘N, Escape), cohérence copy FR, error states.

_(append findings ci-dessous)_

---

## Section : pm-acceptance

_Scope :_ matche DoD v0.1 (progress.md) case par case → liste cochées / non cochées. Cohérence vs specs Phase 1. Dette v0.1.1 vs release-blocking v0.1.

_(append findings ci-dessous)_

---

## Section : docs-reviewer

_Scope :_ README.md (install, usage, 100 MB), CHANGELOG.md v0.1.0 Added/Changed/Fixed/Known issues exhaustif, docs/architecture.md 3 modes, specs refacto cohérentes avec code livré, .github/launch-messages/ post-refacto.

_(append findings ci-dessous)_
