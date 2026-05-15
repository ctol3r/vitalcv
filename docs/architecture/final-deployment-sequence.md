# Final Deployment Sequence

**B16-RELEASE-06 + B17-CODE-01 deliverable.** Single operator runbook
covering canonical deploy, runtime recovery, and post-deploy
verification. Optimized for low ambiguity — a new operator should be
able to follow this without prior repo knowledge.

## §1 — Canonical baseline

| Item | Value |
|---|---|
| Canonical Vercel project | `vcv-web` |
| Deprecated Vercel project (detach apex from this) | `vitalcv` |
| Canonical branch | `main` |
| Canonical release SHA (as of audit) | `7f7ace10` |
| Production domain | `vitalcv.com` |
| Backend (Railway) | `https://api.vitalcv.com` |
| Required production env vars | see §3 |

If any of the four "canonical" rows above does not match Vercel
dashboard reality, fix that first. Everything below assumes the
baseline is correct.

## §2 — Deploy sequence

### Step 1 — Confirm Vercel project linkage

In the Vercel dashboard:

- `vcv-web` → Settings → Git: production branch must be `main`
- `vcv-web` → Settings → Domains: `vitalcv.com` must appear, marked production
- `vitalcv` (deprecated) → Settings → Domains: `vitalcv.com` must NOT appear

If apex is attached to `vitalcv` instead of `vcv-web`: detach from
`vitalcv`, attach to `vcv-web`. This is the single most common cause
of "stale production" symptoms.

### Step 2 — Confirm env vars on `vcv-web`

See §3 for the full required list. The two load-bearing ones are
`RECEIPT_PRIVATE_KEY_JWK` and `RECEIPT_KID=vcv-es256-1`. Without
these, the JWKS + DID routes will return 500 (fail-closed guard).

Setting env vars in Vercel does NOT retroactively apply to existing
builds. After setting any env var, force a new deployment.

### Step 3 — Trigger deploy

Two ways:

```bash
# A) Push any commit to main (CI auto-deploys):
git push origin main

# B) Force deploy of current main (no new commit):
vercel --prod --force
```

Vercel build will run `pnpm install` then `pnpm turbo run build`. The
new fail-closed guard means production builds REQUIRE `RECEIPT_KID` +
`RECEIPT_PRIVATE_KEY_JWK` set on the Production scope (already
addressed by step 2). Routes `/api/.well-known/jwks.json` and
`/.well-known/did.json` are marked `force-dynamic` so the build itself
doesn't invoke `getPublicKeyJwk()` at prerender time; runtime
invocation is where the guard fires.

### Step 4 — Wait for deploy to complete

In Vercel dashboard → Deployments tab → wait for the new deployment to
show "Ready" status. Expected duration: ~2–4 minutes.

## §3 — Required env vars (`vcv-web` Production scope)

| Var | Value | Effect when missing |
|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | ES256 private JWK (JSON-encoded string) | JWKS/DID routes return 500 (fail-closed) |
| `RECEIPT_KID` | `vcv-es256-1` | Same — fail-closed in production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | `/api/health` reports `clerk.enabled: false`; protected routes broken |
| `CLERK_SECRET_KEY` | `sk_live_...` | Middleware enters non-Clerk fallback path |
| `NEXT_PUBLIC_API_BASE` | `https://api.vitalcv.com` | Cosmetic in `/api/health`; backend still reachable via fallback chain |
| `BACKEND_URL` | `https://api.vitalcv.com` | Same chain; some inline-resolver routes fall back to `localhost:4000` without this |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | Errors not captured in Sentry |
| `VITALCV_ENV_LABEL` | `production` | `/api/status` `environment` field reports `'unknown'` |
| `CRON_SECRET` and/or `MONITORING_SECRET` | random secret | Probe runner unscheduled; `LaneHealthMount` shows UNKNOWN seeds |

### Preview-scope env vars (separate from Production)

Vercel preview deploys inherit `NODE_ENV=production`, so the
fail-closed guard fires on previews too. Two operator options:

- **Option A (recommended)**: set `RECEIPT_PRIVATE_KEY_JWK` + `RECEIPT_KID=vcv-es256-preview-1` on Preview scope, using a DIFFERENT keypair from production. Preview surfaces all converge under a preview-only kid.
- **Option B**: leave Preview scope empty. Preview deploys 500 the JWKS + DID surfaces. Safer (no preview-key sprawl) but breaks preview testing of those routes.

## §4 — Verification sequence

Run all of these after step 4 completes. Stop at the first failure;
that's the blocker.

