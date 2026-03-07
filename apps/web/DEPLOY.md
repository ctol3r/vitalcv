# Deploying VitalCV Web

## Vercel (recommended)

1. Import repo → set **Root Directory** to `apps/web`
2. Framework preset: **Next.js**
3. Build command: `cd ../.. && pnpm turbo build --filter=web`
4. Output directory: `apps/web/.next`
5. Set environment variables (see table below)
6. Deploy

## Docker

```bash
# Build with custom API base
docker build \
  --build-arg NEXT_PUBLIC_API_BASE=https://api.vitalcv.com \
  -f apps/web/Dockerfile \
  -t vitalcv-web .

# Run
docker run -p 3000:3000 vitalcv-web
```

## docker-compose (local dev)

```bash
docker-compose up        # full stack (db + api + web)
docker-compose up -d db  # just database
```

## Environment Variables

| Variable | Required | Build-time | Description |
|----------|----------|------------|-------------|
| `NEXT_PUBLIC_API_BASE` | Yes | Yes | Backend API URL |
| `NEXT_PUBLIC_BACKEND_URL` | No | Yes | Fallback for API base |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Prod | Yes | Clerk auth public key |
| `CLERK_SECRET_KEY` | Prod | No | Clerk auth secret |
| `NEXT_PUBLIC_ENTERPRISE_MODE` | No | Yes | Show enterprise features |
| `NEXT_PUBLIC_DEMO_MODE` | No | Yes | Enable demo path routing |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Yes | Sentry error tracking |

> **Note:** `NEXT_PUBLIC_*` variables are embedded at **build time**. Changing them requires a rebuild.

## Health Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/health` | Liveness probe | `{ status, service, timestamp, config }` |
| `GET /api/readyz` | Readiness probe | `{ status, service }` |
