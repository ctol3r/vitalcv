# Production Infrastructure — Architecture

> Describes the **actual** production infrastructure as verified via the Railway
> API/CLI and live endpoints on 2026-06-29. Not aspirational.

## Platform

**Railway** is the sole deployment platform. **GitHub** (`ctol3r/vitalcv`, branch
`main`) is the source of truth; Railway auto-deploys on push. **Docker** is the
canonical runtime for the web service; the app code is **Node — deployment-agnostic**
(no Railway/Vercel SDK lock-in; 0 `@vercel/*` packages).

## Railway project

| | |
|---|---|
| Project | `inspiring-reflection` (`706ceff8-23ac-404c-a45b-449de5920848`) |
| Workspace | VitalCV |
| Environment | `production` |
| Region | `us-west2` (single region) |

## Services (3)

```
                 Internet
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  vitalcv.com               api.vitalcv.com
  (vitalcv-web)            (delightful-essence)
  Next.js 15 / Node 22      Express / Node 20
  builder: Dockerfile       builder: Nixpacks
  health: /api/health       health: /health
        │                        │
        └──────────┬─────────────┘
                   ▼
              Postgres (managed)
              postgres-ssl:17, 1 replica
```

### `vitalcv-web` — web app (apex domain `vitalcv.com`)
- **Builder:** `DOCKERFILE` → `/apps/web/Dockerfile` (multi-stage: deps → build → runtime; `next start -H 0.0.0.0 -p $PORT`).
- **Runtime:** Next.js 15.2.8 App Router on Node 22 (alpine). `images.unoptimized: true` (no image optimizer / `sharp`).
- **Health:** `/api/health` (timeout 120s). Also probes the API's `/health`.
- **Auth:** Clerk (`middleware.ts`), production mode.
- **Data:** own Prisma client (`IssuerRequest`, `ReceiptCandidate`) → Postgres; reads the API over HTTP for everything else.
- **Scale:** 1 replica, `ON_FAILURE` restart (max 5).

### `delightful-essence` — API (`api.vitalcv.com`)
- **Builder:** `NIXPACKS` (root `railway.toml` + `nixpacks.toml`); build `pnpm install --frozen-lockfile && pnpm turbo build`.
- **Runtime:** Express server, Node 20; entrypoint `node -r register-workspace-paths.js dist/apps/api/backend/src/server.js`.
- **Health:** `/health` (unauthenticated; exposes request/latency metrics). `/api/*` is behind auth middleware.
- **Migrations:** `prisma migrate deploy` via `preDeployCommand`.
- **Scale:** 1 replica, `ON_FAILURE` restart (max 5).

### `Postgres` — managed database
- Railway-managed `ghcr.io/railwayapp-templates/postgres-ssl:17`, 1 replica, `ON_FAILURE` restart (max 10). Reached privately by both services via `DATABASE_URL`.

## Trust / signing surfaces
- Web issues ES256 receipts (`RECEIPT_KID` + `RECEIPT_PRIVATE_KEY_JWK`).
- API holds `VCV_PRIVATE_KEY` / `VCV_PUBLIC_KEY`, `JWT_SECRET`, `API_KEYS`.
- `/.well-known/*` (jwks, did, openid, trust-register) served by the web app via `next.config.mjs` rewrites → `/api/.well-known/*`.

## Not on Railway
- `apps/api/Dockerfile` exists but is **not** the production build path (API uses Nixpacks); kept as a maintained alternative.
- `apps/marketing` has no Railway target (its `vercel.json` was removed) — see `technical-debt` in the scorecard.
