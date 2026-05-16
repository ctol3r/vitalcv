# Cloudflare Compatibility Audit

**Wave 2 deliverable.** Audits `apps/web` for Cloudflare Pages /
Workers compatibility. Identifies Node-only dependencies and edge-
incompatible APIs that block a direct Cloudflare deployment.

## §1 — Headline finding

`apps/web` currently targets the **Vercel Node.js runtime** explicitly:

- **191 route handlers declare `export const runtime = 'nodejs'`**
- **2 route handlers declare `export const runtime = 'edge'`**
- The middleware uses `@clerk/nextjs/server` (compatible with both)

Migrating to Cloudflare Pages with NEXT-ON-PAGES (the official Next.js
adapter) requires either:

- **Path A**: Run on Cloudflare Workers via `@cloudflare/next-on-pages` — all routes execute on the Workers runtime (V8 isolate, no Node). This requires removing Node-only dependencies OR accepting that Node-runtime routes will be incompatible.
- **Path B**: Use Cloudflare Pages Functions (Node compatibility mode via `nodejs_compat` flag) — preserves more Node behavior but with restrictions.
- **Path C**: Static-first hybrid — convert as many routes as possible to static, leave a small dynamic backend on Vercel/Railway, point apex DNS through Cloudflare as a CDN proxy only.

**Recommendation: Path C** is the survival-mode path of least
resistance. It preserves the current Node-runtime code without forcing
a rewrite of jose / Prisma / signing code.

## §2 — Edge-incompatible dependencies

These dependencies cannot run on the Cloudflare Workers runtime
without modification. Each row names the consumer and the
compatibility verdict.

| Dependency | Consumer | Edge-compatible? | Notes |
|---|---|---|---|
| `jose` (`generateKeyPair`, `importJWK`, `exportJWK`, `SignJWT`) | `apps/web/lib/crypto/receiptIssuer.ts` | **Mostly** | jose has a Web Crypto path (`jose/webcrypto`); but Vercel-side uses Node `CryptoKey`. Confirm subpath import works on Workers. |
| `@prisma/client` | (referenced from `apps/web/package.json` — verify actual usage) | **NO** for Workers | Prisma's edge driver (`@prisma/client/edge` + `@prisma/accelerate`) is an option but adds dependency on the Prisma Accelerate hosted service. Not free-tier-friendly. |
| `node:crypto` | `apps/web/lib/pilot/pilot-intake.ts`, `apps/web/lib/trust/passport-observability.ts`, `apps/web/app/api/employer-review/[entityId]/[action]/route.ts`, `apps/web/app/api/intelligence/launch-readiness/route.ts`, `apps/web/app/api/internal/source-health/_auth.ts` | **NO** for Workers | Replace with `crypto.subtle` (Web Crypto API) for hash / sign / verify; or move callers to a Node-runtime function. |
| `@sentry/nextjs` (via `next.config.mjs` `withSentryConfig`) | All routes | **Mostly** | Sentry has separate Vercel / Cloudflare adapters; the Next.js wrapper may not work on Cloudflare without an adapter switch. |
| `@clerk/nextjs/server` | `middleware.ts` + multiple routes | **YES** | Clerk supports edge runtime; should work. |
| `next/server` (`NextRequest`, `NextResponse`) | Many | **YES** | Web Streams-based; designed for edge. |
| `node:url` / `URL` / `URLSearchParams` | Many | **YES** | Web Standards. |
| Prisma client direct (`prisma_client`) | `apps/web/app/api/passport/**`, `/api/replay/**`, `/api/health` indirectly | **NO** without `@prisma/client/edge` | Move DB access into a separate Node-runtime function. |

## §3 — Routes that ARE edge-compatible today

Routes already declared `runtime = 'edge'` work as-is. Found 2:

```bash
grep -rn "export const runtime = 'edge'" apps/web/app
```

Plus any route with NO `runtime =` declaration that doesn't import
Node-only modules — those can be moved to edge with a single line
change.

## §4 — Routes that MUST stay on Node runtime

Any route that:

- Imports `node:crypto` (5 files identified above)
- Imports `@prisma/client` or `graphql/prisma_client` (most `/api/passport/**`, `/api/replay/**`)
- Uses `jose.generateKeyPair` with `extractable: true` (`apps/web/lib/crypto/receiptIssuer.ts:36-42`)
- Reads `process.env.RECEIPT_PRIVATE_KEY_JWK` and imports via `importJWK` (`receiptIssuer.ts:91-101`) — may work on edge with Web Crypto path
- Uses `Buffer.from(...)` for base64url encoding — works on Node and Workers via polyfill; verify

**Total**: ~191 routes declare `runtime = 'nodejs'`. The vast majority
of those would need verification before edge migration.

## §5 — Cloudflare-specific configurations needed

### `wrangler.toml` (root of repo, OR `apps/web/wrangler.toml`)

Minimum example for Path C (static-first):

