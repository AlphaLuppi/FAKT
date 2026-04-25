# Self-hosting FAKT — Mode 2 entreprise

**Audience :** Dev intégrateur · Sysadmin agence
**Résumé :** Déployer FAKT sur votre propre serveur pour 5-50 utilisateurs internes.
**Dernière mise à jour :** 2026-04-25

---

## À qui ça s'adresse

Vous êtes une agence ou une équipe qui veut héberger FAKT pour vos collaborateurs internes :

- 5 à 50 utilisateurs typiquement
- 1 entité légale (un SIRET) à terme — multi-workspace prévu en évolution
- Données souveraines sur votre infra
- Contrôle total de la base PostgreSQL

> **Statut v0.2 :** mode self-host en cours d'implémentation. Cette page documente la cible architecturale. Pour le statut courant et le plan détaillé, voir l'[ADR self-host](../../_bmad-output/) ou contactez `contact@alphaluppi.com`.

## Architecture cible

```
              ┌──────────────────────────────────────┐
              │  Desktop Tauri (5 users, 3 OS)       │
              │  FAKT_DEFAULT_BACKEND_URL bakée      │
              └──────────────────┬───────────────────┘
                                 │ HTTPS
                                 ▼
              ┌──────────────────────────────────────┐
              │  Caddy (TLS auto Let's Encrypt)      │
              │  fakt.votre-agence.fr                │
              ├────────────────────┬─────────────────┤
              │  /api/*            │  /              │
              │       │            │     │           │
              │       ▼            │     ▼           │
              │  api-server (Bun)  │  Web frontend   │
              │  Hono + Postgres   │  (static React) │
              ├────────────────────┴─────────────────┤
              │  Postgres 16 (volume Docker)         │
              │  Volume signed_pdfs (PAdES PDFs)     │
              └──────────────────────────────────────┘
```

**Composants :**
- **Caddy** — reverse proxy + TLS Let's Encrypt automatique
- **api-server** — image Docker Bun (~150 MB), même code que mode 1
- **Postgres 16** — base de données partagée
- **Web frontend** — bundle React desktop reuse à 100% en mode web (image nginx alpine)
- **Volumes** — `pg_data`, `signed_pdfs`, `caddy_data`, `backups`

## Hosting recommandé

Deux options validées :

### Option A — Dokploy AlphaLuppi

Si vous êtes dans l'écosystème AlphaLuppi (ou utilisez Dokploy en interne), c'est le plus simple :

1. Push de l'image Docker vers GHCR via le workflow CI
2. Configuration Dokploy avec le `docker-compose.yml` du repo
3. DNS A pointant vers Dokploy
4. Caddy géré par Dokploy

### Option B — VPS direct (Hetzner / OVH / etc.)

VPS Linux avec Docker Compose. Coût ~5-15€/mois pour 5 users.

```bash
# Sur le VPS
git clone https://github.com/AlphaLuppi/FAKT.git
cd FAKT/deploy
cp .env.example .env
# Éditer .env (DATABASE_URL, FAKT_JWT_SECRET, FAKT_API_EXTRA_ORIGINS, domaine)
docker compose up -d
```

**Non recommandé :** Vercel / Railway / Fly.io — moins de contrôle sur la BDD et coût récurrent.

## Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `AUTH_MODE` | ✓ | `jwt` (au lieu de `local` mode 1) |
| `DATABASE_URL` | ✓ | `postgres://fakt:secret@db:5432/fakt` |
| `FAKT_JWT_SECRET` | ✓ | Min 32 chars cryptographiquement aléatoire (`openssl rand -base64 48`) |
| `BIND` | ✓ | `0.0.0.0` (au lieu de 127.0.0.1) |
| `FAKT_API_PORT` | | Port interne container (default 3001) |
| `FAKT_API_EXTRA_ORIGINS` | ✓ | `https://fakt.votre-agence.fr` (CORS pour le web) |
| `FAKT_SIGNED_PDFS_DIR` | | `/var/lib/fakt/signed` (volume mount) |
| `FAKT_ADMIN_TOKEN` | (one-shot) | Token admin pour migration data, à supprimer après |
| `LOG_LEVEL` | | `info` par défaut |

