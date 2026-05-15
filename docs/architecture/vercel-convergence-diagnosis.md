# Vercel Convergence Diagnosis

> **⚠ RETRACTION (B18 wave):** Earlier revisions of this document named
> `vcv-web` as the canonical Vercel project. External verification proved
> `vcv-web.vercel.app` is unrelated to VitalCV. The actual canonical project
> is unknown until operator-side discovery in the Vercel dashboard. All
> `vcv-web` references in this document have been replaced with
> `<canonical-project-TBD>`. The remaining diagnostic logic is unaffected.
> See `retraction-vcv-web.md` and `production-restore-sequence.md` §1.

**B18 priority context**: `vitalcv.com` currently returns HTTP 402 (paused).
The pause-resolution runbook is `pause-root-cause-report.md`; run it
BEFORE the diagnostic flow below.

**B16-DEPLOYMENT-02 deliverable.** Operator-runnable diagnostic for
why production may be stale/paused/disabled, and the deterministic
next action.

This document describes what an operator should check; it does not
itself probe Vercel (the Vercel CLI / dashboard is the source of
truth, not in-repo state).

## §1 — Canonical vs deprecated runtime

| Property | Canonical | Deprecated |
|---|---|---|
| Vercel project name | `<canonical-project-TBD>` | `vitalcv` |
| Repo path served | `apps/web` | `apps/web` (same code; different project linkage) |
| Production branch | `main` | (varies; may be paused or unlinked) |
| Domain attachment | apex `vitalcv.com` SHOULD be attached here | If apex is still attached here, that's the divergence |

The canonical `<canonical-project-TBD>` project is the one operator action should target. The
deprecated `vitalcv` project remains as a Vercel artifact and SHOULD have its
production domain detached if it has not been already.

## §2 — Operator probe sequence (in order)

Run these in the order given. Stop at the first one that surfaces a divergence.

### Probe 1 — current live SHA on apex

```bash
curl -s https://vitalcv.com/api/health | jq
# Note timestamp; compare to last deploy timestamp.
# If timestamp older than the most recent main commit by hours/days,
# apex is stale.
```

If `service: "web"` returns: apex is `apps/web`. If anything else: apex is
attached to the wrong project — DOMAIN ATTACHMENT issue (§3 row d).

### Probe 2 — signing identity check

```bash
curl -s https://vitalcv.com/api/.well-known/jwks.json | jq '.keys[0].kid'
curl -s https://vitalcv.com/.well-known/did.json      | jq '.verificationMethod[0].publicKeyJwk.kid'
curl -s https://vitalcv.com/api/status                | jq '.runtime_continuity'
```

| Observation | Diagnosis |
|---|---|
| All three return `"vcv-es256-1"` | Signing identity converged. ✓ |
| Any returns `"vcv-es256-dev"` or `"vcv-es256-dev-<digits>"` | Production-fail-closed guard NOT yet on this runtime. Either (a) PR-362 not deployed, or (b) cache layer holding stale response. |
| JWKS or DID returns **500** | Fail-closed guard fired — `RECEIPT_PRIVATE_KEY_JWK` or `RECEIPT_KID` env vars not set on this Vercel project. |
| `/api/status` returns `runtime_continuity.status: "degraded"` with `signing_key_id: null` | Same env-missing condition, surfaced honestly by the status route's catch wrapper. |

### Probe 3 — branch linkage

In the Vercel dashboard for `<canonical-project-TBD>`:

- Settings → Git → Production Branch: should be `main`
- Settings → Domains: `vitalcv.com` should appear, marked as the production domain
- If `vitalcv.com` is missing or attached to `vitalcv` (the deprecated project): that is the BRANCH LINKAGE / DOMAIN ATTACHMENT issue

### Probe 4 — deployment pause / billing

In the Vercel dashboard for `<canonical-project-TBD>`:

- Deployments tab: if the most recent deployment is older than the most recent `main` commit, deployments may be paused
- Billing → Spending Limits: if limits hit, builds are blocked (BILLING issue)
- Project Settings → Functions: if any function disabled, runtime errors will surface

### Probe 5 — env propagation

In the Vercel dashboard for `<canonical-project-TBD>`:

- Settings → Environment Variables → Production scope: verify all required vars are present (see §4)
- After setting any new variable, REDEPLOY — env vars do not retroactively apply to existing builds

### Probe 6 — edge cache

