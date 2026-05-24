# apps/web/Dockerfile — Wave 128
FROM node:22-alpine AS base
WORKDIR /app
RUN npm i -g pnpm@10.6.1

FROM base AS deps
# Copy ALL workspace manifests + lockfile so pnpm can resolve the full graph,
# then install everything (including root devDeps like turbo). Filter-install
# isn't enough because we need turbo + tsc to build workspace package dist/.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY blockchain ./blockchain
COPY core ./core
RUN pnpm install --frozen-lockfile

FROM deps AS build
# deps stage already has full source + node_modules + generated prisma client.
# Just run turbo build for @vitalcv/web; turbo resolves ^build for all workspace deps.
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are baked into the client bundle at build time
ARG NEXT_PUBLIC_API_BASE=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
RUN pnpm turbo run build --filter @vitalcv/web

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/apps/web/lib/generated ./apps/web/lib/generated
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD pnpm exec next start -p ${PORT:-3000}
