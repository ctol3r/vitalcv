FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8 --activate

FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package files
COPY packages/*/package.json ./packages/*/
COPY apps/api/package.json ./apps/api/
COPY apps/api/api/package.json ./apps/api/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Build packages first
RUN pnpm turbo run build --filter='./packages/*'

# Build API
RUN pnpm turbo run build --filter='@vitalcv/api'

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/apps/api/api/dist ./dist
COPY --from=builder /app/apps/api/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "dist/server.js"]

