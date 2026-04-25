# Sécurité & Compliance FAKT

**Audience :** Auditeur · Juriste · DPO · Décideur
**Résumé :** RGPD, eIDAS AdES-B-T, CGI art. 289, archivage 10 ans, hardening technique.
**Dernière mise à jour :** 2026-04-25

> Ce document décrit les engagements **techniques et légaux** de FAKT. Pour signaler une vulnérabilité, voir [SECURITY.md](../../SECURITY.md) (divulgation responsable).

---

## RGPD — Protection des données

### Mode 1 (solo desktop)

- **100% des données restent sur le poste utilisateur** (`~/.fakt/db.sqlite` + Keychain OS pour la clé privée)
- **Aucune télémétrie** réseau
- **Aucun analytics** (pas de Google Analytics, pas de Plausible côté app)
- **L'IA** passe par le token Anthropic du user (Claude Code CLI subprocess) — AlphaLuppi ne voit rien
- **Pas de DPA nécessaire** — vous êtes votre propre responsable de traitement

### Mode 2 (self-host entreprise)

- Données dans **votre Postgres** sur **votre serveur**
- AlphaLuppi n'a **aucun accès**
- Vous êtes responsable de traitement (DPO de votre organisation)
- Backups sous votre responsabilité

### Mode 3 (SaaS hébergé, futur)

- Données chez AlphaLuppi avec engagement RGPD strict
- Région d'hébergement **UE uniquement** (Avignon ou Paris)
- DPA (Data Processing Agreement) fourni sur demande
- Sous-traitance documentée
- Suppression sur demande sous 30 jours

## Conformité fiscale française

### CGI article 289 — Numérotation séquentielle

> *"Les factures doivent comporter un numéro unique basé sur une séquence chronologique et continue."*

**Implémentation FAKT :**
- Table `numbering_state` avec contrainte `UNIQUE(workspace_id, year, type)`
- Numérotation atomique :
  - Mode SQLite : transaction `BEGIN IMMEDIATE`
  - Mode Postgres : `pg_advisory_xact_lock`
- Format : `D2026-0001` (devis) / `F2026-0001` (factures)
- **Pas de trous possibles** — chaque incrémentation est commit atomique
- **Soft delete uniquement** sur factures émises (jamais de hard delete) pour préserver la séquence

### Mentions obligatoires factures

Toutes les mentions exigées par le Code de commerce sont automatiquement injectées dans le PDF :
- ✓ SIRET émetteur
- ✓ Forme juridique
- ✓ Adresse complète
- ✓ Date d'émission
- ✓ Date d'échéance
- ✓ Pénalités de retard (taux défini en config)
- ✓ Indemnité forfaitaire 40€ (loi 2012)
- ✓ Mention TVA applicable ou exonération

**TVA micro-entreprise :** mention exacte par défaut "TVA non applicable, art. 293 B du CGI" (modifiable si vous passez sur le régime réel).

### Archivage 10 ans

L'article L102 B du Livre des procédures fiscales impose la conservation des factures émises pendant **10 ans**.

**Implémentation FAKT :**
- Table `invoices` : **pas de hard delete** côté API (status `cancelled` au lieu)
- Table `signature_events` : **append-only** (jamais de UPDATE ou DELETE)
- Table `signed_documents` : références persistantes vers les PDFs
- Export ZIP workspace pour transmission expert-comptable / contrôle fiscal

## eIDAS — Signature électronique

FAKT implémente la **signature avancée AdES-B-T** (niveau 2 sur 3 du règlement eIDAS) :

| Niveau eIDAS | FAKT |
|---|---|
| Simple | Couvert |
| **Avancée (AdES)** | ✅ **Implémenté** |
| Qualifiée (QES) | ❌ Hors scope (impossible sans accréditation ANSSI) |

### Garanties AdES-B-T

