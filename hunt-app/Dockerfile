# HUNT Contract Acquisition OS
#
# Multi-stage build modelled on AEOS's Dockerfile (see
# g:\...\Code\AEOS\Dockerfile) — GIT_SHA build arg for the version label,
# non-root runtime user, healthcheck. Fixes the one bug in legacy HUNT's
# Dockerfile (archive/legacy-hunt/Dockerfile): its builder stage ran
# `npm ci --only=production`, which never installs TypeScript, so
# `npm run build` failed in that image. This build stage installs full
# dependencies (including devDependencies) and only the production stage
# below prunes them.
#
# Build context is the REPO ROOT (Contract ops/), not hunt-app/ — see
# docker-compose.yml's `context: ..`. docs-pack lives one level above
# hunt-app and is a sibling Docker cannot COPY from outside the build
# context, so the context has to include both. Every COPY path below is
# relative to that repo root.

ARG GIT_SHA=unknown

FROM node:20-alpine AS builder
WORKDIR /app

# node:20-alpine ships no OpenSSL at all — not the CLI, not libssl.so —
# so Prisma's own version-probe finds nothing to detect and hard-codes a
# guess of "openssl-1.1.x" regardless of the binaryTargets set in
# schema.prisma, which then fails to load at runtime since Alpine 3.19+
# only has OpenSSL 3.x. Installing it fixes both the probe and the actual
# runtime linking.
RUN apk add --no-cache openssl

COPY hunt-app/package*.json ./
RUN npm ci

COPY hunt-app/tsconfig.json ./
COPY hunt-app/prisma ./prisma
COPY hunt-app/src ./src

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
ARG GIT_SHA
WORKDIR /app

RUN apk add --no-cache openssl
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY hunt-app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# The prompt-loader reads docs-pack/prompts/*.md at runtime by relative
# path from dist/ (see src/modules/ai/prompt-loader.ts) — the docs pack
# must ship inside the image alongside the app, one level up.
COPY docs-pack /docs-pack

LABEL org.opencontainers.image.revision=$GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