```bash
# 4.1 — Health probe (apex reachability + config posture)
curl -i https://vitalcv.com/api/health
# Expect: 200, JSON, service: "web", config booleans

# 4.2 — Signing identity convergence
curl -s https://vitalcv.com/api/.well-known/jwks.json | jq '.keys[0].kid'
curl -s https://vitalcv.com/.well-known/did.json      | jq '.verificationMethod[0].publicKeyJwk.kid' 2>/dev/null || echo "did endpoint not yet on apex"
curl -s https://vitalcv.com/api/status                | jq '.runtime_continuity'
curl -s "https://vitalcv.com/api/receipt/nppes_identity:1346053246" | jq '.receipt.signingKeyId' 2>/dev/null

# All four MUST emit the SAME kid value (expected: "vcv-es256-1").
# NONE should emit anything containing "dev".

# 4.3 — Replay continuity reader (post-deploy)
curl -i https://vitalcv.com/api/replay/chain/1346053246
# Expect: 200, JSON.

# 4.4 — Banned-phrase scan on rendered homepage
curl -s https://vitalcv.com/ | grep -iE "automatically verified|guaranteed verification|HIPAA compliant|SOC2 certified"
# Expect: no output (no banned phrases).

# 4.5 — Sanity check for 404 cascade on previously-broken paths
for p in /verifier /trust /verify /compliance; do
  echo -n "$p: "
  curl -s -o /dev/null -w "%{http_code}\n" https://vitalcv.com$p
done
# These should either 200 (if they ship) or be removed from public navigation.
# A 404 is acceptable only if no link in marketing copy points to that path.

# 4.6 — Cache-bypass divergence probe
curl -s -H "Cache-Control: no-cache" https://vitalcv.com/api/health | jq '.timestamp'
curl -s https://vitalcv.com/api/health | jq '.timestamp'
# Both timestamps should be recent. If they diverge significantly, edge
# cache is holding old responses; force a new deploy.
```

## §5 — Smoke tests (extended)

After §4 passes, run these against a real demo NPI:

```bash
# Trigger one ingest run:
curl -X POST https://vitalcv.com/api/ingest/1346053246
# Read the SSE stream; wait for {"type":"done"}

# Probe replay readers populated by the run:
curl -s https://vitalcv.com/api/replay/chain/1346053246 | jq '.lineages | length'
# Expect: >= 1 if Railway DB has the demo seed and the ingest succeeded.
# 0 with empty lineages: either demo seed missing on Railway, or
# replay writer failed (check backend logs for 'replay_writer_failed').
```

## §6 — Rollback conditions

Roll back IMMEDIATELY if any of the following holds after deploy:

| Condition | Indication |
|---|---|
| `/api/health` returns non-200 | Apex broken |
| `/api/.well-known/jwks.json` returns kid containing `"dev"` | PR-362 guard not on this deploy; rollback ensures no leak |
| `/api/.well-known/jwks.json` returns 500 for more than 5 min | Env vars not set; rollback while operator re-configures |
| Banned-phrase scan (§4.4) returns hits | Copy regression; rollback before institutional reviewer sees it |
| `/api/status` reports `overall: "degraded"` for >5 min | Multiple subsystem degradation; rollback to last known good |
| Vercel error rate spike on signing routes | Fail-closed firing because env unset; rollback while reconfiguring |

Rollback procedure:

1. Vercel dashboard → Deployments tab on `vcv-web`
2. Find the last deployment marked Production with green health
3. Three-dot menu → "Promote to Production"
4. Vercel handles CDN cache invalidation automatically on promotion
5. Re-run §4 verification against the rolled-back state

## §7 — Canonical runtime recovery (worst case)

If apex is fully broken (Vercel project misconfigured, env wiped, etc.):

1. Verify the canonical baseline (§1) — does `vcv-web` exist, is it linked to GitHub, is `main` the production branch?
2. If `vcv-web` does NOT exist: create it. Link to GitHub repo `ctol3r/vitalcv`. Set production branch `main`. Set Framework Preset = Next.js. Set Root Directory = `apps/web` (it's a monorepo).
3. Set env vars per §3.
4. Trigger a deploy.
5. Attach `vitalcv.com` to the new project; detach from any other project.
6. Run §4 verification.

The repo `apps/web` is a vanilla Next 15 App Router app; no exotic
build config beyond the standard `next build` (via Turbo for the
workspace prebuild). If Vercel's auto-detection produces wrong
defaults, the relevant `next.config.mjs` lives at `apps/web/next.config.mjs`.

## §8 — Post-deploy validation summary

After running §4 + §5 successfully, the runtime is in a verified
state. Record:

| Item | Value (fill in) |
|---|---|
| Deploy timestamp | |
| Deployment ID (dpl_*) | |
| Live SHA | |
| JWKS kid emitted | |
| DID kid emitted | |
| Status reports degraded? | |
| Replay reader returns rows? | |
| Banned-phrase scan clean? | |

This record is the ground truth for "what is on apex right now." Keep
it alongside the deploy ticket for the next operator's reference.
