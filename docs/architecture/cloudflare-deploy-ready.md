# Cloudflare Deploy Ready

**Single closing synthesis** for Cloudflare Pages deployment prep.
Consolidates `cloudflare-compatibility-audit.md`, `minimal-runtime-env.md`,
`minimal-dynamic-runtime.md`, and `build-churn-audit.md` into one
operator-facing readiness summary.

Adds Task 6 (production build reproducibility) which is the only
genuinely new content beyond the prior 4 docs.

## §0 — Read-this-first decision

The prior `cloudflare-compatibility-audit.md` §9 recommended
**Path C — Cloudflare as a CDN proxy in front of current Vercel.**
That recommendation stands. This doc:

- Confirms the recommendation against Task 6 (build reproducibility)
- Provides the operator-side checklist to execute Path C
- Documents what Path A / Path B would additionally require, in case the operator chooses to go further

If the operator just wants to lower cost without disrupting current
runtime: **Path C is the answer; skip to §6 for the checklist.**

## §1 — Task 1: Next.js compatibility with Cloudflare Pages

Full code-level audit lives in `cloudflare-compatibility-audit.md` §1–§4.

| Concern | Status |
|---|---|
| Next 15 App Router | Supported by Cloudflare Pages via `@cloudflare/next-on-pages` |
| `next.config.mjs` `images.unoptimized: true` | Already Cloudflare-compatible (no Vercel Image Optimization dependency) |
| `next.config.mjs` `rewrites()` | Compatible (Pages supports Next rewrites) |
| `next.config.mjs` `redirects()` | Compatible |
| `next.config.mjs` `headers()` | Compatible |
| `transpilePackages: [@vitalcv/shared, @vitalcv/crs, @vitalcv/psv, @vitalcv/ingest, @vitalcv/trust-state]` | Compatible — Next handles transpile at build time |
| `experimental.externalDir: true` | Compatible |
| Sentry wrapper (`withSentryConfig`) | Needs Cloudflare-specific Sentry adapter for Workers; ON-PAGES adapter not yet first-class |
| 191 routes with `export const runtime = 'nodejs'` | INCOMPATIBLE with pure Workers; requires Path B (`nodejs_compat`) or Path C (CDN proxy keeping Vercel for Node) |
| 2 routes with `export const runtime = 'edge'` | Already Worker-compatible |

**Verdict**: Pages compatibility is mostly there, but the 191
Node-runtime routes are the bottleneck. Path C bypasses this entirely.

## §2 — Task 2: Static-first surfaces verification

Full inventory in `minimal-dynamic-runtime.md` §2.

Static-safe surfaces on `origin/main`:

- `/` (homepage; NPI form submits to dynamic backend, but the page itself is static-renderable)
- `/pricing`, `/contact`, `/docs`, `/legal/*`, `/terms`, `/privacy`
- `/onboarding` entry shell + 4 sub-step shells
- `/p/[npi]` (ISR candidate; regenerate every N minutes)
- `/status` (foundation-honest copy; source-health snapshot is empty in degraded state)
- `/review/[entityId]` (ISR candidate)

Total static-safe routes: ~15. These can be served from Cloudflare's
edge cache with long TTL.

## §3 — Task 3: Dynamic route blockers

Cannot be made static; must run as Pages Functions OR remain on Vercel:

- All `/api/**` (213 routes)
- `/passport`, `/passport/[id]` (SSE-driven hydration)
- `/sign-in/**`, `/sign-up/**` (Clerk-managed)
- `/holder/**`, `/verifier/**`, `/issuer/**`, `/admin/**`, `/internal/**` (Clerk-gated)
- `/employer/**` (authenticated)
- `/onboarding/identity`, `/readiness`, `/fetching`, `/success` (form posts)

Full classification in `minimal-dynamic-runtime.md` §1.

## §4 — Task 4: Pages Functions compatibility

Cloudflare Pages Functions execute on the Workers runtime. The 5
files using `node:crypto` (per `cloudflare-compatibility-audit.md` §2):

- `apps/web/lib/pilot/pilot-intake.ts`
- `apps/web/lib/trust/passport-observability.ts`
- `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`
- `apps/web/app/api/intelligence/launch-readiness/route.ts`
- `apps/web/app/api/internal/source-health/_auth.ts`

These need either:

- Replacement with `crypto.subtle` (Web Crypto), OR
- `nodejs_compat` flag in `wrangler.toml` (Path B), OR
- Stay on Vercel (Path C — no change required)

