# External Integrations

**Analysis Date:** 2026-05-18

## APIs & External Services

**Payment Processing:**
- **Stripe** — billing for verified-hire transactions
  - SDK / Client: `stripe@20.4.0` (`apps/api/backend/package.json`)
  - Entry point: `apps/api/backend/src/services/billing/stripeClient.ts`
  - Auth: `STRIPE_SECRET_KEY` env var

**LLM / OCR:**
- **OpenAI** (optional OCR provider) — gpt-4o vision for document OCR
  - Activation: `OCR_PROVIDER=openai` + `OPENAI_API_KEY` (`apps/api/.env.example`)
  - Optional — the OCR pipeline runs without it if the env vars are absent.

**Messaging:**
- **Slack** — incoming webhooks only (outbound from VitalCV to Slack channels)
  - Pilot intake: `SLACK_PILOT_INTAKE_WEBHOOK_URL` consumed by `apps/web/app/api/pilot-intake/route.ts` via `apps/web/lib/pilot-intake/slack.ts`
  - Contact form: `SLACK_CONTACT_WEBHOOK_URL`
  - Pattern: best-effort delivery; never blocks the user response. See the same pattern in the lead-capture surface (`apps/web/lib/leads/slack.ts` on branch `feat/lead-capture-wire`).

**Product Analytics:**
- **PostHog** — client-side event capture
  - Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
  - Used from the web layer; no backend SDK is wired in.

**Healthcare / source-of-truth APIs:**
- **NPPES** (`NPPES_API` source id) — federal NPI registry, integrated via `packages/psv-adapters/` and consumed by the backend (`apps/api/backend/src/services/`).
- **OIG LEIE** (`OIG_LEIE` source id) — federal exclusion list.
- **CMS PECOS** (`PECOS_PUBLIC` source id) — Medicare provider enrollment.
- **State medical boards** (`STATE_BOARD` source id) — per-state licensure / disciplinary lookups (gated; access required).
- Canonical source-id set lives in `packages/trust-state/sourceCoverage.ts` as `LAUNCH_SPINE_SOURCE_IDS`.

**OpenID / verifiable credentials:**
- Issuer-discovery endpoints (`/.well-known/openid-credential-issuer`, `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/.well-known/did.json`, `/.well-known/trust-register.json`, `/.well-known/trust.json`, `/.well-known/verifier-manifest.json`) routed via `apps/web/next.config.mjs` rewrites and served by `apps/web/app/api/.well-known/*/route.ts`.

**Trust registry:**
- **TrustGraph** — third-party trust-registry SDK
  - Client: `@trustgraph/client@1.6.0`
  - React state: `@trustgraph/react-provider@1.4.0`, `@trustgraph/react-state@1.6.1`

**Blockchain integration:**
- Ethereum: `ethers@6.15.0` consumed by `apps/api/backend/src/services/blockchain/*`; on-chain contracts in `blockchain/contracts/` (compiled with `solc@0.8.20`).
- Polkadot: `@polkadot/api@16.4.6` + `@polkadot/keyring@13.5.6` — see `apps/api/backend/__tests__/cross_chain_did_resolver.test.js` for the resolver integration test.

## Data Storage

**Databases:**
- **PostgreSQL** — primary store
  - Hosted on Railway in production (per `railway.toml`)
  - Schema: `apps/api/backend/prisma/schema.prisma` (~151 KB)
  - Connection: `DATABASE_URL` env var (declared global in `turbo.json` so the build chain inherits it)
  - Migrations: `prisma migrate deploy` runs in Railway pre-deploy
- **Marketing DB** — separate Postgres
  - Connection: `MARKETING_DATABASE_URL`
  - Prisma client in `apps/marketing` (per CLAUDE.md: "do not pull web changes into it")

**In-memory state:**
- The backend `apiAuth` middleware (`apps/api/backend/src/middleware/apiAuth.ts`) references an in-memory session store with a Redis/DB fallback. Redis is not currently wired as a deployed dependency; the in-memory mode is the active path.

