# Railway Deploy Runbook · vitalcv.com (web)

**Status:** Ready to deploy.
**Verified:** 2026-05-22.

## What this PR does

- Removes the Vercel-coupled `start`/`dev` wrapper that referenced
  a missing `scripts/runtime/assert-canonical-runtime.ts`. The
  scripts now use `next start -H 0.0.0.0 -p ${PORT:-3030}` so
  Railway's injected `$PORT` works out of the box.
- Adds `apps/web/railway.toml` + `apps/web/nixpacks.toml` so the
  Railway service can deploy `apps/web` directly (the root
  `railway.toml` is for `apps/api/backend`).
- Removes `vercel.json` and `.vercelignore` from the repo root.
- Applies the wallet-sdk orphan-export fix (PR #375 carried here
  too).
- Adds `apps/web/.env.example` listing required + optional env.

**Verified locally on this branch:**
- `pnpm install --frozen-lockfile` — clean
- `pnpm turbo run build --filter @vitalcv/web` — passes
- `PORT=8765 pnpm start` — boots in ~360ms
- `curl http://127.0.0.1:8765/api/health` — returns
  `{"status":"ok","service":"web","backend":{"url":"https://api.vitalcv.com","status":"unreachable"},...}`

## Exact Railway deployment steps

### 1. Create the service

Railway dashboard → New Service → Deploy from GitHub repo → select
`ctol3r/vitalcv`.

Set:
- **Branch:** `fix/vercel-removal-railway-deploy` (or `main` after merge)
- **Root directory:** `apps/web`
- **Builder:** Nixpacks (auto-detected from `nixpacks.toml`)

### 2. Generate the receipt-issuer keypair

Before setting env vars, generate the ES256 keypair the production
receipt issuer requires:

```bash
node scripts/generate-receipt-keypair.mjs
```

This prints two lines (`RECEIPT_KID=...` and `RECEIPT_PRIVATE_KEY_JWK=...`).
Treat the private JWK as a secret; never commit it. If you lose the
keypair, generate a new one — receipts minted with the old key will
stop verifying.

### 3. Set the required env vars

In the Railway service → Variables tab, add:

| Variable | Value | Why required |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | (from clerk.com production app) | `/sign-in` and Clerk-wrapped routes 500 without it |
| `CLERK_SECRET_KEY` | (from clerk.com production app) | Same |
| `RECEIPT_KID` | (from step 2) | `/trust`, `/trust/doctrine`, `/.well-known/jwks.json`, `/.well-known/did.json`, `/.well-known/trust-register` all 500 without it |
| `RECEIPT_PRIVATE_KEY_JWK` | (from step 2; full JSON string including the curly braces) | Same |
| `NEXT_PUBLIC_API_BASE` | `https://api.vitalcv.com` | Most server-side proxy routes (`apps/web/app/api/**`) and three client components (`apply`, `verify`, `ImpactPanel`) use an inline fallback chain that ends in `http://localhost:4000`. Without `NEXT_PUBLIC_API_BASE` set, those routes call localhost inside the Railway container and the client bundle bakes localhost as the build-time literal. The `apps/web/lib/backend-url.ts` module has a production-safe fallback to `https://api.vitalcv.com`, but it is NOT used uniformly — set the env var explicitly. |
| `NODE_ENV` | `production` | Triggers fail-closed paths; no ephemeral dev keys |

**Do not set `PORT`** — Railway injects it automatically.

Recommended optional vars:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://vitalcv.com` |
| `VCV_ISSUER_HOST` | `vitalcv.com` |

Skip Sentry and Backend URLs unless those services are needed for
the public launch. The runtime tolerates their absence:
- `NEXT_PUBLIC_SENTRY_DSN` unset → Sentry instrumentation skipped entirely
- `BACKEND_URL` unset → `/api/health` reports `backend: unreachable` but the surface stays up

### 3. Build + start commands (already wired)

These are read from `apps/web/nixpacks.toml` and
`apps/web/railway.toml` and do not need manual override:

| Phase | Command |
|---|---|
| Install | `cd ../.. && pnpm install --frozen-lockfile` |
| Build | `cd ../.. && pnpm turbo run build --filter @vitalcv/web` |
| Start | `pnpm start` (which runs `next start -H 0.0.0.0 -p ${PORT}`) |

### 4. Health check

Path: `/api/health`
Expected: `200 OK` with JSON body `{"status":"ok",...}`
Timeout: 60 seconds (set in `railway.toml`)

### 5. Custom domain

Railway service → Settings → Networking → Custom Domain → add
`vitalcv.com`.

Railway returns a target hostname like `xxxxx.up.railway.app`.

### 6. Cloudflare DNS

In the Cloudflare DNS dashboard for the `vitalcv.com` zone:

| Type | Name | Content | Proxy |
|---|---|---|---|
| `CNAME` | `@` (or `vitalcv.com`) | `xxxxx.up.railway.app` | Proxied (orange cloud) OR DNS-only (grey cloud) |
| `CNAME` | `www` | `xxxxx.up.railway.app` | match the apex |

**Cloudflare proxy mode**: Railway accepts both proxied and
DNS-only. If proxied, Cloudflare terminates TLS at its edge and
proxies to Railway; if DNS-only, Railway handles TLS directly via
its issued cert. For the first deploy, **DNS-only is simpler** —
it avoids a double-TLS hop and surfaces Railway TLS issues
immediately.

After DNS propagation (1–5 minutes), the Railway dashboard will
show the custom domain as `Active`.

### 7. Verify

Run the canonical smoke test:

```bash
./scripts/verify-production.sh https://vitalcv.com
```

It runs 19 deterministic checks across:
- `/api/health` (liveness; status=ok)
- `/api/readyz` (readiness; GET + HEAD)
- `/` (SSR; status=200, content-type=text/html, body >1KB)
- `/trust` and `/trust/doctrine` (Clerk + receipt-issuer chain)
- `/.well-known/jwks.json`, `/.well-known/openid-credential-issuer`, `/.well-known/did.json` (issuer interop)
- `/sign-in` (Clerk; accepts 200 or 30x redirect to clerk host; flags 500 explicitly as missing-Clerk-env)

A passing run prints `[OK  ] verify-production: 19 checks passed` and exits 0.

A single check failing on `/sign-in` with the diagnostic
"almost certainly missing Clerk env vars" means the build is up
but the Clerk env vars are not set. A check failing on
`/.well-known/jwks.json` (or `/trust`) means `RECEIPT_KID` +
`RECEIPT_PRIVATE_KEY_JWK` are not set.

Also visit `https://vitalcv.com/` in a browser — confirm SSR
renders without hydration errors in the dev console.

## What can break and how to recover

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: `Cannot find module './interoperability'` in wallet-sdk | Wallet-sdk orphan re-export | Confirm `packages/wallet-sdk/src/index.ts` line 351 is the doctrine note, not the broken `export * from './interoperability'`. |
| Build fails: workspace dependency `@vitalcv/trust-state` not found | Turbo prebuild missed | Ensure build runs from monorepo root (`cd ../..`) so turbo orders workspace builds. |
| Start fails: `Error: listen EADDRINUSE` on Railway | `$PORT` not used | Verify `apps/web/package.json` `start` is `next start -H 0.0.0.0 -p ${PORT:-3030}` (no hard-coded port). |
| Build fails: Clerk types missing | Clerk env vars unset at build time | Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` BEFORE the first build, not after. |
| `/api/health` returns 200 but homepage 500s | Clerk publishable key unset at runtime | The site needs both Clerk env vars set; the health route works without them. |
| All routes 500 (including `/api/health`) | Invalid Clerk env vars (e.g. dummy placeholder strings like `pk_test_dummy`) | Clerk middleware crashes on malformed publishable keys. Either set real keys from clerk.com, or leave both Clerk env vars **completely unset** — partial / dummy values are worse than absent. |
| `/trust`, `/trust/doctrine`, `/.well-known/jwks.json`, `did.json`, `trust-register` all 500 | `RECEIPT_KID` or `RECEIPT_PRIVATE_KEY_JWK` not set in production | Run `node scripts/generate-receipt-keypair.mjs`, paste both lines into the Railway Variables tab, redeploy. The issuer fails closed in production and refuses to mint an ephemeral dev key. |
| JWKS endpoint returns 500 with "Unsupported key usage for a ECDSA key" | `RECEIPT_PRIVATE_KEY_JWK` was generated by hand and includes `key_ops` or `ext` Web Crypto metadata | Re-generate using `node scripts/generate-receipt-keypair.mjs` — it strips both fields. Paste the new value, redeploy. |
| Pages render but Clerk redirects loop | Clerk dashboard URL settings | Clerk production app must allow `vitalcv.com` as an authorized origin. |

## What is intentionally NOT done in this PR

- **Vercel-coupled GitHub Actions workflows** have been removed
  (`deploy-demo.yml` deleted in the Vercel-deprecation PR). Railway is the
  canonical deploy target (`deploy-api.yml` + `deploy-web.yml`).
- **`output: 'standalone'` in `next.config.mjs`** is NOT enabled.
  The default Next.js output works on Railway. Switching to
  standalone is an optional optimization for a future PR.
- **The root `railway.toml`** for `apps/api/backend` is untouched.
  Web and API are separate Railway services.
- **DATABASE_URL** is not required for the public-only launch.
  Prisma client generation does not need a reachable database;
  it generates types from the schema. If any runtime code path
  actually executes a Prisma query against the web schema, the
  request will fail with a clear Prisma error — investigate and
  either wire DATABASE_URL or remove the call.

## Final determination

**LIVE + SAFE** — pending Railway service creation, env-var setting,
and DNS propagation. The repo is deploy-safe.

### Exact remaining blockers (operator-only)

1. Create the Railway service pointing at `apps/web` (operator action).
2. Set the two required Clerk env vars in the Railway dashboard (operator action).
3. Attach `vitalcv.com` to the Railway service (operator action).
4. Update Cloudflare DNS CNAME to the Railway target hostname (operator action).
5. Update Clerk production app's authorized origins to include `vitalcv.com` (operator action).

All five blockers are operator-side. No code blocker remains.

## Post-cutover freeze (binding)

Once `vitalcv.com` is live and `scripts/verify-production.sh` reports
`19 checks passed`, the repo enters a **stabilization-first freeze**:

1. **Only deploy-safe / hotfix-grade changes** merge to main during
   the first 72 hours.
2. **No new routes, no new doctrine surfaces, no new architecture,
   no new orchestration layers** during the freeze window.
3. **Wave 2–6 backlog items** (institutional-deployment-readiness,
   operational-proof-surfaces, institutional-trust-memory,
   materialized-institutional-flows, institutional-experience-compression)
   are **archived post-launch backlog**. They are explicitly not
   in scope for cutover or stabilization. They unfreeze only after
   live behavior is verified.
4. **Safe-change boundary**: a change is hotfix-grade only if it
   targets one of:
   - a runtime crash (5xx on a canonical route)
   - a security regression (auth bypass, secret leakage)
   - a hydration crash (broken client bundle)
   - a deploy regression (build / start failure)
   - a verify-production failure on a check that was previously OK
5. **Everything else waits** until the post-cutover freeze lifts.

## First-24-hour monitoring order (operator)

| When | What | How |
|---|---|---|
| t+0 | DNS + TLS resolves | `./scripts/verify-production.sh https://vitalcv.com` |
| t+5 min | Full verify-production passes | same command; expect 19 checks pass |
| t+15 min | Railway logs clean | Railway dashboard → Deployments → Logs; look for Clerk-middleware crashes, RECEIPT_PRIVATE_KEY_JWK errors |
| t+1 hr | Health check stable | `watch -n 30 'curl -fsS https://vitalcv.com/api/health \| jq .'` (or repeated curls) |
| t+4 hr | Re-run verify-production | confirm no drift |
| t+24 hr | Stabilization review | confirm no rollback triggered; release the freeze if all checks remain green |