Other Node-runtime concerns:

| Item | Path A/B impact | Path C impact |
|---|---|---|
| `@prisma/client` direct usage | NEEDS `@prisma/client/edge` + Accelerate | Stay on Vercel |
| `jose` with `extractable: true` keypair | Web Crypto path exists; verify | Stay on Vercel |
| `@sentry/nextjs` wrapper | Need Cloudflare adapter | Stay on Vercel |

**Path C avoids all of the above.** Path B (`nodejs_compat`) handles
`node:crypto` automatically but still requires Prisma edge driver.

## §5 — Task 5: Reduce Node-only dependencies (Path A/B prep)

This is the largest engineering investment if pursuing Path A. Not
recommended for survival mode. Effort estimate:

- Replace 5 `node:crypto` files with `crypto.subtle`: ~4 hours
- Replace Prisma direct calls with edge-compatible driver: ~1-2 weeks
- Validate `jose` Web Crypto signing path: ~4 hours
- Replace Sentry wrapper with Cloudflare adapter: ~2 hours
- Test every Worker-targeted route under edge runtime: ~1 week

**Total Path A**: 2-3 engineering weeks. **Path B**: 1-3 days (Prisma still needs edge driver).

**Path C effort**: 0 engineering hours — DNS + Cloudflare dashboard config only.

## §6 — Task 6: Production build reproducibility (NEW)

The genuinely new content in this doc. Goal: the same `git rev-parse HEAD`
should produce a byte-identical `next build` output regardless of build
environment.

### Reproducibility inputs

| Input | Pinning state |
|---|---|
| `packageManager: "pnpm@10.6.1"` (root `package.json`) | **PINNED** — pnpm version fixed |
| Node version | **PARTIAL** — `ci.yml` uses NODE_VERSION='22'; `monorepo.yml` uses '20'; `ci-preflight.yml` uses '20.11.1'. **Inconsistent.** |
| `pnpm-lock.yaml` lockfile (v9.0) | **PINNED** — all deps resolved |
| `next` version (15.2.8 per root `package.json`) | **PINNED** |
| `turbo` version (^2.9.6) | **MOSTLY PINNED** — caret allows minor bumps |
| TypeScript version (5.9.3) | **PINNED** |
| Turbo cache (`TURBO_TOKEN`, `TURBO_TEAM`) | Configured in `monorepo.yml`; not in `ci.yml` |
| Build commands | `apps/web` has `"build": "prisma generate && next build"` |
| Prisma client generation | `postinstall: prisma generate` + `build: prisma generate && next build` — `prisma generate` runs TWICE on every fresh build |
| Env-var-dependent build steps | Sentry source-map upload reads `SENTRY_AUTH_TOKEN` at build time → builds without it produce DIFFERENT artifacts than builds with it |
| Date / timestamp injection | Verify no `new Date()` calls in build-time code outside server-rendered components |

### Build reproducibility verdict

**MOSTLY REPRODUCIBLE.** Three improvements worth making:

1. **Pin Node version across all CI workflows** — currently `'22'` / `'20'` / `'20.11.1'` divergence. Pick one (recommend `'22'` for current Next 15 + jose compatibility) and apply uniformly.
2. **Remove duplicate `prisma generate`** — `postinstall: prisma generate` + `build: prisma generate && next build` means Prisma generates twice on fresh installs. Pick one (recommend keeping just `postinstall`).
3. **Document Sentry build-mode** — builds with `SENTRY_AUTH_TOKEN` upload source maps; builds without don't. Producing reproducible release builds requires this env consistently set (or consistently unset). Cloudflare Pages and Vercel both support build-time env injection — set `SENTRY_AUTH_TOKEN` on both.

### Build commands for Cloudflare Pages

If proceeding with Path A/B Cloudflare Pages direct deploy:

```bash
# Build command (in Cloudflare Pages dashboard):
pnpm install --frozen-lockfile && pnpm turbo run build --filter @vitalcv/web

# Build output directory:
apps/web/.next  # for Pages with Next-on-Pages adapter
# OR
apps/web/.vercel/output/static  # for Pages with Vercel output adapter
```

For Path C (CDN proxy), no Cloudflare-side build is needed; Vercel
continues to handle builds with the existing `pnpm turbo run build`
chain.

## §7 — Path C operator checklist (recommended)

Estimated total time: **1-2 hours** in Cloudflare dashboard + DNS.

