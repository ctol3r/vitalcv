# =============================================================================
# VitalCV AuthZ Service Dockerfile
# =============================================================================
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ openssl
RUN npm install -g pnpm@10.6.1
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/authz/package.json apps/authz/
COPY apps/api/backend/package.json apps/api/backend/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile

COPY apps/authz/ apps/authz/
COPY tsconfig.base.json ./

RUN pnpm --filter @vitalcv/authz build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl dumb-init
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vitalcv
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=vitalcv:nodejs /app/apps/authz/dist ./dist
COPY --from=builder --chown=vitalcv:nodejs /app/node_modules ./node_modules

USER vitalcv

EXPOSE 4003

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4003/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["dumb-init", "node", "dist/index.js"]
