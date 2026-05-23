# apps/api/Dockerfile — Railway / Docker deploy
#
# Aligned with root packageManager: pnpm@10.6.1. The API binds to
# $PORT at runtime (default 4000 inside the container). Railway
# sets $PORT; Docker run maps host:container as usual.

FROM node:22-alpine AS base
WORKDIR /app
RUN npm i -g pnpm@10.6.1

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/backend/package.json apps/api/backend/
RUN pnpm install --frozen-lockfile --filter @vitalcv/api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @vitalcv/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/audit/health" || exit 1
CMD ["node", "apps/api/backend/dist/server.js"]
