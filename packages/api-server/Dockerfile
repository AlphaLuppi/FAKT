# syntax=docker/dockerfile:1.7

# ============================================================================
# FAKT api-server — Dockerfile multi-stage
# ============================================================================
#
# Build : depuis la RACINE du repo (pas depuis packages/api-server/) :
#   docker build -f packages/api-server/Dockerfile -t fakt-api .
#
# L'image finale embarque :
#   - Le binaire bundlé Bun (api-server compile standalone)
#   - Typst CLI (pour le rendu PDF côté serveur en mode web)
#   - Les certs CA Let's Encrypt (HTTPS sortant TSA, etc.)
#
# Cible : ~150-200 MB. Taille à optimiser future.
# ============================================================================

# ---- Stage 1 : Builder ----
FROM oven/bun:1.3.2-alpine AS builder

WORKDIR /app

# Copy workspace manifests pour caching
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/desktop/package.json ./apps/desktop/
COPY landing/package.json ./landing/

# Install workspace deps (cached if package.json unchanged)
RUN bun install --frozen-lockfile

# Build api-server en standalone Bun binary
WORKDIR /app/packages/api-server
RUN bun build --compile --target=bun-linux-x64 src/index.ts --outfile fakt-api

# ---- Stage 2 : Runtime ----
FROM debian:bookworm-slim AS runtime

# Typst CLI pour le rendu PDF côté serveur (mode web)
# Version pinned — bumper avec le repo principal périodiquement
ARG TYPST_VERSION=0.13.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       libssl3 \
  && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
     | tar -xJ -C /tmp \
  && mv /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst \
  && rm -rf /tmp/typst-x86_64-unknown-linux-musl \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# User non-root pour éviter container running as root
RUN groupadd -r fakt && useradd -r -g fakt -m -d /home/fakt fakt

WORKDIR /app
COPY --from=builder /app/packages/api-server/fakt-api /app/fakt-api
RUN chmod +x /app/fakt-api

# Templates Typst (pour render PDF côté serveur en mode web)
COPY --from=builder /app/packages/pdf/templates /app/templates

# Volume pour les PDFs signés
RUN mkdir -p /var/lib/fakt/signed && chown -R fakt:fakt /var/lib/fakt

USER fakt

# Healthcheck Caddy / Dokploy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:${FAKT_API_PORT:-3001}/health || exit 1

# Default env (overridé par docker-compose / Dokploy)
ENV BIND=0.0.0.0
ENV FAKT_API_PORT=3001
ENV AUTH_MODE=jwt
ENV LOG_LEVEL=info
ENV FAKT_SIGNED_PDFS_DIR=/var/lib/fakt/signed
ENV FAKT_PDF_TEMPLATES_DIR=/app/templates

EXPOSE 3001

ENTRYPOINT ["/app/fakt-api"]
