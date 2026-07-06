# CLOUDFLARE_SURVIVAL_DEPLOYMENT_PLAN.md
Generated: 2026-05-15 — Wave 5 of Founder Survival Mission

## Objective
Move VitalCV from Vercel to Cloudflare Pages + Workers.
Target: $5–25/mo total infrastructure cost, zero preview build explosions.

---

## Current State (Vercel)

| Problem | Impact |
|---------|--------|
| Every PR creates a preview deployment | Burns build minutes + serverless invocations |
| Serverless functions billed per invocation | Costs scale with usage before revenue |
| Vercel Pro required for team features | $20/mo baseline + overages |
| Monorepo build includes ALL packages | Slow, expensive builds |
| Sentry server config adds cold-start overhead | Extra bundle weight |

---

## Target State (Cloudflare)

| Layer | Tool | Cost |
|-------|------|------|
| Static pages + CDN | Cloudflare Pages | **$0** |
| API functions (stateless) | Cloudflare Workers | **$5/mo** (10M req) |
| Database | Neon Postgres (free) or Cloudflare D1 | **$0** |
| Auth | Clerk (existing) | Existing cost |
| Monitoring | Cloudflare Analytics | **$0** |

**Total: ~$5–25/mo** depending on API volume.

---

## Migration Steps

### Phase 1 — Stop the bleeding (this week)

**1. Disable Vercel preview deployments**
```
# vercel.json — add to root
{
  "github": {
    "silent": true,
    "enabled": false
  }
}
```
Or use Vercel dashboard → Settings → Git → disable "Auto Deploy" for branches.
This alone stops the preview cost explosion immediately.

**2. Remove duplicate deployments**
Identify all Vercel projects tied to VitalCV and consolidate to ONE project.
Delete any stale/orphaned Vercel projects.

**3. Remove unused monorepo apps from build scope**
In `turbo.json`, restrict default build to `@vitalcv/web` only.
Other apps (`admin-api`, `issuer-api`, etc.) should not build on every commit.

---

### Phase 2 — Cloudflare Pages setup (days 1–3)

**1. Install Cloudflare adapter**
```bash
cd apps/web
npm install @cloudflare/next-on-pages
```

**2. Update next.config.mjs**
```js
// Switch to edge runtime for compatible routes
// Remove Node.js-specific APIs from API routes
```

**3. Create wrangler.toml**
```toml
name = "vitalcv-web"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".vercel/output/static"

[vars]
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "..."
```

**4. Add build script**
```json
// package.json in apps/web
{
  "scripts": {
    "build:cf": "NEXT_EXPORT=1 next build && npx @cloudflare/next-on-pages"
  }
}
```

**5. Connect GitHub repo to Cloudflare Pages**
- Cloudflare Dashboard → Pages → Create Project → Connect GitHub
- Build command: `pnpm --filter @vitalcv/web build:cf`
- Output directory: `.vercel/output/static`
- Set environment variables (Clerk keys, DATABASE_URL)

---

### Phase 3 — API route migration (days 3–7)

#### Routes that work on Cloudflare Workers (no changes needed)
- `/api/health` ✓
- `/api/readyz` ✓
- `/api/deploy-info` ✓
- `/api/track` ✓
- `/api/.well-known/*` ✓
- `/api/identity` (NPPES proxy — add `export const runtime = 'edge'`)

#### Routes requiring adaptation
These use Node.js APIs or Prisma and need edge-compatible replacements:

| Route | Issue | Fix |
|-------|-------|-----|
| `/api/ingest/*` | Prisma + Node streams | Replace with `@neondatabase/serverless` |
| `/api/auth/*` | Clerk — already edge-compatible | Test and verify |
| `/api/candidates` | Prisma ORM | Switch to raw SQL via Neon serverless |
| `/api/employer-review` | Prisma | Switch to Neon serverless |
| `/api/psv/*` | Prisma | Switch to Neon serverless |
| `/api/receipts` | File system writes | Use Cloudflare R2 or KV |
| `/api/pilot-intake` | Prisma | Switch to Neon serverless |

**Database adapter swap:**
```bash
npm install @neondatabase/serverless
npm uninstall @prisma/client prisma
```
For MVP, raw SQL is fine — schema is simple enough.

#### Routes to remove before migration (not worth porting)
See STATIC_FIRST_REDUCTION_PLAN.md → REMOVE section.

---

### Phase 4 — Remove Vercel (after CF is stable, week 2)

1. Verify production traffic on Cloudflare Pages
2. Update DNS CNAME: `vitalcv.com` → Cloudflare Pages URL
3. Delete Vercel project
4. Remove `vercel.json` from repo root and `apps/web/`
5. Remove Sentry server-side config (keep client-only)

---

## Compatibility Constraints

### Things Cloudflare Pages CANNOT do
- Long-running Node.js processes (max 30s CPU time per request)
- `fs` module (no filesystem writes)
- Prisma with standard Postgres connection pooling
- Server-Sent Events (SSE) with long connections > 30s
  → **Fix**: Change `/api/ingest` SSE to polling with 10s intervals, or use Cloudflare Durable Objects

### SSE Migration (critical — passport page uses SSE)
Option A: Switch to short-poll (simpler, cheaper)
```ts
// Every 3s, client polls /api/ingest/status/:runId
// Returns current state — no streaming needed
```
Option B: Cloudflare Durable Objects for state (more complex)

**Recommendation: Option A (short-poll).** Users won't notice the difference at MVP scale. Simplifies everything.

---

## Preview Deploy Control

Cloudflare Pages automatically creates previews for every branch.
To disable:
1. Dashboard → Pages project → Settings → Builds & Deployments
2. Set "Branch deployments" to "None" or "Only production branch"

This eliminates the preview sprawl problem.

---

## Environment Variables

Required in Cloudflare Pages dashboard:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
DATABASE_URL=postgresql://...@neon.tech/vitalcv
NEXT_PUBLIC_APP_URL=https://vitalcv.com
VITALCV_ENV_LABEL=production
```

---

## Cost Projection

| Service | Free Tier | Paid |
|---------|-----------|------|
| Cloudflare Pages | 500 builds/mo, unlimited requests | $20/mo Pro |
| Cloudflare Workers | 100k req/day free | $5/mo for 10M |
| Neon Postgres | 512MB, 0.5 CU free | $19/mo for more |
| Clerk | 10k MAU free | $25/mo for more |
| **Total** | **$0/mo at launch** | **~$50/mo at scale** |

vs Vercel: $20/mo + usage overages before you have a single paying customer.

---

## Immediate Action (do this today)

```bash
# Step 1: Kill preview deployments NOW
# Go to: https://vercel.com/[your-team]/vitalcv/settings/git
# Disable "Auto Deploy for Branches"

# Step 2: Audit active Vercel projects
vercel list

# Step 3: Delete stale projects
vercel remove [project-name]
```

That alone buys you 2–3 weeks of runway recovery before full migration.