### Step 1 — Cloudflare account + zone

```
[ ] 1.1  Create / log into Cloudflare account
[ ] 1.2  Add vitalcv.com as a zone (Cloudflare auto-imports DNS records)
[ ] 1.3  Verify nameservers per Cloudflare's prompts
[ ] 1.4  Wait for zone activation (typically minutes)
```

### Step 2 — DNS proxy setup

```
[ ] 2.1  In Cloudflare DNS settings: ensure apex A/CNAME for vitalcv.com points to Vercel (Cloudflare can auto-detect from current DNS)
[ ] 2.2  Toggle "orange cloud" (proxy enabled) on the apex record
[ ] 2.3  Same for www if applicable
[ ] 2.4  TLS mode: "Full (strict)" — ensures Cloudflare → Vercel uses valid cert
```

### Step 3 — Cache rules

```
[ ] 3.1  Rules → Page Rules (or Cache Rules):
        - PATH MATCH: /api/* OR /passport OR /passport/* OR /onboarding/* OR /employer/* OR /sign-in/* OR /sign-up/*
        - CACHE LEVEL: Bypass
        - This ensures all dynamic routes pass through to Vercel
[ ] 3.2  Default cache for everything else: Cache Everything, edge TTL ~4 hours
        (Static surfaces from minimal-dynamic-runtime.md §2 will be cached aggressively)
```

### Step 4 — Verify

```
[ ] 4.1  curl -I https://vitalcv.com/api/health
        → expect 200 from Vercel; CF headers visible (cf-ray, cf-cache-status: BYPASS or DYNAMIC)
[ ] 4.2  curl -I https://vitalcv.com/pricing
        → expect 200; cf-cache-status: HIT (after a couple of warmup requests)
[ ] 4.3  Run scripts/verify-production-runtime.sh (PR #363)
        → expect all probes PASS
[ ] 4.4  Time-to-first-byte comparison: pricing should be noticeably faster than before
```

### Step 5 — Cost monitoring (week 1)

```
[ ] 5.1  Cloudflare Analytics: confirm static-route cache hit rate >80%
[ ] 5.2  Vercel dashboard: function invocations should be DOWN proportional to cache hit rate
[ ] 5.3  Adjust cache rules if hit rate is low or wrong routes are caching
```

## §8 — Path A/B operator checklist (NOT recommended for survival mode)

If operator chooses to fully migrate to Cloudflare Pages (Path A) or
Pages with `nodejs_compat` (Path B):

```
[ ] A.1  Replace 5 node:crypto files (see §4) — 4 hours engineering
[ ] A.2  Adopt @prisma/client/edge + Accelerate (paid Prisma service) OR move all Prisma to a separate Vercel/Railway function — 1-2 weeks
[ ] A.3  Validate jose Web Crypto signing — 4 hours
[ ] A.4  Replace @sentry/nextjs wrapper — 2 hours
[ ] A.5  Configure wrangler.toml (use wrangler.toml.example as starting point) — 1 hour
[ ] A.6  Configure Cloudflare Pages build hook on the GitHub repo
[ ] A.7  Pin Node version + clean prisma generate (per §6) — 30 min
[ ] A.8  Run scripts/verify-production-runtime.sh against the new endpoint
[ ] A.9  Cutover DNS only after smoke test passes
```

## §9 — Single deterministic readiness verdict

**Path C readiness**: ✓ READY. Zero engineering work; operator-side
DNS + cache rules in ~2 hours; immediate cost reduction on static
traffic.

**Path A/B readiness**: ✗ NOT READY. Requires 1-3 weeks of
engineering work to replace Node-only dependencies. Not recommended
for survival-mode timing.

**Build reproducibility**: MOSTLY READY. Three small fixes per §6
improve consistency. None of them are launch-blocking; they can land
as one small PR after launch.

## §10 — What this doc does NOT do

- Does NOT create a Cloudflare account or add the zone (operator-side)
- Does NOT modify DNS (operator-side)
- Does NOT activate any Cloudflare service
- Does NOT replace any code (Node-runtime dependencies stay as-is for Path C)
- Does NOT enable `wrangler.toml.example` (it remains an example, not active config)
- Does NOT migrate environment variables (use `minimal-runtime-env.md` §4 extraction procedure if/when needed)

This is **documentation-grade readiness** for the operator's
go/no-go decision on Cloudflare deployment. Path C is the safe path;
the operator confirms and executes outside the repo.
