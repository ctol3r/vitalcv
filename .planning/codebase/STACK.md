# Technology Stack

**Analysis Date:** 2026-05-18

## Languages

**Primary:**
- TypeScript 5.9.3 (strict mode) — all application code across `apps/*` and `packages/*` (see root `package.json`, `apps/web/tsconfig.json`, `apps/api/backend/tsconfig.json`)

**Secondary:**
- JavaScript (CommonJS) — backend build output and shell-adjacent runtime files
- ES Module JavaScript — Next.js config (`apps/web/next.config.mjs`)
- Solidity (`solc@0.8.20`) — smart contracts (`apps/api/package.json`, `blockchain/contracts/*`)

## Runtime

**Environment:**
- Node.js — runtime version validated by `scripts/runtime/assert-canonical-runtime.ts` before app startup
- Next.js 15.2.8 (App Router) — `apps/web/package.json`, `apps/marketing/package.json`
- React 19 — `apps/web/package.json`; the root `package.json` defines a `pnpm.overrides` block that pins `@types/react` across the monorepo to resolve Radix UI compatibility
- Canonical web dev port: **3030** — pinned by the runtime guard in the `dev` script in `apps/web/package.json`

**Package Manager:**
- `pnpm@10.6.1` — pinned in the root `package.json` `packageManager` field
- Lockfile: `pnpm-lock.yaml` (committed)
- Workspace declaration: `pnpm-workspace.yaml` covering `apps/*`, `apps/api/*`, `packages/*`, `services/*`, `blockchain/*`
- Type hoisting: `.npmrc` carries `public-hoist-pattern[]=@types/*` so `@types/node` reaches every package

## Frameworks

**Core:**
- **Next.js 15.2.8** (App Router) — primary web framework (`apps/web`), marketing site (`apps/marketing`)
- **React 19** + Radix UI primitives + `@blueprintjs/core@6.10.0` + Tailwind CSS 4.1.9 — `apps/web/package.json`
- **Express.js 4.19.2** — backend HTTP framework (`apps/api/backend/package.json`)
- **Apollo Server 3.13.0** + `apollo-server-express@3.12.2` — GraphQL surface inside the backend (`apps/api/backend/package.json`)

**Testing:**
- **Vitest 4.0.18** — web unit / integration tests (`apps/web/vitest.config.ts`)
- **Jest 29** — backend unit tests (`apps/api/backend` per CLAUDE.md)
- **Playwright 1.58.2** — web end-to-end tests (`apps/web/package.json`)

**Build / Dev:**
- **Turbo 2.9.6** — monorepo task runner (`turbo.json`)
- **Prisma 6.19.2** — schema + client generator (`apps/api/backend/prisma/schema.prisma`)
- **TypeScript 5.9.3** compiler — direct `tsc` for backend, Next.js compiler for web
- **`scripts/prisma-generate-locked.sh`** — locked Prisma client generation invoked by CI

## Key Dependencies

**Critical (auth, identity, money, signatures):**
- `@clerk/nextjs@6.37.3` — web auth (`apps/web/package.json`)
- `@prisma/client@6.19.2` + `prisma@6.19.2` — primary persistence layer
- `stripe@20.4.0` — billing for verified-hire transactions (`apps/api/backend/src/services/billing/stripeClient.ts`)
- `jose@4.x` (backend) + `jose@6.2.3` (web) + `jsonwebtoken@9.0.2` (backend) — JWS / VC signing (`apps/api/backend/package.json`, `apps/web/package.json`)
- `@simplewebauthn/browser@13.2.2` + `@simplewebauthn/server@9.0.0` — passkey / WebAuthn support

