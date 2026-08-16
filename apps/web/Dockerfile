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
# NEXT_PUBLIC_* vars are baked into the client bundle at build time, and
# Railway passes a service variable into a Docker build ONLY when a matching
# ARG is declared here. The 18c9311 incident: only API_BASE was declared, so
# the whole client bundle + every prerender compiled with Clerk DISABLED while
# runtime SSR had the key. Every client-baked variable must be listed.
ARG NEXT_PUBLIC_API_BASE=https://api.vitalcv.com
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=""
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=""
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=""
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=""
ARG NEXT_PUBLIC_BACKEND_URL=""
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
# Fail-closed switch: set VITALCV_REQUIRE_AUTH_ENV=1 on the Railway service so
# a build missing the Clerk key ABORTS instead of shipping auth-dead output.
ARG VITALCV_REQUIRE_AUTH_ENV=""
# docker-build.sh unsets empty ARGs (so '' never shadows code fallbacks),
# enforces the fail-closed guard, then runs the turbo build.
RUN sh apps/web/scripts/docker-build.sh

FROM base AS runtime
ENV NODE_ENV=production
# Build-time commit provenance fallback. On Railway, RAILWAY_GIT_COMMIT_SHA is
# injected at RUNTIME and takes precedence (see lib/deployInfo.ts) — this ARG
# only backs a plain `docker build --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD)`
# so /api/version still reports a real SHA off-Railway. Uses a distinct var name
# (GIT_SHA, not RAILWAY_GIT_COMMIT_SHA) so an empty build-arg can never shadow
# Railway's runtime injection.
ARG GIT_COMMIT_SHA=""
ENV GIT_SHA=${GIT_COMMIT_SHA}
# .next is chowned to node: `next start` writes ISR/image-cache under .next/cache
# at runtime, so it must be writable by the non-root user (ASVS 1.2.1).
COPY --from=build --chown=node:node /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/
# next.config.mjs is a RUNTIME read, not only a build input.
#
# `headers()`, `redirects()` and `rewrites()` are resolved during `next build`
# and baked into .next/routes-manifest.json, so they kept working without this
# file and hid its absence completely — the security headers and the /api
# no-store rules all ship from the manifest. Server OPTIONS are different:
# `next start` reads them from the config at boot, and with no config file it
# falls back to DEFAULTS. `poweredByHeader` defaults to true, which is why
# production kept sending `x-powered-by: Next.js` after #1048 set it to false:
# merged, deployed, SHA-confirmed — and inert, because the setting never
# reached the running server.
COPY --from=build /app/apps/web/next.config.mjs ./apps/web/
# next.config.mjs is not self-contained — it does
#   import { getSecurityHeadersForNext } from './security-headers.mjs';
# so shipping the config WITHOUT its import made `next start` die at boot with
#   Cannot find module '/app/apps/web/security-headers.mjs'
# The container then never answered /api/health, the healthcheck burned its full
# two-minute retry window, and the deploy was marked FAILED. Every web deploy
# after that failed identically, so production silently froze on the last image
# that still booted while `main` kept moving — six commits, none of them live.
#
# The build stage never caught it: `next build` runs with the repo checked out,
# where the sibling file is present. Only the runtime image is missing it, so
# this is invisible to CI and visible only as a healthcheck timeout.
#
# If next.config.mjs grows another local import, it must be copied here too.
COPY --from=build /app/apps/web/security-headers.mjs ./apps/web/
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
# Drop root (ASVS 1.2.1). pnpm is installed globally in `base`, so the node user
# resolves it on PATH; only .next (chowned above) is written at runtime.
# (Canonical Railway builder is Nixpacks — see docs/security/m3-security-status.md.)
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
CMD ["pnpm", "start"]