**File storage:**
- **Not detected** — no S3 / R2 / Supabase Storage / Cloudflare R2 SDK imports anywhere in the diff scope. User uploads (if any today) go through Prisma blob columns or rely on the OCR pipeline's transient buffers.

**Local JSONL** (operator surface, not production):
- `/api/leads` route on branch `feat/lead-capture-wire` writes a JSONL append to `~/.vitalcv-logs/leads.jsonl` (or `LEAD_LOG_PATH` override). See `apps/web/lib/leads/persistLead.ts`.

## Authentication & Identity

**Auth provider:**
- **Clerk** — primary auth for the web surface
  - Library: `@clerk/nextjs@6.37.3`
  - Env: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - Server-side session: `auth()` helper consumed by `apps/web/app/api/employer-review/[entityId]/[action]/route.ts` and other authenticated proxies.

**Hardware / passkey:**
- **WebAuthn** via SimpleWebAuthn
  - Client: `@simplewebauthn/browser@13.2.2`
  - Server: `@simplewebauthn/server@9.0.0`
  - Used for high-assurance authentication paths.

**DID resolution (decentralized identity):**
- W3C DID resolver suite in the backend: `did-resolver`, `ethr-did-resolver`, `key-did-resolver`, `web-did-resolver`.

**Key management:**
- **ES256 signing** keypair injected via env: `VCV_PRIVATE_KEY`, `VCV_PUBLIC_KEY`, `PSV_SIGNING_KEY`, `PSV_PUBLIC_KEY`
- Per CLAUDE.md, the canonical signing kid is `vcv-es256-1` and production must fail closed if `RECEIPT_PRIVATE_KEY_JWK` / `RECEIPT_KID` are missing — see `apps/web/lib/crypto/receiptIssuer.ts`.
- JWKS endpoint: `/.well-known/jwks.json` rewritten in `apps/web/next.config.mjs`.

**API key (service-to-service):**
- `API_KEYS` env var (comma-separated, SHA-256-hashed) checked by `apps/api/backend/src/middleware/apiAuth.ts`.

## Monitoring & Observability

**Error tracking:**
- **Sentry** — both web and backend
  - Web: `@sentry/nextjs@10.38.0`, config at `apps/web/sentry.server.config.ts` (and matching client config)
  - Backend: `@sentry/node@10.38.0`
  - DSN: `SENTRY_DSN` env var

