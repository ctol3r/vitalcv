# =============================================================================
# VitalCV Backend API - Production Dockerfile
# Build context: repo root (docker build -f apps/api/backend/Dockerfile .)
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl
RUN npm install -g pnpm@10.6.1

WORKDIR /app

# Copy workspace config first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/backend/package.json apps/api/backend/
COPY apps/api/package.json apps/api/
COPY packages/ packages/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source
COPY apps/api/backend/ apps/api/backend/
COPY tsconfig.base.json ./

# Generate Prisma client
RUN cd apps/api/backend && pnpm exec prisma generate

# Build
RUN pnpm --filter @vitalcv/api build

# Stage 2: Production Runtime
FROM node:20-alpine AS runtime

RUN apk add --no-cache openssl dumb-init
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vitalcv

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder --chown=vitalcv:nodejs /app/apps/api/backend/dist ./dist
COPY --from=builder --chown=vitalcv:nodejs /app/apps/api/backend/prisma ./prisma
COPY --from=builder --chown=vitalcv:nodejs /app/apps/api/backend/node_modules ./node_modules
COPY --from=builder --chown=vitalcv:nodejs /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=vitalcv:nodejs /app/apps/api/backend/package.json ./

USER vitalcv

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Run migrations before starting (--skip-generate since client is already built)
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy --schema ./prisma/schema.prisma && node dist/apps/api/backend/src/server.js"]