```bash
# Add Cache-Control bypass header:
curl -s -H "Cache-Control: no-cache" https://vitalcv.com/api/health | jq
# Compare to the un-bypassed response from Probe 1.
# Divergence indicates CDN cache.
```

If diverge: Vercel CDN is serving a stale version. Fix: trigger a new
deployment (any commit on main) OR use Vercel CLI: `vercel deploy --prod
--force`.

## §3 — Likely root causes ordered by frequency

| # | Cause | Symptom | Fix |
|---|---|---|---|
| a | Env propagation incomplete (`RECEIPT_PRIVATE_KEY_JWK` / `RECEIPT_KID` not set on Production scope) | JWKS/DID return 500; `/api/status` reports `degraded` | Set env vars, redeploy |
| b | Wrong project receiving traffic — apex attached to `vitalcv` (deprecated) instead of `<canonical-project-TBD>` (canonical) | `/api/health` may still return `service: "web"` (same code) but config differs; signing kid different from operator expectation | Detach apex from deprecated project; verify only `<canonical-project-TBD>` has the apex domain |
| c | Stale runtime — deployment older than current `main` | `/api/health` timestamp behind current commit time | Force new deploy; if blocked, check billing/pause |
| d | Edge cache holding old responses | `Cache-Control: no-cache` returns different content from cached request | Force deploy (cache invalidates on new deployment); confirm via probe 6 |
| e | Vercel project paused | Deployments tab shows pause marker | Resume in dashboard |
| f | Billing limit hit | Builds queued but never run | Adjust spending limit |
| g | Preview/Production env divergence | Preview shows `vcv-es256-1`, production shows `vcv-es256-dev` (or vice-versa) | Ensure env vars set on BOTH Production AND Preview scopes in `<canonical-project-TBD>` |
| h | Vercel preview NODE_ENV=production gotcha | Preview deploys return 500 on JWKS unless preview-scope env vars are set | Set the env vars on Preview scope too, or accept previews 500-ing on signing surfaces |

## §4 — Required env vars on `<canonical-project-TBD>` (Production scope)

| Var | Required value | Effect if missing |
|---|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | ES256 private JWK (JSON-encoded) | JWKS/DID routes throw → 500 (fail-closed); status reports degraded |
| `RECEIPT_KID` | `vcv-es256-1` | JWKS/DID routes throw → 500 (fail-closed); receipt[lineageKey] route falls back to `vcv-es256-1` literal anyway |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | `/api/health` reports `clerk.enabled: false`; protected routes redirect to `/sign-in` that has no functional backing |
| `CLERK_SECRET_KEY` | `sk_live_...` | Same — middleware enters fallback path |
| `NEXT_PUBLIC_API_BASE` (recommended) | `https://api.vitalcv.com` | `/api/health` reports `apiBase: false` (cosmetic); backend reachability still works via fallback |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | Errors not captured in Sentry |
| `VITALCV_ENV_LABEL` (optional) | `production` | `/api/status` `environment` field reports `'unknown'` |

## §5 — Single deterministic answer to "what blocks production"

```
IF curl https://vitalcv.com/api/.well-known/jwks.json returns 500:
  → BLOCKER: RECEIPT_PRIVATE_KEY_JWK and/or RECEIPT_KID not set on <canonical-project-TBD> Production scope.
  → ACTION: set both, redeploy.

ELIF curl returns kid containing "dev":
  → BLOCKER: PR-362 deploy has not propagated, OR apex attached to deprecated project.
  → ACTION: verify domain attachment in Vercel dashboard; if correct, force new deploy.

ELIF curl returns kid "vcv-es256-1":
  → NO BLOCKER. Signing identity converged. ✓

ELSE:
  → CACHE LAYER suspected. Run probe 6.
```

## §6 — Rollback condition

If post-deploy any of the following holds, roll back to the prior
deployment:

- `/api/health` returns non-200
- `/api/.well-known/jwks.json` returns 500 (env vars not set; safer to roll back than serve a degraded JWKS until env is fixed)
- Apex `/passport` page renders the bare-Verified label or any banned phrase
- `/api/status` reports `overall: "degraded"` for more than 5 minutes after deploy
- A spike in 500s from the signing routes (any caller hit by fail-closed)

Rollback in Vercel: Deployments tab → previous deployment → Promote
to Production. Vercel handles cache invalidation automatically on
promotion.