**Identity / decentralized credentials:**
- `did-resolver@4.1.0`, `ethr-did-resolver@11.0.4`, `key-did-resolver@4.0.0`, `web-did-resolver@2.0.30` — W3C DID resolution (`apps/api/backend/package.json`)
- `ethers@6.15.0`, `@openzeppelin/contracts@5.3.0`, `hardhat@2.25.0` — Ethereum integration (`apps/api/backend/package.json`, `apps/api/package.json`)
- `@polkadot/api@16.4.6`, `@polkadot/keyring@13.5.6` — Polkadot integration (`apps/api/backend/package.json`)
- `@trustgraph/client@1.6.0`, `@trustgraph/react-provider@1.4.0`, `@trustgraph/react-state@1.6.1` — trust registry client (`apps/web/package.json`)

**Infrastructure / observability:**
- `@sentry/nextjs@10.38.0` (web) + `@sentry/node@10.38.0` (backend) — error tracking
- `@opentelemetry/api`, `@opentelemetry/context-async-hooks`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/semantic-conventions` — backend distributed tracing (`apps/api/backend/package.json`)
- `lucide-react@0.454.0` — icon set (`apps/web/package.json`)

**Workspace packages** (consumed via `workspace:*`):
- `@vitalcv/audit`, `@vitalcv/command-registry`, `@vitalcv/crs`, `@vitalcv/domain-*`, `@vitalcv/haip-config`, `@vitalcv/ingest`, `@vitalcv/issuer-sdk`, `@vitalcv/poe-engine`, `@vitalcv/psv`, `@vitalcv/psv-adapters`, `@vitalcv/shared`, `@vitalcv/trust-state`, `@vitalcv/verifier-sdk`, `@vitalcv/wallet-sdk`

## Configuration

**Environment:**
- `.env.example` patterns at `apps/api/.env.example`, `apps/api/backend/src/engine/.env.example`, `apps/marketing/.env.example`
- Runtime env validation in `apps/api/backend/src/config/env.ts` (Zod-shaped)
- Per-CLAUDE.md: production `RECEIPT_PRIVATE_KEY_JWK` + `RECEIPT_KID` enforce fail-closed signing

**Build:**
- Root: `turbo.json` (tasks: build, dev, test, lint, typecheck; persistent dev; `DATABASE_URL` declared as global env)
- Web: `apps/web/next.config.mjs` (Sentry wrap, transpile workspace packages, security headers, rewrites for `.well-known/{jwks,did,openid-credential-issuer}.json`)
- Backend: `apps/api/backend/tsconfig.json`; build = `bash ../../scripts/prisma-generate-locked.sh --schema backend/prisma/schema.prisma && pnpm exec tsc -p backend/tsconfig.json`

**Containment / ignores:**
- `.vercelignore` + `.railwayignore` exclude `node_modules/`, `.next/`, `dist/`, `docs/`, `tests/`, `*.md` from deploy artifacts

## Platform Requirements

**Development:**
- pnpm 10.6.1 (pinned)
- Local Postgres (Prisma `DATABASE_URL`)
- macOS / Linux primary; Windows possible but the canonical-runtime guard pins port 3030 via Unix-style port checks

**Production:**
- **Web** — historically Vercel (token-based deploy in `.github/workflows/deploy-demo.yml`, configs at `vercel.json`, `apps/web/vercel.json`, `apps/api/backend/vercel.json`). Vercel is currently disabled at the account level; see `docs/ops/vercel-exit-emergency-plan.md` (separate branch) for the Cloudflare migration plan.
- **Backend** — Railway (`railway.toml`): pnpm frozen-lockfile install → turbo build → `prisma migrate deploy` → Node start with `--experimental-vm-modules`. 120s health-probe timeout on `/health`.
- **Build artifacts** — Turbo cache populated by `pnpm turbo run build --filter @vitalcv/web` (web canonical build) and per-package builds for `@vitalcv/trust-state` + `@vitalcv/shared` which must be prebuilt to `dist/` before downstream Next.js compilation succeeds.

---

*Stack analysis: 2026-05-18*
*Update after major dependency changes (Next.js / React / Prisma majors, or pnpm version bump).*
