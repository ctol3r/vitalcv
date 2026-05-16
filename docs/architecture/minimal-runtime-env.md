# Minimal Runtime Env

**Wave 3 deliverable.** Deterministic env-var inventory for migration
without operational memory loss. Extends `production-env-requirements.md`
(B20-CODE-01) with the survival-mode lens: which vars survive a
platform migration and which require operator-side regeneration.

## §1 — Migration-safe vars (copy verbatim from current platform)

These env values are independent of the runtime platform. Copy-paste
from Vercel → Cloudflare / Netlify / wherever:

| Var | Required? | Notes |
|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | **YES** | ES256 private JWK; same key works on any runtime that supports Web Crypto + jose |
| `RECEIPT_KID` | **YES** | `vcv-es256-1` (or operator-chosen) |
| `CLERK_SECRET_KEY` | **YES** | `sk_live_...`; valid across runtimes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **YES** | `pk_live_...`; matches secret |
| `DATABASE_URL` | **YES** | Postgres connection string; same on any runtime that has TCP egress |
| `BACKEND_URL` | YES (if web↔backend split) | `https://api.vitalcv.com` |
| `NEXT_PUBLIC_API_BASE` | YES (cosmetic) | Same value as `BACKEND_URL` |
| `NEXT_PUBLIC_SENTRY_DSN` | RECOMMENDED | DSN works across runtimes |
| `SENTRY_AUTH_TOKEN` | YES (for source-map upload during build) | Build-only secret |
| `VITALCV_ENV_LABEL` | RECOMMENDED | `production` / `preview` / `local` |
| `ALLOWED_CORS_ORIGINS` | RECOMMENDED | Comma-separated allowlist |

## §2 — Migration-aware vars (may need regeneration)

These may need regeneration depending on the target runtime:

| Var | Vercel | Cloudflare Pages | Notes |
|---|---|---|---|
| `CRON_SECRET` / `MONITORING_SECRET` | Used by Vercel Cron | Cloudflare uses Cron Triggers — separate setup | Regenerate; reuse value if you want bilateral validity |
| `RECEIPT_KID_DEV` | Dev local only | Dev local only | N/A on production |
| Build-time vars (e.g., `TURBO_TOKEN`, `TURBO_TEAM`) | GitHub Actions secrets | Same | Independent of runtime; CI-side only |

## §3 — Vars to NEVER copy between scopes

These should be DIFFERENT between Production and Preview/Staging:

| Var | Why different |
|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | Preview should use a SEPARATE keypair to avoid identity collision with prod signed receipts |
| `RECEIPT_KID` | Should be e.g. `vcv-es256-preview-1` on Preview, `vcv-es256-1` on Production |
| `DATABASE_URL` | Preview should point at preview DB; production at production DB |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview can use `pk_test_` / `sk_test_`; production uses `pk_live_` / `sk_live_` |
| `VITALCV_ENV_LABEL` | `preview` vs `production` |

## §4 — Operator extraction procedure (Vercel → Cloudflare migration)

### Step 1 — Export from Vercel

```bash
# Authenticate to Vercel:
vercel login
vercel switch <team-slug>
cd /path/to/repo
vercel link  # links current dir to the canonical project

# Pull production env to a local file (DO NOT commit this file):
vercel env pull .env.production.local --environment=production

# Pull preview env:
vercel env pull .env.preview.local --environment=preview
```

The pulled `.env.*.local` files contain the actual values. **Treat as
secrets**: never commit, never paste into chat, etc.

### Step 2 — Import into Cloudflare Pages

```bash
# Authenticate to Cloudflare:
wrangler login

# For each secret var (RECEIPT_PRIVATE_KEY_JWK, CLERK_SECRET_KEY,
# DATABASE_URL, SENTRY_AUTH_TOKEN, CRON_SECRET, MONITORING_SECRET):
wrangler secret put RECEIPT_PRIVATE_KEY_JWK
# (paste value from .env.production.local when prompted)

# For public vars (NEXT_PUBLIC_*, VITALCV_ENV_LABEL, BACKEND_URL):
# Set in wrangler.toml [env.production.vars] section OR via the
# Cloudflare Pages dashboard under Settings → Environment Variables.
```

### Step 3 — Verify post-import

After deploying:

```bash
# Probe /api/health to verify Cloudflare picked up the env:
curl -s https://<cloudflare-domain>/api/health | jq

# Verify signing identity (should match Vercel response):
curl -s https://<cloudflare-domain>/api/.well-known/jwks.json | jq '.keys[0].kid'
# Expect: same value as Vercel response
```

If kid values diverge: env vars are not consistent between platforms.

## §5 — Required-vs-optional split (concise)

**Cannot start production without** (5 vars):
1. `RECEIPT_PRIVATE_KEY_JWK`
2. `RECEIPT_KID`
3. `CLERK_SECRET_KEY`
4. `DATABASE_URL`
5. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

**Should set but app starts without** (4 vars):
6. `BACKEND_URL` (else inline resolvers fall back to localhost:4000)
7. `NEXT_PUBLIC_API_BASE` (cosmetic; same value)
8. `NEXT_PUBLIC_SENTRY_DSN` (errors not captured)
9. `VITALCV_ENV_LABEL` (status surface reports correctly)

**Optional / context-dependent** (3 vars):
10. `ALLOWED_CORS_ORIGINS` (only if external clients hit /api/*)
11. `CRON_SECRET` / `MONITORING_SECRET` (only if probe runner scheduled)
12. `SENTRY_AUTH_TOKEN` (build-time source-map upload)

**Dev / test only** (3 vars):
13. `RECEIPT_KID_DEV` (overrides ephemeral keypair kid)
14. `NODE_ENV=development` (set automatically by `next dev`)
15. Test-DB envs (`POSTGRES_USER`, `POSTGRES_PASSWORD`, etc. — see `scripts/backend-test-db.sh`)

## §6 — Survival-mode checklist

For a fresh Cloudflare-target deployment:

```
[ ] 1. Export from Vercel (vercel env pull)
[ ] 2. Choose Path A / B / C from cloudflare-compatibility-audit.md §9
[ ] 3. If Path C (CDN proxy): keep Vercel as origin; only configure CF DNS + cache rules; env stays on Vercel
[ ] 4. If Path A/B (CF Pages direct): import all 5 REQUIRED vars to wrangler secrets, all RECOMMENDED to wrangler.toml
[ ] 5. Set per-scope: Production secrets distinct from Preview secrets
[ ] 6. Trigger a deploy
[ ] 7. Verify via scripts/verify-production-runtime.sh (set APEX to the new endpoint)
[ ] 8. If verifier passes: switch DNS at apex
[ ] 9. If verifier fails: do NOT switch DNS; debug at preview URL first
```

## §7 — What this doc does NOT cover

- Vercel team / billing setup (out of scope)
- Cloudflare account creation (out of scope)
- DNS provider configuration (out of scope — depends on provider)
- Database migration (Railway → other) — out of scope, Railway should stay
- Backend env vars (`apps/api/backend/.env.example` is the source of truth there)

This document is web-app-scoped and migration-targeted.
