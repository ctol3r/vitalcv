# apps/web/Dockerfile — Railway / Docker deploy
#
# Aligned with root packageManager: pnpm@10.6.1. CMD invokes
# `pnpm start`, which honors $PORT (default 3000 inside the
# container). Railway sets $PORT at runtime; Docker `docker run`
# maps host:container ports as usual.
#
# Default NEXT_PUBLIC_API_BASE points at the production API host
# (https://api.vitalcv.com) so a build without --build-arg never
# leaks a localhost fallback into the client bundle.

FROM node:22-alpine AS base
WORKDIR /app
RUN npm i -g pnpm@10.6.1

FROM base AS deps
# Copy the FULL workspace manifest + source set so pnpm can resolve the
# COMPLETE workspace graph — inter-package symlinks (e.g. crs -> psv) plus
# every selected package's node_modules. A web-only manifest leaves the
# transitively-built workspace packages that `turbo run build` compiles
# with no links (TS2307) and no build tooling. `--filter @vitalcv/web...`
# still scopes the install to web's dependency closure, not all apps.
# --ignore-scripts skips postinstalls (prisma generate) here; the web
# `build` script (`prisma generate && next build`) runs it in the build stage.
COPY . .
RUN pnpm install --frozen-lockfile --filter @vitalcv/web... --ignore-scripts

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# Default to the production API host so a build without an explicit
# --build-arg does NOT bake a localhost URL into the prod bundle.
ARG NEXT_PUBLIC_API_BASE=https://api.vitalcv.com
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
RUN pnpm turbo run build --filter @vitalcv/web

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/apps/web/prisma ./apps/web/prisma
COPY --from=build /app/apps/web/lib/generated ./apps/web/lib/generated
# pnpm workspaces: copy BOTH the root + per-workspace node_modules
# so `next` binary resolves via apps/web/node_modules/.bin.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
# Workspace package.json files referenced by hoisted symlinks.
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
CMD ["pnpm", "start"]
