# Déploiement FAKT — Mode 2 self-host

**Audience :** Sysadmin agence, dev intégrateur.
**Résumé :** Deux paths validés (Dokploy ou VPS direct). Postgres + Bun api-server + Caddy + bundle web. Build local depuis le repo, pas de registry intermédiaire.

---

## Pré-requis

- VPS Linux (4 vCPU, 4 GB RAM minimum) OU instance Dokploy
- Domaine pointant vers le serveur (DNS A `fakt.votre-agence.fr` → IP)
- Docker + Docker Compose installés (déjà présents sur Dokploy)
- Ports 80 et 443 ouverts (HTTP/HTTPS pour Let's Encrypt)

## Path Dokploy (recommandé pour AlphaLuppi)

Dokploy clone le repo et build les images depuis les Dockerfiles via `build:` dans le compose. **Aucun push de registry intermédiaire**.

### Setup en 4 minutes

1. Dans Dokploy, créer un **nouveau projet** type **Compose** pointant sur le repo GitHub `AlphaLuppi/FAKT`.
2. Indiquer le chemin du compose : `deploy/docker-compose.yml`.
3. Set les **environment variables** dans l'UI Dokploy :
   - `FAKT_DOMAIN=fakt.alphaluppi.fr`
   - `POSTGRES_PASSWORD=<strong random>`
   - `FAKT_JWT_SECRET=<openssl rand -base64 48>`
   - `LOG_LEVEL=info`
4. **Deploy**. Dokploy build localement les images `api-server` et `web-frontend` depuis les Dockerfile, puis fait tourner le compose.

Caddy obtient automatiquement un cert Let's Encrypt (TLS prêt en ~30 secondes après que le DNS soit résolu).

Vérifier : `curl https://fakt.alphaluppi.fr/health` → `{"status":"ok"}`.

### Mise à jour

À chaque push sur `main`, Dokploy peut être configuré pour **redeploy automatiquement** (webhook ou polling). Pas besoin de tag de version — le build se fait à chaque deploy.

## Path VPS direct (Hetzner / OVH / autre)

```bash
# Sur le VPS Ubuntu 22.04+
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Logout/login pour que le groupe docker prenne effet

git clone https://github.com/AlphaLuppi/FAKT.git
cd FAKT/deploy
cp .env.example .env
nano .env  # remplir FAKT_DOMAIN, POSTGRES_PASSWORD, FAKT_JWT_SECRET

# --build : Docker build localement les images depuis les Dockerfile
docker compose --env-file .env up -d --build

docker compose logs -f  # vérifier que tout démarre OK
```

### Mise à jour VPS direct

```bash
cd ~/FAKT
git pull
cd deploy
docker compose --env-file .env up -d --build
```

## Fichiers livrés

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Orchestration des 5 services. `build:` pointe sur les Dockerfile du repo (pas de registry). |
| `Caddyfile.alphaluppi` | Reverse proxy + TLS auto + headers sécurité |
| `.env.example` | Template variables d'environnement |
| `backup.sh` | Script `pg_dump` quotidien rétention 30j |
| `../packages/api-server/Dockerfile` | Build api-server multi-stage (Bun compile + Typst CLI) |
| `../apps/desktop/Dockerfile.web` | Build bundle web nginx (à créer en sprint 3) |

## Backups

Les backups Postgres sont dans le volume `backups` du compose. Pour les récupérer :

```bash
docker compose exec backup ls /backups
docker cp <container_id>:/backups/fakt-2026-04-25.sql.gz ./
```

Pour restaurer :

```bash
zcat fakt-2026-04-25.sql.gz | docker compose exec -T postgres psql -U fakt -d fakt
```

⚠️ Les PDFs signés sont dans le volume `signed_pdfs` séparé — backup à faire séparément (rsync hors-Docker, ou snapshot Dokploy).

## Logs

```bash
docker compose logs -f api-server  # logs api-server (JSON structuré)
docker compose logs -f caddy       # logs HTTP requests
docker compose logs -f postgres    # logs DB
```

Sur Dokploy : UI dédiée par service.

## Sécurité — checklist avant prod

- [ ] `POSTGRES_PASSWORD` jamais le default
- [ ] `FAKT_JWT_SECRET` >= 32 chars random (`openssl rand -base64 48`)
- [ ] Pare-feu : ouvrir 80 + 443 uniquement (pas 5432, pas 3001)
- [ ] DNS A valide pointant sur le serveur (Caddy a besoin pour TLS)
- [ ] Backups testés (au moins une restauration)
- [ ] Logs surveillés (Sentry / Loki / Dokploy)
- [ ] `FAKT_ADMIN_TOKEN` désactivé hors migration (sinon endpoint admin exposé)

## Support

- Issues : [github.com/AlphaLuppi/FAKT/issues](https://github.com/AlphaLuppi/FAKT/issues)
- Documentation détaillée : [docs/readme/self-hosting.md](../docs/readme/self-hosting.md)
- Email : `contact@alphaluppi.com`
