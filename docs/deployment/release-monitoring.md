# Release monitoring — durable signed-in verification of every web deploy

**Status:** implemented (this PR). Owner wiring (Railway webhook + secrets) is
required before the pipeline goes live — see [Owner wiring](#owner-wiring).

## Why this exists

During the signed-in-clinician P0, **every** authenticated clinician was
redirected to `/auth/error` before any `/holder/*` page rendered in production —
and the only way we found out was a Claude session hand-minting a synthetic
Clerk session and polling `/holder`. That verification was ephemeral: it ran
once, in a chat, and left nothing behind. Two structural gaps made it necessary
and un-automatable:

1. **No web SHA source.** The web `/api/health` route exposes no commit, so "is
   the new code actually serving?" could only be *proxied* by a route-presence
   check. `deployment-integrity.ts` can read the Railway *control-plane* commit
   (what Railway *thinks* is deployed) with a `RAILWAY_API_TOKEN`, but that is
   not the same as what the running **container** is actually serving.
2. **No standing verifier.** `deploy-web.yml` does a fixed `sleep 120` then
   curls `/api/health` — it races the deploy, never knows when the deploy
   actually *succeeded*, and only checks that the process is up, not that a
   signed-in clinician can use the product.

This system closes both: a Railway deploy webhook triggers an **external**
end-to-end verification of the signed-in flow, and the result is a durable
GitHub commit status on the verified SHA. No Claude session in the loop.

## Architecture

```
Railway web deploy SUCCESS
   │  Railway Project → Webhooks: POST deploy payload
   ▼
POST /api/internal/release-monitor/webhook      ← thin bridge, runs in web container
   │  • auth: shared secret (Bearer / x-monitoring-secret / ?token=)
   │  • parse Railway payload → web-service SUCCESS deploy?
   │  • if yes → GitHub repository_dispatch("release-verify")   [GITHUB_DISPATCH_TOKEN]
   │  • 202 immediately — does NO verification itself
   ▼
.github/workflows/release-verify.yml            ← EXTERNAL vantage (a real-user viewpoint)
   triggers: repository_dispatch[release-verify] + schedule(*/30) + workflow_dispatch
   │  pnpm verify:release → scripts/release-verify.ts:
   │    1. target = deploy commit (webhook) or GitHub main HEAD
   │    2. poll /api/version until the container serves the target commit
   │    3. GET /auth/resolving → 200 (reported)
   │    4. mint a synthetic CLINICIAN session (Clerk Backend API + FAPI ticket)
   │    5. reach the 6 /holder routes — no /auth/error, no loop   ← HARD GATE
   │    6. pnpm check:deploy (deployment integrity)
   │    7. cleanup the synthetic user + org (always)
   ▼
GitHub commit status on the verified SHA        ← DURABLE SIGNAL
   context "vitalcv/release-verified" · success/failure · target_url = the run
```

### Why the harness runs on GitHub Actions, not in the container

The P0 root cause was that the middleware's role-resolution self-fetch fails as
a **hairpin** inside the Railway container. Any verifier that runs *inside* the
web container and calls the public origin risks the same failure. Running on a
GitHub runner gives a true external, black-box, real-user vantage — exactly what
we need to trust the result. The webhook receiver stays in the container only
because that is where the Railway webhook can reach; it does no verification and
returns immediately.

### Why the thin webhook bridge

Railway webhooks can only POST to a URL. GitHub's `repository_dispatch` needs an
auth header Railway can't reliably attach, and we do not want a GitHub PAT living
in a Railway webhook URL. The receiver holds the GitHub token server-side
(`GITHUB_DISPATCH_TOKEN`) and validates a Railway-side shared secret. The
`schedule` trigger is the backstop if a webhook is ever missed.

## Components

| Piece | Path | Notes |
| --- | --- | --- |
| Version endpoint | `apps/web/app/api/version/route.ts` | Full commit SHA, `no-store`. Distinct from `/api/deploy-info` (cached 60s, 7-char SHA). |
| Version reader | `apps/web/lib/deployInfo.ts` → `getVersionInfo()` | Reads `RAILWAY_GIT_COMMIT_SHA` (runtime-injected). |
| Webhook parse/decide | `apps/web/lib/release-monitor/railwayWebhook.ts` | Pure; tolerant of Railway payload drift. |
| GitHub dispatch | `apps/web/lib/release-monitor/githubDispatch.ts` | `repository_dispatch`; `fetch` injected. |
| Webhook receiver | `apps/web/app/api/internal/release-monitor/webhook/{route,_handler}.ts` | Auth via `checkAuth`-style secret + `?token=`. |
| Synthetic clinician | `apps/web/lib/release-monitor/syntheticClinician.ts` | Clerk Backend API + FAPI mint / warm-up / reach / cleanup. |
| Route set + classifier | `apps/web/lib/release-monitor/holderRoutes.ts` | The 6 routes + `analyzeNavigation`. |
| Orchestrator | `apps/web/lib/release-monitor/verify.ts` | Pure over injected probes; cleanup in `finally`. |
| Runner | `scripts/release-verify.ts` (`pnpm verify:release`) | Wires real I/O; runs `check:deploy`; exits 0/1. |
| Workflow | `.github/workflows/release-verify.yml` | Runs the runner; posts the commit status. |

## The checks

| Check | Critical? | Meaning |
| --- | --- | --- |
| `web_sha` | Critical **only** for a webhook run | Container-served commit vs the target. For a webhook run the target is the deploy commit (exact). For a scheduled run the target is main HEAD, and a lag can be a *benign non-web commit* (web isn't redeployed by an API/docs-only merge), so it is reported, not fatal. |
| `auth_resolving` | Reported | `GET /auth/resolving` → 200. 404 until the interstitial (#507) ships; the hard gate below is fix-shape-agnostic. |
| `synthetic_session` | Critical | A synthetic CLINICIAN session was minted. |
| `holder:cold-start` | Critical | A fresh session reaching `/holder` resolves (200) rather than bouncing to `/auth/error` — the direct P0 detector. |
| `holder:/holder…` (×6) | Critical | Each required surface returns 200, never passing through `/auth/error`, never looping. |
| `deploy_integrity` | Critical | `pnpm check:deploy` exits 0 (no cross-service drift). |

Overall = **fail** if any critical check fails.

## Durable signal

The primary durable record is a **GitHub commit status** on the verified SHA:

- context `vitalcv/release-verified`, state `success`/`failure`,
  `target_url` = the workflow run, description = e.g. `pass: holder 6/6`.
- Survives deploys, is keyed by SHA, and is queryable:
  `gh api repos/ctol3r/vitalcv/commits/<sha>/status`.

The GitHub Actions run itself (logs + job summary + red/green) is a second
durable record. Surfacing the status on the Ops Center (`/admin/platform`) is a
documented follow-up (see below) — the commit status is already queryable, so a
read-through card is a small later add.

## Owner wiring

None of this can be done from a code change — it needs the Railway dashboard and
repo/service secrets.

**1. Railway Project → Webhooks** — add:

```
https://vitalcv.com/api/internal/release-monitor/webhook?token=<RELEASE_WEBHOOK_TOKEN>
```

**2. Railway `vitalcv-web` service variables**

| Var | Purpose |
| --- | --- |
| `GITHUB_DISPATCH_TOKEN` | Fine-grained PAT, **contents: write** on `ctol3r/vitalcv`, to fire `repository_dispatch`. |
| `RELEASE_WEBHOOK_TOKEN` | Shared secret in the webhook URL. May reuse the existing `CRON_SECRET` instead (the receiver accepts it as a fallback). |

**3. GitHub repository secrets** (for the workflow)

| Secret | Purpose |
| --- | --- |
| `CLERK_SECRET_KEY` | Clerk Backend API — mint/cleanup the synthetic clinician. |
| `RAILWAY_API_TOKEN` | `check:deploy` GraphQL fallback (no linked CLI on the runner). |
| `CLERK_FAPI_URL` | Optional; defaults to `https://clerk.vitalcv.com`. |
| `RELEASE_PROBE_BASE` | Optional; defaults to `https://vitalcv.com`. |

`GITHUB_TOKEN` (automatic) posts the commit status — the workflow declares
`permissions: statuses: write`.

## Synthetic clinician + cleanup

The harness mints a real active Clerk session (Backend API create user → org →
`sign_in_tokens` → FAPI ticket redemption → active-org touch → `__session` JWT),
exercises the signed-in flow the way a browser does (manual redirect-following,
capturing the `vitalcv_role` cookie the flow mints), then **deletes the Clerk
user + org** — always, even on a mid-run failure (the runner passes the created
ids to `cleanupClinician` from a `finally`).

Every synthetic identity uses an `@vitalcv-monitor.local` email so it can never
collide with, or rebind (per #504), a real user row.

**Known residual:** the backend has no delete API for the `User` row it upserts
on first role-resolve, so each run leaves one orphan DB row (placeholder-pattern
email, non-colliding). A backend cleanup endpoint or a periodic reconciliation
sweep is a follow-up.

## Failure modes

- **Webhook missed / receiver briefly down** → the `*/30` scheduled run catches
  it. The signal is never stored in-process, so it can't be lost to the
  in-memory-store-resets race that affects the source-health probe.
- **Container hairpin** → avoided entirely by the external GitHub-runner vantage.
- **Benign SHA lag** (web not redeployed by a non-web commit) → `web_sha` is
  reported, not fatal, on scheduled runs; exact on webhook runs.
- **JWT 60s TTL** → the runner re-mints the session token before the route sweep.

## Runbook

- **Read the latest signal:** the `vitalcv/release-verified` commit status on
  main HEAD (GitHub commit view, or `gh api repos/ctol3r/vitalcv/commits/main/status`).
- **A red status** → open the linked run; the job summary lists the failing
  checks. `holder:*` red = the signed-in flow is broken for real clinicians
  (treat as a P0). `web_sha` red on a webhook run = the new code is not serving.
- **Re-run manually:** Actions → *Release verify* → *Run workflow* (optionally
  pass a `target_sha`).
- **Run locally against prod:**
  `CLERK_SECRET_KEY=… RAILWAY_API_TOKEN=… pnpm verify:release --out /tmp/r.json`
  (exits non-zero, and that is the honest signal, while the P0/`/auth/resolving`
  interstitial is unmerged).

## Follow-ups (not in this PR)

- Ops Center card at `/admin/platform` reading the commit status.
- Slack notification (`SLACK_WEBHOOK_URL`), status-doc committer.
- Backend cleanup endpoint / reconciliation sweep for the orphaned `User` row.
- Retire the now-redundant fixed-`sleep 120` smoke test in `deploy-web.yml`
  (this system supersedes its intent).
