# apps/api/Dockerfile — Wave 128
FROM node:22-alpine AS base
WORKDIR /app
RUN npm i -g pnpm@9

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
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/api/audit/health || exit 1
CMD ["node", "apps/api/backend/dist/server.js"]
