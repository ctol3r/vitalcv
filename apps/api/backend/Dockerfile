# =============================================================================
# VitalCV Backend API - Production Dockerfile
# Location: /apps/api/backend/Dockerfile
# Build context: /apps/api/backend (or use -f flag from repo root)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# - Installs dependencies and compiles TypeScript to JavaScript
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies (needed for native modules like bcrypt, prisma)
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy Prisma schema for generation
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Prune devDependencies for production
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# - Minimal image with only production artifacts
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# Install runtime dependencies (openssl for Prisma)
RUN apk add --no-cache openssl dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vitalcv

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy production node_modules from builder
COPY --from=builder --chown=vitalcv:nodejs /app/node_modules ./node_modules

# Copy compiled JavaScript output
COPY --from=builder --chown=vitalcv:nodejs /app/dist ./dist

# Copy Prisma client and schema (required at runtime)
COPY --from=builder --chown=vitalcv:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=vitalcv:nodejs /app/prisma ./prisma

# Copy package.json for potential runtime needs (version info, etc.)
COPY --from=builder --chown=vitalcv:nodejs /app/package.json ./

# Switch to non-root user
USER vitalcv

# Expose API port (change 4000 to your actual port if different)
# Override at runtime with -p flag or PORT env var
EXPOSE 4000

# Health check (adjust endpoint as needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Use dumb-init to handle PID 1 properly (signal handling)
# Entrypoint: dist/server.js (as defined in package.json "main")
CMD ["dumb-init", "node", "dist/server.js"]
