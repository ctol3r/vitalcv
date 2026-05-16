# STATIC_FIRST_REDUCTION_PLAN.md
Generated: 2026-05-15 — Wave 2 of Founder Survival Mission

## Objective
Radically reduce runtime cost and Vercel/serverless dependency.
Every route that doesn't need server-side execution costs money on every preview deploy.
Goal: shift 70%+ of pages to static or client-side-only rendering.

---

## Classification Framework

| Tier | Meaning | Cloudflare cost |
|------|---------|----------------|
| **STATIC** | `export const dynamic = 'error'` — pure SSG | ~$0 |
| **CSR** | Client component, no server fetch needed | ~$0 (CDN served) |
| **EDGE** | Lightweight edge function (Cloudflare Worker) | Minimal |
| **SERVER** | Requires Node.js / DB / auth at request time | Costs money |
| **REMOVE** | Dead route, duplicate, or archive — delete | Saves everything |

---

## Route Classification

### REMOVE (dead weight — delete or redirect)

| Route | Reason |
|-------|--------|
| `/app/_archive/*` | Explicitly archived — not linked |
| `/analytics-foundation` | Internal infra page |
| `/clinician/graph` | Graph substrate was abandoned (Wave 14 lost) |
| `/clinician/device-security` | Speculative mobile feature |
| `/clinician/mobile-capture` | Mobile not in MVP |
| `/clinician/profile-layers` | Abstraction layer UI, not user-facing |
| `/clinician/research` | Not user-facing MVP feature |
| `/ops/survivability` | Internal ops page |
| `/ops` | Internal ops page |
| `/for/cvo` | Speculative vertical, no traffic |
| `/for/payer` | Speculative vertical, no traffic |
| `/for/staffing-exchange` | Speculative vertical, no traffic |
| `/trust/graph` | Graph substrate — not in MVP |
| `/trust/schema` | Protocol-theory page |
| `/trust/doctrine` | Protocol-theory page |
| `/autopilot` | Career autopilot (25% complete, not MVP) |
| `/calibration` | Internal tooling |
| `/admin/demo-reset` | Internal admin |
| `/roi` | Replace with a section on `/pilot` |
| `/docs` | Redirect to README or remove |
| `/issuer/persistence-adapter` | Infrastructure abstraction |
| `/issuer/audit-boundary` | Infrastructure abstraction |
| `/issuer/backend-persistence` | Infrastructure abstraction |
| `/dossier/*` | Duplicate of `/receipt` — consolidate |
| `/clinician/import` | Not in MVP scope |
| `/mobile/native-readiness` | Mobile not in MVP |
| `/investigate/*` | Internal tool, not user-facing |

### STATIC (convert to SSG — `export const dynamic = 'force-static'`)

These pages have no user-specific content at render time.

| Route | Action |
|-------|--------|
| `/` (homepage) | Already mostly client — make hero CSR, rest static |
| `/privacy` | Pure text — fully static |
| `/terms` | Pure text — fully static |
| `/legal/cookies` | Pure text — fully static |
| `/legal/dpa` | Pure text — fully static |
| `/contact` | Static form shell (submit via edge function) |
| `/pricing` | Static page |
| `/status` | Static shell + client-side ping |
| `/support` | Static content |
| `/verify/guide` | Static guide text |
| `/pilot` | Marketing page — fully static |
| `/p/[slug]` | If content is static, pre-render |
| `/auth/error` | Static error shell |
| `/sign-in` | Clerk-hosted, static shell |
| `/sign-up` | Clerk-hosted, static shell |
| `/signup` | Redirect to `/sign-up`, static |
| `/onboarding` | Static shell, CSR state machine |
| `/onboarding/success` | Static shell |
| `/get-ready` | Static marketing page |

### CSR (client-side rendered — remove `force-dynamic`, use client hooks)

These need JS state but no server rendering.

| Route | Reason |
|-------|--------|
| `/passport` | NPI entry + SSE stream is all client-driven |
| `/onboarding/identity` | Client form |
| `/onboarding/readiness` | Client state |
| `/onboarding/fetching` | Client polling |
| `/holder` | Authenticated client dashboard |
| `/holder/home` | Client dashboard |
| `/holder/readiness` | Client readiness view |
| `/inbox` | Client message list |
| `/clinician/profile` | Client profile view |
| `/clinician/identity` | Client identity form |
| `/clinician/onboarding` | Client onboarding flow |
| `/verify` | Client verification entry |
| `/verify/[npi]` | Client NPI lookup |
| `/review` | Client review entry |
| `/review/request` | Client request form |
| `/account/recovery` | Client recovery flow |
| `/activation/[caseId]` | Client activation flow |