**Distributed tracing:**
- **OpenTelemetry** — backend only
  - SDK: `@opentelemetry/api`, `@opentelemetry/context-async-hooks`, `@opentelemetry/core`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/semantic-conventions` (`apps/api/backend/package.json`)

**Structured logs:**
- Backend single source: `apps/api/backend/src/obs/logger.ts` — `log('info' | 'warn' | 'error', 'event_name', { …structured fields })`
- Output is single-line JSON, consumed by Railway / Sentry breadcrumbs.

**Health checks:**
- `/health` endpoint on backend (120 s timeout in `railway.toml`)
- `apps/web/app/api/internal/source-health/route.ts` exposes the lane health surface consumed by `apps/web/components/pilot-ops/SourceHealthPanel.tsx`.

## CI/CD & Deployment

**Hosting:**
- **Web** — Vercel historically (`vercel.json`, `apps/web/vercel.json`). **Currently disabled** at the account level; production `vitalcv.com` returns HTTP 402 `DEPLOYMENT_DISABLED`. Cloudflare Pages migration plan tracked outside this branch (`docs/ops/cloudflare-production-cutover-plan.md`).
- **Backend** — Railway (`railway.toml`)
- **Marketing** — Vercel (subject to the same exit posture)

**CI workflows** (`.github/workflows/`):
- `ci.yml`, `ci-preflight.yml`, `monorepo.yml` — primary CI pipeline (build, lint, typecheck, test, "Web Quality")
- `deploy-api.yml`, `deploy-demo.yml` — deployment automation
- `openid-conformance.yml` — OID4VC conformance gate
- `a11y-gate.yml` — axe WCAG 2.2 AA gate
- `source-health-probe.yml` — periodic source-health probe
- Build/Test orchestration: Turbo task graph (`turbo.json`)

**Currently red across the open-PR fleet:** the `Web Quality` job fails because `apps/api/backend/src/services/audit/replayEngine.ts` on `origin/main` imports from four modules that don't exist (partial-merge regression from commit `8912bc7e`). See `CONCERNS.md`.

## Environment Configuration

**Names only — never values committed.**

| Env var | Where used | Notes |
|---|---|---|
| `DATABASE_URL` | backend Prisma | global env in `turbo.json` |
| `MARKETING_DATABASE_URL` | `apps/marketing` Prisma | separate database |
| `BACKEND_URL` | web proxies | `apps/web/lib/backend-url.ts` |
| `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` / `WEB_ORIGIN` | share-link resolution | `apps/api/backend/src/routes/employerActions.ts` |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth | web only |
| `STRIPE_SECRET_KEY` | Stripe billing | `apps/api/backend/src/services/billing/stripeClient.ts` |
| `VCV_PRIVATE_KEY`, `VCV_PUBLIC_KEY`, `PSV_SIGNING_KEY`, `PSV_PUBLIC_KEY` | ES256 signing | backend |
| `RECEIPT_PRIVATE_KEY_JWK`, `RECEIPT_KID` | web receipt signer | fail-closed in production per CLAUDE.md |
| `OPENAI_API_KEY` + `OCR_PROVIDER` | optional OCR | backend |
| `SENTRY_DSN` | error tracking | both layers |
| `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` | client analytics | web only |
| `SLACK_PILOT_INTAKE_WEBHOOK_URL`, `SLACK_CONTACT_WEBHOOK_URL` | outbound Slack | best-effort |
| `LEAD_LOG_PATH` | `/api/leads` JSONL override | optional (default `~/.vitalcv-logs/leads.jsonl`) |
| `SLACK_LEAD_CAPTURE_WEBHOOK_URL` | `/api/leads` Slack | optional |
| `INTERNAL_DASH_PASSWORD`, `MONITORING_SECRET` | internal ops | backend |
| `API_KEYS` (CSV) | service-to-service | hashed at boot |
| `CORS_ORIGIN` | backend CORS | must not be `*` in production |
| `TRUST_STATE_RATE_LIMIT_PER_MINUTE=120` | backend rate limit | configurable |
| Feature flags: `PILOT_MODE`, `YC_DEMO_MODE`, `ENTERPRISE_MODE` | runtime mode | backend |

Secrets management: Railway env tab (backend), Vercel env tab (web — currently unreachable; founder-approved migration to Cloudflare in flight).

## Webhooks & Callbacks

**Incoming (VitalCV receives):**
- `/api/pilot-intake` (web) — pilot inquiry form submissions (`apps/web/app/api/pilot-intake/route.ts`).
- `/api/leads` (web, branch `feat/lead-capture-wire`) — lead capture from `/launch` and `/demo/employer`.
- Backend has webhook receivers under `apps/api/backend/src/routes/` for source-update and credential-issuance flows; receivers verify signatures before processing.

**Outgoing (VitalCV emits):**
- Slack pilot intake (`apps/web/lib/pilot-intake/slack.ts`).
- Slack lead capture (`apps/web/lib/leads/slack.ts`, branch `feat/lead-capture-wire`).
- Widget webhook dispatcher: `apps/api/backend/src/services/integration/widgetWebhookService.ts`.
- Network webhook dispatcher: `apps/api/backend/src/services/network/webhookDispatcher.ts`.

Verification: outgoing webhooks include a signature header; receivers verify against a shared secret per dispatcher.

---

*Integration audit: 2026-05-18*
*Update when adding/removing external services or rotating any of the listed env-var contracts.*