```toml
name = "vitalcv-web"
compatibility_date = "2026-01-01"

[site]
bucket = "./apps/web/.next/static"  # If using Pages with static-only
# OR for hybrid:
# main = "apps/web/.next/server/edge/server.js"

[env.production]
# DO NOT put secrets here — use `wrangler secret put NAME` instead.
# Secret env vars (per production-env-requirements.md):
#   - RECEIPT_PRIVATE_KEY_JWK
#   - RECEIPT_KID
#   - CLERK_SECRET_KEY
#   - DATABASE_URL
#   - SENTRY_AUTH_TOKEN

[env.preview]
# Same shape; different values
```

### `next.config.mjs` adjustments

Cloudflare Pages requires:

```diff
 const nextConfig = {
   transpilePackages: [
     '@vitalcv/shared',
     ...
   ],
   experimental: {
     externalDir: true,
+    // Cloudflare-specific:
+    // serverComponentsExternalPackages: ['@prisma/client'],
   },
   ...
+  // For Cloudflare static export hybrid:
+  // output: 'export',  // (DO NOT enable for hybrid; only for pure static)
 };
```

### Image optimization

`next.config.mjs` already has `images: { unoptimized: true }` —
**already Cloudflare-compatible**. No change needed.

## §6 — Path C (static-first hybrid) — recommended migration

**Architecture**:

```
                       ┌─────────────────────────┐
  apex vitalcv.com ──→ │ Cloudflare CDN (proxy)  │
                       │ + static page caching   │
                       └────────┬────────────────┘
                                │
                                │ proxy dynamic
                                ▼
                       ┌─────────────────────────┐
                       │ Vercel apps/web         │
                       │ (Node runtime, current) │
                       └────────┬────────────────┘
                                │
                                ▼
                       ┌─────────────────────────┐
                       │ Railway apps/api        │
                       │ (Postgres)              │
                       └─────────────────────────┘
```

**What changes**:
- Cloudflare sits in front of Vercel as a caching proxy.
- Static pages (homepage, marketing, docs, status, legal) are cached at the CF edge with long TTL.
- Dynamic pages (passport, employer review, /api/*) pass through to Vercel.
- Cloudflare absorbs the bulk of traffic at near-zero cost.
- Vercel only sees dynamic requests → minutes consumed drop.

**What doesn't change**:
- All Node-runtime code stays as-is.
- All Prisma queries stay on Vercel functions.
- The signing key, env vars, replay readers — all unchanged.

**What's needed**:
- Cloudflare account; add `vitalcv.com` as a zone.
- DNS update: A/CNAME at apex points to Cloudflare; CF orange-cloud proxy enabled.
- Origin records: Cloudflare's origin is the Vercel deployment URL.
- Cache rules: aggressive cache for `/`, `/pricing`, `/docs`, `/status`, `/legal/*`, `/p/*`; bypass cache for `/api/*`, `/passport`, `/onboarding`, `/employer/*`.
- TLS: CF handles edge certificate; Vercel still serves valid certs to CF.

## §7 — Path A (full Cloudflare Pages migration) — full rewrite required

Costs:

| Step | Effort |
|---|---|
| Replace `@prisma/client` with edge-compatible alternative (`@prisma/client/edge` + Accelerate, OR move all DB access to a separate Node function) | HIGH |
| Replace `node:crypto` with `crypto.subtle` in 5 identified files | MEDIUM |
| Verify `jose` Web Crypto path for receipt signing | MEDIUM |
| Replace `@sentry/nextjs` with Cloudflare-compatible Sentry adapter | LOW |
| Rebuild + test every route under edge runtime | HIGH |
| Verify Clerk works on CF Workers (likely yes; needs confirmation) | LOW |
| Cloudflare Pages build pipeline setup (`wrangler.toml`, build command, env injection) | LOW |

**Estimated effort: 1–2 engineering weeks.** Not recommended for survival mode.

## §8 — Path B (CF Pages with `nodejs_compat`) — partial workaround

Cloudflare Workers has a `nodejs_compat` flag that enables a subset
of Node built-ins (`node:crypto`, `node:buffer`, etc.) on Workers.
Adding to `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

**What works**:
- `node:crypto` (mostly)
- `node:buffer`
- `node:util`
- `node:url`

**What still doesn't work**:
- Prisma client (still requires `@prisma/client/edge` for query engine)
- Anything using long-lived TCP connections
- Workers have a 30s wall-clock limit (vs Vercel Hobby 10s, Pro 60s)

**Effort: ~1–3 engineering days**. Higher than Path C, lower than Path A.

## §9 — Recommendation

**Survival mode = Path C** (Cloudflare as CDN proxy in front of Vercel).

This gives:
- Near-zero CDN cost on static traffic
- Same Vercel runtime for dynamic
- No code rewrite needed
- ~hours to set up, not weeks

If/when Vercel costs become the bottleneck again, revisit Path A or
Path B. For now, Path C buys runway without disrupting the current
runtime architecture.

## §10 — What this audit does NOT do

- Does NOT change any route's runtime declaration.
- Does NOT install Cloudflare adapter packages.
- Does NOT migrate DNS.
- Does NOT modify `next.config.mjs` or add `wrangler.toml` (those changes are tracked in this branch's `wrangler.toml` stub but not active).
- Does NOT replace any Node-only API.

All of those are downstream of the operator choosing Path A / B / C
from §9.
