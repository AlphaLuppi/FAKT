#!/bin/sh
# Backup quotidien Postgres FAKT — rétention 30 jours
# Lancé en boucle par le service `backup` du docker-compose

set -e

DATE=$(date +%Y-%m-%d)
BACKUP_FILE="/backups/fakt-${DATE}.sql.gz"

echo "[$(date -Iseconds)] starting backup → $BACKUP_FILE"

pg_dump \
  --host="$POSTGRES_HOST" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

echo "[$(date -Iseconds)] backup OK ($(du -h "$BACKUP_FILE" | cut -f1))"

# Rétention 30 jours
find /backups -name "fakt-*.sql.gz" -mtime +30 -delete
echo "[$(date -Iseconds)] retention pruned (>30 days deleted)"
