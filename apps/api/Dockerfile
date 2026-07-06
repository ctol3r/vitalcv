# apps/api/Dockerfile — Railway / Docker deploy
#
# NOTE: the CANONICAL API deploy on Railway is Nixpacks (root railway.toml +
# nixpacks.toml), which also runs `prisma migrate deploy` via preDeployCommand.
# This Dockerfile is a faithful alternative builder — keep its build + start
# in sync with railway.toml / nixpacks.toml.
#
# Aligned with root packageManager: pnpm@10.6.1. The API binds to $PORT at
# runtime (default 4000). Railway sets $PORT.

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
# turbo builds the workspace dependency dist/ via ^build (a bare
# `pnpm --filter @vitalcv/api build` would miss them).
RUN pnpm turbo run build --filter @vitalcv/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
# Drop root (ASVS 1.2.1). node:alpine ships a uid-1000 `node` user; the runtime
# only reads world-readable copied files and binds $PORT>1024, so no chown/setcap
# is needed. (The CANONICAL Railway builder is Nixpacks — see header note; its
# container-user hardening is tracked separately in docs/security/m3-security-status.md.)
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" || exit 1
# Canonical entrypoint: tsc emits with rootDir=monorepo, so server.js lives at
# dist/apps/api/backend/src/server.js, and register-workspace-paths.js maps the
# @vitalcv/* workspace imports at runtime. Migrations run via railway.toml
# preDeployCommand (Nixpacks path); SKIP_STARTUP_MIGRATION mirrors that.
CMD SKIP_STARTUP_MIGRATION=1 node -r ./apps/api/backend/register-workspace-paths.js apps/api/backend/dist/apps/api/backend/src/server.js