1. **Lien univoque au signataire** — clé RSA 4096 unique par utilisateur, stockée dans le keychain OS
2. **Identification du signataire** — cert X.509 contient nom + email
3. **Contrôle exclusif** — keychain OS protégé par session user (Windows Hello / Touch ID / passphrase Linux)
4. **Détection de toute modification ultérieure** — hash SHA-256 chaîné dans `signature_events`
5. **Horodatage qualifié** — RFC 3161 via FreeTSA (fallback `B` sans timestamp si réseau KO)

### Audit trail (chaîne d'intégrité)

Chaque signature génère un événement immuable dans `signature_events` :
- `previous_event_hash` lie au dernier événement précédent (chaîne SHA-256)
- `doc_hash_before` / `doc_hash_after` — hash du PDF avant/après signature
- `tsa_response` — token TSA (RFC 3161) si dispo
- `signed_by_user_id` — qui a signé (mode 2/3)

**Vérification :** la chaîne peut être reconstituée et vérifiée à tout moment via `verify_signature` (Tauri command).

### Vérification dans Adobe Reader

Les PDFs signés par FAKT sont **conformes PAdES** et vérifiables :
- Adobe Reader / Adobe Acrobat (Windows / macOS)
- Foxit Reader
- Tout outil compatible PAdES B / B-T

> Le cert auto-signé peut afficher "non vérifié" tant qu'il n'est pas dans le store de confiance Adobe. C'est attendu pour une signature personnelle (non qualifiée).

## Hardening technique

### Stockage secrets

- **Cert RSA + clé privée** : Keychain OS (DPAPI Windows / Keychain.app macOS / Secret Service Linux)
- **Token API mode 1** : généré crypto-random 32 bytes au spawn, jamais persisté
- **JWT secret mode 2** : env var serveur, min 32 chars
- **Pas de credentials hardcodés** dans le code source (audit `bun audit` + `cargo audit` en CI)

### Protection contre attaques classiques

- **CSRF** : cookie `SameSite=Strict` + state CSRF dans flux OAuth (futur)
- **XSS** : React escape par défaut + CSP strict côté Caddy (mode 2)
- **SQL injection** : Drizzle ORM avec parameterized queries partout (`bun audit` clean)
- **Timing attacks** : `timingSafeEqual` sur la comparaison du token mode 1
- **DNS rebinding** : whitelist d'origins CORS strict
- **Zip Slip** : validation des chemins lors de l'export ZIP (path traversal)

### Cryptographie

- **RSA 4096** pour les certificats X.509 (NIST recommandation 2024)
- **SHA-256** pour les hash documents et la chaîne d'audit
- **HS256** pour les JWT mode 2 (HMAC-SHA-256)
- **bcrypt cost=12** pour le hash des passwords (OWASP recommandation acceptable)
- **Argon2id** sur la roadmap pour v0.3 SaaS (plus résistant GPU)

### Code review et CI

- **Lint zéro warning** sur la CI (Biome)
- **Crypto audit dédié** : workflow `crypto-ci.yml` qui run clippy strict + cargo audit sur tout changement Rust crypto
- **Tests** : Vitest unit + Playwright E2E (couverture > 70% sur packages/core et packages/pdf)
- **Code reviewers** définis dans `CODEOWNERS`

## Politique de divulgation

Vous avez trouvé une vulnérabilité ?

**Ne créez PAS d'issue publique.** Voir [SECURITY.md](../../SECURITY.md) à la racine du repo. Email : `contact@alphaluppi.com` avec `[SECURITY] FAKT` en objet.

Engagement de réponse : **48h** pour acknowledger, **7 jours** pour proposer un fix ou un workaround, **disclosure coordonnée** sous 90 jours max.

## Audit indépendant

FAKT n'a pas (encore) été audité par un organisme tiers. Pour une demande d'audit ou de pen-test sur votre déploiement self-host : `contact@alphaluppi.com`.

## Pour aller plus loin

- [SECURITY.md](../../SECURITY.md) — politique de divulgation responsable
- [docs/architecture.md](../architecture.md) — architecture sécurité détaillée
- [self-hosting.md](self-hosting.md) — hardening déploiement mode 2
- [features.md](features.md) — toutes les fonctionnalités
