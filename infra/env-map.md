# Environment Variables Map

This document describes which environment variables belong to which app/service in the VitalCV monorepo.

## Apps

### @vitalcv/api (Backend API)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 4000 inside the container; Railway injects its own port at runtime)
- `LOG_LEVEL` - Logging level
- Health endpoint: `/api/audit/health`

### @vitalcv/web (Frontend Next.js)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - **Required.** Clerk auth public key.
- `CLERK_SECRET_KEY` - **Required.** Clerk auth secret.
- `RECEIPT_KID` - **Required in production** (`NODE_ENV=production`). ES256 keypair `kid`.
- `RECEIPT_PRIVATE_KEY_JWK` - **Required in production**. ES256 private JWK, JSON-encoded.
  Generate ONCE with `node scripts/generate-receipt-keypair.mjs`. Without these two,
  `/.well-known/jwks.json`, `did.json`, `trust-register`, `/trust`, and `/trust/doctrine` return 500.
- `NEXT_PUBLIC_API_BASE` - **Required on Railway.** Build-time only. Set to `https://api.vitalcv.com`. The Dockerfile bakes this default in for Docker builds, but Railway's Nixpacks builder does NOT inherit Dockerfile ARGs, so this must be set explicitly in the Railway Variables tab. Without it, the server-side proxy routes + 3 client components fall through to `http://localhost:4000`.
- `NEXT_PUBLIC_APP_URL` - Optional. Canonical app URL (e.g. `https://vitalcv.com`).
- `NODE_ENV` - Environment (set to `production` in deploys).
- `PORT` - Server port (default: 3000 inside the container; Railway injects its own port at runtime).
- `NEXT_PUBLIC_SENTRY_DSN` - Optional. Sentry build-time + runtime instrumentation skipped entirely when unset.
- Health endpoint: `/api/health`

## Shared Services

### Blockchain/Substrate
- `SUBSTRATE_WS_URL` - Substrate WebSocket URL
- `SUBSTRATE_MNEMONIC` - Substrate account mnemonic

### Compliance
- `NCQA_API_KEY` - NCQA API key (if applicable)
- `TJC_API_KEY` - TJC API key (if applicable)

## Notes

- All `.env` files should be in their respective app directories
- Use `.env.example` files as templates
- Never commit actual `.env` files to git

