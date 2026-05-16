# Minimal Dynamic Runtime

**Wave 5 deliverable.** Defines the smallest possible dynamic runtime
required to support real-user onboarding, NPI lookup, passport
hydration, and readiness scoring. Everything else can be static.

## §1 — Hard requirement: DYNAMIC

These surfaces MUST be dynamic because they depend on per-request
state, authenticated session, or write paths.

| Surface | Why dynamic |
|---|---|
| `/api/health` | Reports per-request config posture |
| `/api/status` | Reports current runtime continuity (signing health, replay readers) |
| `/api/.well-known/jwks.json` | Force-dynamic; reads env-driven keypair |
| `/.well-known/jwks.json` (when canonical handler ships) | Same |
| `/.well-known/did.json` | Same |
| `/api/passport/npi/[npi]` | Backend proxy; fresh per request |
| `/api/passport/entity/[id]` | Same |
| `/api/ingest/[npi]` | Triggers a backend run; fresh response per request |
| `/api/ingest/stream/[runId]` | SSE stream; never cacheable |
| `/api/replay/runs/[runId]` | Reads DB |
| `/api/replay/lineage/[lineageKey]/runs` | Same |
| `/api/replay/chain/[npi]` | Same |
| `/api/replay/runs/by-npi/[npi]` | Same |
| `/api/receipt/by-lineage/[lineageKey]` | Reads DB + signs |
| `/api/receipt/[lineageKey]` | Reads DB |
| `/api/receipts/verify` | ES256 signature oracle; per-request input |
| `/api/auth/resolve-role` | Middleware fallback path |
| `/api/employer-review/**` | Authenticated; writes |
| `/api/trust-state/**` | Reads computed state |
| `/passport` | Client-side render with SSE subscription |
| `/passport/[id]` | Client-side hydration via fetch |
| `/holder/**`, `/verifier/**`, `/issuer/**`, `/admin/**`, `/internal/**` | Authenticated; protected by Clerk middleware |
| `/onboarding` (form posts) | Submission paths require server |
| `/sign-in/**`, `/sign-up/**` | Clerk-managed; dynamic by definition |
| All other `/api/**` routes | Server-side by definition |

**Count**: ~191 routes declare `runtime = 'nodejs'`. The list above is
the institutional subset; the broader set is identifiable via:

```bash
grep -rln "export const runtime = 'nodejs'" apps/web/app
```

## §2 — Can be STATIC (cheap to serve)

These surfaces have no per-request state and can be pre-rendered or
edge-cached aggressively.

### Marketing / landing

| Surface | Static-safe |
|---|---|
| `/` (homepage) | YES — but the NPI submit form posts to a dynamic backend; the page itself is renderable as static HTML with client-side form handling |
| `/pricing` | YES — foundation-preview content; no per-request data |
| `/contact` | YES — if form posts to a separate endpoint |
| `/docs` | YES |
| `/legal/**`, `/terms`, `/privacy` | YES |
| `/p/[npi]` (public profile) | ISR-able — could regenerate every N minutes from backend; static between regenerations |
| `/onboarding` (entry page) | YES — page itself is static; subsequent steps are dynamic |
| `/onboarding/identity`, `/readiness`, `/success`, `/fetching` | Most are shells; YES static-safe |
| `/status` (the page, not /api/status) | YES — renders the source-health snapshot; if snapshot store is empty (cron unscheduled), page is effectively static |

### Currently rendering with server but could be static

| Surface | Notes |
|---|---|
| `/review/[entityId]` | Public review packet; ISR candidate |
| `/clinician` | Marketing-style; static-safe |
| `/employers` (top-level marketing) | Static-safe |
| `/dossier` (if marketing) | Verify before static-ifying |

## §3 — Edge-cacheable with short TTL

These can stay dynamic but should be cached at the edge:

| Surface | Cache strategy |
|---|---|
| `/api/health` | 60s cache; per-request OK |
| `/api/.well-known/jwks.json` | 1h cache (already configured) |
| `/.well-known/did.json` | 1h cache |
| `/api/decisions/npi/:npi/timeline` | 5min cache; institutional reader |
| `/api/replay/chain/:npi` | 5min cache; relatively stable per NPI |

