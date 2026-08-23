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

ARG GIT_SHA=unknown

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
ARG GIT_SHA
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./
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
