# Production Restore Sequence

**B18-TRUTH-04 deliverable.** Minimum path to restore externally
reachable production for `vitalcv.com`. Optimized for fastest
recovery, lowest risk, lowest ambiguity.

## §0 — CRITICAL RETRACTION OF PRIOR ASSUMPTIONS

External verification proved:

- **`vcv-web.vercel.app` is NOT a VitalCV project.** It belongs to an unrelated third-party. Prior convergence docs naming `vcv-web` as canonical are INVALID.
- **`vitalcv.com` currently returns HTTP 402** "This deployment is temporarily paused."
- **The actual canonical Vercel project is unknown** until the operator confirms it in the Vercel dashboard.

This document does NOT presume any project name. It guides the
operator to discover the real one and resolve the pause.

## §1 — Step 1: Discover the real canonical Vercel project

This step requires Vercel dashboard or CLI access. It cannot be
performed from a build session.

### Option A — Vercel dashboard

1. Log into Vercel as the account that owns `vitalcv.com`.
2. Open the team / personal account that has billing for the deployment.
3. Settings → Domains: find the project that lists `vitalcv.com` (or `www.vitalcv.com`) as an attached production domain.
4. Record the exact project name as observed. **This is the canonical project.** Do not assume from prior naming.

### Option B — Vercel CLI

```bash
# Install / authenticate Vercel CLI if not already:
npm i -g vercel
vercel login

# List all teams and look for the one owning VitalCV:
vercel teams ls

# Switch to the right team:
vercel switch <team-slug>

# List projects in that team:
vercel projects ls

# Find the project that has vitalcv.com attached:
vercel domains ls
# (Look for vitalcv.com → which project)
```

### Option C — DNS / WHOIS path

If neither dashboard nor CLI is available, the DNS record for
`vitalcv.com` points to Vercel's load balancer. Vercel itself uses
the SNI hostname (the domain in the request) to route — so the
project is determined by Vercel's internal domain table, not by
public DNS. You cannot identify the project from DNS alone.

### What to record

| Field | Value (fill in) |
|---|---|
| Canonical Vercel project name | |
| Team / account slug | |
| Linked GitHub repo | |
| Production branch | |
| Most recent deployment ID (dpl_*) | |
| Most recent deployment SHA | |
| Deployment state | paused / ready / error / queued |
| Domain attachment confirmed | yes / no |

The rest of this runbook assumes these fields are now known. Without
them, no automated restore is possible.

## §2 — Step 2: Identify why production is paused (HTTP 402)

HTTP 402 from Vercel typically means one of the following:

| Cause | Surface in Vercel dashboard | Resolution |
|---|---|---|
| Spending limit hit (Hobby/Pro) | Settings → Billing → Spending Limits; "Limit reached" banner | Raise limit OR upgrade plan OR wait for reset |
| Project / team payment failed | Settings → Billing → Payment method shows "Failed" | Update payment method |
| Account suspended | Account-level banner on login | Contact Vercel support |
| Deployment manually paused | Deployments tab → recent deployment shows "Paused" badge | Resume from menu |
| Project disabled by team admin | Settings → General → "Project is disabled" toggle | Re-enable |
| Domain verification failed (rare 402) | Settings → Domains → verification status not "Valid" | Re-verify (DNS records / TXT) |
| Anti-abuse rate-lock (extremely rare) | Email from Vercel ops | Contact Vercel support |

**Note**: HTTP 402 is the Vercel-specific signal. Standard production
failure modes return 500 / 502 / 503. A 402 is almost always
billing-/pause-related, not code-related.

## §3 — Step 3: Resume / unpause production

Once the cause from §2 is known:

### If billing / spending:

1. Settings → Billing → adjust Spending Limit higher, or upgrade plan.
2. Wait for the rate-lock to clear (usually instant after limit change).
3. Trigger a new deployment to flush the 402: `vercel --prod` OR push any commit to the production branch.

### If manual pause:

1. Deployments tab → most recent deployment → three-dot menu → "Resume".
2. If the pause was at the project level (Settings → General), toggle to enable.

### If account suspended:

1. Contact Vercel support with the team / account slug.
2. Resolve any flagged issues.
3. After unlock, deploy fresh.