### EDGE (move to Cloudflare Worker — stateless, no DB)

| Route | What it does |
|-------|-------------|
| `/api/health` | Health check — pure edge response |
| `/api/readyz` | Readiness check — pure edge |
| `/api/deploy-info` | Static build info — edge |
| `/api/track` | Analytics event ingestion — edge |
| `/api/.well-known/*` | DID/JWKS/trust documents — edge |
| `/api/identity` | NPPES proxy — stateless, cacheable |

### SERVER (must stay dynamic — require DB, auth, or external calls)

| Route | Why it must stay dynamic |
|-------|--------------------------|
| `/api/ingest/*` | NPPES + OIG + PECOS live calls |
| `/api/auth/*` | Clerk auth callbacks |
| `/api/candidates` | DB-backed candidate list |
| `/api/employer-review` | DB-backed review session |
| `/api/psv/*` | PSV workflow (auth + DB) |
| `/api/receipts` | Signed receipt issuance |
| `/api/pilot-intake` | Pilot signup with DB write |
| `/api/trust-proof` | Proof generation |
| `/api/clinician/*` | Auth-gated clinician data |
| `/api/opportunities` | Dynamic listing |
| `/passport/[id]` | Per-user authenticated view |
| `/receipt/[receiptId]` | Signed document retrieval |
| `/apply/[bundleId]` | Authenticated application flow |
| `/issuer/*` (core routes) | Auth + verification |
| `/employer/dashboard` | Auth + DB |
| `/employer/worklist` | Auth + DB |
| `/review/[entityId]` | Auth + DB |
| `/file/[fileId]` | Auth + file retrieval |

---

## Packages to Remove / Defer

The monorepo contains ~22 packages. Most are speculative infrastructure.
MVP requires **5 packages max**:

### KEEP (required for MVP)
- `@vitalcv/ingest` — NPPES + OIG + PECOS adapter
- `@vitalcv/trust-state` — readiness computation
- `@vitalcv/shared` — types/utils
- `@vitalcv/crs` — credential readiness scoring
- `@vitalcv/psv` — primary source verification primitives

### DEFER (not needed until paid contract)
- `@vitalcv/graph-core` — graph substrate (Wave 14 lost anyway)
- `@vitalcv/wallet-sdk` — no consumer wallet in MVP
- `@vitalcv/poe-engine` — proof-of-existence speculation
- `@vitalcv/trust-contract` — VC/DID abstraction
- `@vitalcv/issuer-sdk` — enterprise issuer SDK
- `@vitalcv/verifier-sdk` — enterprise verifier SDK
- `@vitalcv/embed-sdk` — embedding not in MVP
- `@vitalcv/haip-config` — protocol config
- `@vitalcv/psv-adapters` — defer until PSV paid lane
- `@vitalcv/domain-authority` — domain abstraction
- `@vitalcv/domain-core` — domain abstraction
- `@vitalcv/domain-events` — event sourcing
- `@vitalcv/tracing` — observability
- `@vitalcv/idempotency` — resilience layer
- `@vitalcv/conflict-resolution` — conflict engine
- `@vitalcv/command-registry` — command bus

### REMOVE (never needed)
- `@vitalcv/audit-receipts` — duplicate of `@vitalcv/audit`
- `@vitalcv/domain-provider` — overabstraction

---

## Cloudflare Pages Compatibility

### Breaking changes to fix before migration
1. Remove all `export const runtime = 'nodejs'` in API routes → switch to edge or remove
2. Remove Sentry server-side config (use client-only Sentry on Cloudflare Pages)
3. Replace `next/headers` usage in Client Components with client-side alternatives
4. Database (Prisma/Postgres) access must move to Cloudflare Workers or D1
5. Remove `@sentry/nextjs` from server config — too heavy for edge budget

### Expected cost after migration
- Cloudflare Pages: **$0** (free tier handles ~500 builds/month)
- Cloudflare Workers: **$5/mo** for 10M requests
- Database: **Neon free tier** ($0 for 512MB) or **Cloudflare D1** ($0 free tier)
- Total estimated monthly: **$5–25/mo** vs Vercel Pro $20+/mo with overages