## §4 — Minimum backend surface area for launch

If "launch" means "real users can sign up, ingest an NPI, see their
passport, and get a verifiable receipt," the absolute minimum dynamic
runtime is:

### MUST work (auth)
- `/api/auth/resolve-role` — middleware fallback
- Clerk integration in middleware
- `/sign-in`, `/sign-up` flows

### MUST work (NPI → passport flow)
- `/api/ingest/[npi]` — kicks off backend run
- `/api/ingest/stream/[runId]` — SSE progress
- `/api/passport/npi/[npi]` — final passport fetch
- `/passport` page (client hydration)
- `/passport/[id]` page

### MUST work (verifiable trust)
- `/api/.well-known/jwks.json` — public key publication
- `/api/receipts/verify` — signature oracle
- `/api/replay/chain/[npi]` (post-PR-α merge already in main)

### SHOULD work (employer trust)
- `/api/passport/entity/[id]` — entity-scope lookup
- `/employer/review/[applicationId]`
- `/employer/decision/[applicationId]`

### CAN BE STATIC (everything else marketing-style)
- Homepage
- Pricing
- Docs
- Status
- Legal pages
- Public profiles (`/p/[npi]` ISR)

## §5 — Minimum infrastructure footprint

For survival mode (Path C from `cloudflare-compatibility-audit.md` §9):

| Component | Provider | Cost tier |
|---|---|---|
| Static page caching | Cloudflare CDN | Free / near-zero |
| Dynamic web runtime | Vercel | Hobby/Pro depending on volume |
| Backend (Postgres + business logic) | Railway | $5–20/mo Hobby |
| Authentication | Clerk | Free up to 10k MAU |
| Error tracking | Sentry | Free tier (5k errors/mo) |
| Cron / scheduled jobs | Vercel Cron OR Cloudflare Cron Triggers | Free at low frequency |

Total expected operational cost at low signup volume: **<$50/mo**.

## §6 — What this minimal runtime intentionally excludes

For launch, none of the following need to ship:

- The full institutional verifier-discovery topology (`/.well-known/openid-credential-issuer`, `/.well-known/trust-register`, `/trust` overview page) — these can ship later as the institutional buyer story matures
- Lane B trust UI primitives (TrustHeader composite, ReplayLineage UI components) — replay readers already work as JSON; UI consumption is incremental
- Continuity reconciler endpoint — derivable client-side from `/api/replay/chain/[npi]`
- Receipt-issuance persistence (audit-trail-by-jti) — receipts are signed on demand; revocation is a v2 concern
- The probe runner cron + LaneHealthMount band — UI degrades calmly without it (per `degraded-runtime-behavior-audit.md` §2)
- The full B17 BROWSER-track UI/UX evaluation surfaces (employer trust, recruiter scan, etc.) — incremental polish, not launch-blocking

All of these are documented in prior PRs as either tracked or
deferred. None is on the critical path for "first 100 real signups."

## §7 — Operator decision required

Before this branch becomes deployable, the operator must answer:

| Question | Default if no decision |
|---|---|
| Path A / B / C from `cloudflare-compatibility-audit.md` §9? | C (CDN proxy) |
| Which static pages get aggressive edge cache? | All in §2 |
| Cron runner (Vercel Cron vs Cloudflare Cron Triggers)? | Vercel Cron (already configured at low frequency per `build-churn-audit.md` §5.1) |
| Static rebuild trigger (commit-based vs ISR-based)? | Commit-based for marketing, ISR with 5min revalidation for `/p/[npi]` |
| Backend Railway plan ($5 Hobby / $20 Pro)? | Hobby until volume justifies upgrade |

Each answer can be revisited without rewriting the runtime. The point
of the minimal-dynamic-runtime classification is to keep the optional
surfaces optional.

## §8 — Summary

The smallest launchable VitalCV is **~10 dynamic routes + ~15 static
pages + Cloudflare CDN proxying Vercel**. Cost target <$50/mo.
Existing code already supports this shape — no rewrite required. The
remaining work is configuration (env, DNS, cache rules) + opt-in
static-ification of marketing surfaces.