## Configuration Caddy

Caddyfile minimum (le `Caddyfile.alphaluppi` du repo est un bon point de départ) :

```caddy
fakt.votre-agence.fr {
  encode gzip zstd
  
  handle /api/* {
    reverse_proxy api-server:3001
  }
  handle /health {
    reverse_proxy api-server:3001
  }
  handle {
    reverse_proxy web-frontend:80
  }
}
```

TLS auto Let's Encrypt (zero config si DNS pointe correctement).

## Provisionner les utilisateurs

L'admin (vous) crée les users via le script `scripts/seed-users.ts` :

```bash
FAKT_SEED_USERS='[
  {"email":"alice@agence.fr","fullName":"Alice Martin","role":"owner"},
  {"email":"bob@agence.fr","fullName":"Bob Dupont","role":"member"}
]' \
DATABASE_URL=postgres://... \
bun run scripts/seed-users.ts --workspace <ws-id>
```

Le script génère un password aléatoire 16 chars par user (hash bcrypt cost=12) et imprime les credentials en stdout. Transmettez-les via Signal / 1Password / autre canal sécurisé.

> **MVP fermé** — pas de self-signup. L'admin crée les comptes manuellement. Évolution v0.3 SaaS : signup + Google OAuth.

## Distribution app desktop pré-configurée

Pour vos collaborateurs, vous fournissez une **app desktop pré-bakée** qui pointe directement sur votre backend :

1. Workflow GitHub Actions `release-alphaluppi.yml` (à adapter à votre nom)
2. Build Tauri avec env compile-time `FAKT_DEFAULT_BACKEND_URL=https://fakt.votre-agence.fr` + `FAKT_DEFAULT_AUTH_MODE=remote`
3. Vos collaborateurs téléchargent → installent → login → c'est fini

Pas besoin pour eux de configurer manuellement l'URL.

## Migration depuis mode 1 solo

Si vous aviez déjà un FAKT solo en mode 1 avec des données :

```bash
# Sur votre poste (avec FAKT solo installé)
bun run scripts/migrate-sqlite-to-postgres.ts \
  --sqlite ~/.fakt/db.sqlite \
  --pg postgres://fakt:secret@fakt.votre-agence.fr:5432/fakt \
  --owner-email votre@email.fr \
  --dry-run

# Vérifier les counts, puis run réel (sans --dry-run)
# Puis upload des PDFs signés
scp -r ~/.fakt/signed/* user@vps:/var/lib/fakt/signed/
```

Le script est **one-shot** (pas idempotent) : il DROP + CREATE le schéma cible.

## Backups

Le `docker-compose.yml` inclut un container cron qui fait un `pg_dump` quotidien dans le volume `backups`, rétention 30 jours. Restaure :

```bash
docker compose exec postgres psql -U fakt -d fakt < /backups/fakt-2026-04-25.sql
```

Pour les PDFs signés : volume `signed_pdfs` à backuper séparément (rsync hors-Docker).

## Sécurité

- TLS Let's Encrypt obligatoire (Caddy)
- JWT secret >= 32 chars aléatoires
- Cookie httpOnly + Secure + SameSite=Strict
- Rate limit Caddy sur `/api/auth/login` (à activer)
- Backup chiffré côté serveur (à votre charge)
- Logs Postgres + api-server à monitorer

Détails compliance : [security-compliance.md](security-compliance.md).

## Limitations actuelles

- **Signature** reste poste desktop (la clé privée RSA reste dans le keychain OS du user). Le serveur ne signe pas — il stocke seulement le PDF déjà signé + l'audit trail.
- **Web UI** : tout sauf signature (bouton désactivé avec tooltip "Signature disponible sur l'app desktop")
- **1 workspace** par déploiement en MVP — multi-workspace future-proof DB-side mais UI à activer en v0.3+

## Pour aller plus loin

- [features.md](features.md) — toutes les fonctionnalités
- [security-compliance.md](security-compliance.md) — compliance RGPD / eIDAS / CGI
- [docs/architecture.md](../architecture.md) — architecture détaillée
- [contact](mailto:contact@alphaluppi.com) — pour discuter d'un déploiement
