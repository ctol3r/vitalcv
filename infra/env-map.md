# Environment Variables Map

This document describes which environment variables belong to which app/service in the VitalCV monorepo.

## Apps

### @vitalcv/api (Backend API)

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 4000)
- `LOG_LEVEL` - Logging level

### @vitalcv/web (Frontend Next.js)

- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL
- `NEXT_PUBLIC_API_BASE` - Optional override for backend API base URL
- `NODE_ENV` - Environment
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN (optional)

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