### If unknown cause:

1. Check the project's "Audit Log" tab (if available on plan).
2. Recent entries near the pause time often name the cause.

## §4 — Step 4: Verify production is reachable

After resuming:

```bash
# Should NOT return 402:
curl -i https://vitalcv.com/api/health

# Expect: 200, JSON, service: "web", recent timestamp
# If still 402: pause not fully resumed. Re-check dashboard.

# Confirm runtime SHA:
curl -s https://vitalcv.com/api/health | jq '.timestamp'
# If timestamp doesn't reflect a recent deploy, force a new one:
vercel --prod --force
```

## §5 — Step 5: Confirm the runtime is the right repo

```bash
# Confirm the deployed app is apps/web from this repo:
curl -s https://vitalcv.com/api/health | jq '.service'
# Expect: "web"

# Confirm the signing identity is the one PR-362 ships:
curl -s https://vitalcv.com/api/.well-known/jwks.json | jq '.keys[0].kid'
# Expect: "vcv-es256-1" if env is set; or 500 (fail-closed) if env missing
# DO NOT accept any value containing "dev"
```

If `service: "web"` is returned: the canonical project is serving
this repo. If anything else: the wrong project is attached to apex.

## §6 — Step 6: Set required env vars (if not already)

Vercel dashboard → the canonical project → Settings → Environment
Variables → Production scope:

| Var | Required value |
|---|---|
| `RECEIPT_PRIVATE_KEY_JWK` | ES256 private JWK (JSON-encoded) |
| `RECEIPT_KID` | `vcv-es256-1` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_API_BASE` | `https://api.vitalcv.com` |
| `BACKEND_URL` | `https://api.vitalcv.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN |
| `VITALCV_ENV_LABEL` | `production` |

After setting, trigger a redeploy (env vars do not retroactively apply).

## §7 — Step 7: Smoke-test full institutional surface

After §4–§6 succeed:

```bash
# Signing identity convergence:
curl -s https://vitalcv.com/api/.well-known/jwks.json | jq '.keys[0].kid'
curl -s https://vitalcv.com/api/status | jq '.runtime_continuity'
curl -s "https://vitalcv.com/api/receipt/nppes_identity:1346053246" | jq '.receipt.signingKeyId'

# Replay continuity (post-PR-α/β/γ merge):
curl -X POST https://vitalcv.com/api/ingest/1346053246
# wait for SSE 'done' event
curl -s https://vitalcv.com/api/replay/chain/1346053246 | jq '.lineages'

# Banned-phrase regression scan:
curl -s https://vitalcv.com/ | grep -iE "automatically verified|guaranteed verification|HIPAA compliant|SOC2 certified"
# Expect: no output
```

## §8 — Rollback condition

If §4 succeeds (apex reachable, no longer 402) but §5 or §7 fails:

1. Vercel dashboard → Deployments tab on the canonical project
2. Find the last "Ready" deployment (green health) before the current one
3. Three-dot menu → "Promote to Production"
4. Vercel handles CDN invalidation on promotion

If §4 itself fails after a resume attempt, escalate to Vercel
support. The 402 indicates a platform-side hold; no code change can
clear it.

## §9 — Estimated time to recovery

- Step 1 (discover canonical project): 2–5 min
- Step 2 (identify cause): 1–3 min
- Step 3 (resume): 30 sec – 5 min depending on cause
- Step 4 (verify reachable): 1 min
- Step 5 (verify right repo): 1 min
- Step 6 (env vars if needed): 5–15 min
- Step 7 (smoke test): 2 min

**Total: 15–30 minutes** for a billing-/pause-only cause where env
is already configured. **Up to 60 minutes** if env vars require
fresh provisioning.

## §10 — What this runbook explicitly does NOT do

- Does NOT rename, create, or modify any Vercel project.
- Does NOT alias `vitalcv.com` to any specific project name.
- Does NOT change DNS.
- Does NOT presume `vcv-web` (or any specific name) is the canonical project — only the operator-confirmed value from §1 is canonical.
- Does NOT modify repo code.
- Does NOT introduce new infrastructure.

The repo is in a clean state; the bottleneck is platform-side
(deployment paused) and operator-side (which project is canonical).
This runbook converges both.