## Rollback triggers

Roll back immediately on any of:

- `verify-production.sh` reports ≥2 FAILs on a check that was previously OK
- `/api/health` returns 500 (not just slow) for >2 consecutive minutes
- Clerk-middleware crash detected in Railway logs (every route 500ing)
- TLS handshake errors persist >5 min after DNS update
- Receipt-JWK chain breaks live verifiers (`/.well-known/jwks.json` returns 500 unexpectedly)

Rollback hierarchy (use in order; first option that fits the situation):

1. **Railway → Deployments → previous successful deploy → "Redeploy this deployment"** — preferred. Instant. Main branch unchanged. Preserves git history.
2. **`git revert <merge-commit> && git push origin main`** — when the bad change must come off `main` immediately for repeated redeploys. Preserves history; creates a clean revert commit Railway picks up on the next build.
3. **`git push --force-with-lease origin main`** — last-resort emergency only. Never the default rollback path. Use only when 1 and 2 are insufficient because the bad commit must be erased from history (e.g. secret leak in the diff). Force-push rewrites history; coordinate with anyone working off main before pushing.

## Likely first-production regressions

| Symptom | Cause | Fix |
|---|---|---|
| All routes 500 including `/api/health` | Dummy Clerk env vars set in Railway | Either real keys from clerk.com or completely unset (no placeholders) |
| `/trust` chain 500s, `/api/health` 200 | `RECEIPT_KID` + `RECEIPT_PRIVATE_KEY_JWK` unset | Generate with `node scripts/generate-receipt-keypair.mjs`, paste into Variables, redeploy |
| `/sign-in` redirect loop | Clerk authorized-origins missing `vitalcv.com` | Add to Clerk production app → Domains |
| TLS handshake fails first 5 min | Railway cert still provisioning | Wait; verify-production retries with backoff |
| DNS resolves to wrong IP | Cloudflare CNAME points at stale Railway target | Update CNAME with current Railway hostname |
| Cold-start latency 30+ s | Railway service spun down | Set Railway service to "Always On" or accept first-request latency |

