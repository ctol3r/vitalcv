# PR #423 Deployment Gap — Diagnosis 2026-05-27

## Question

Was PR #423 (`fix(api): align NPPES source_complete truth state on main`) deployed to `delightful-essence` after its merge to `main`?

## TL;DR

**Yes — PR #423 IS deployed live on `api.vitalcv.com`.** Earlier observation of "not yet live" was Railway auto-deploy lag (between 20:53Z merge and 03:18Z verification — ~6.4 hours). No build failure, no branch mismatch, no runtime failure.

A separate "Deploy health probe" GitHub Actions workflow DID fail on the #423 push, but it failed because the `CRON_SECRET` repository secret is not configured for that workflow. The workflow exited at the secret-check step **before** attempting any probe of the live service. This is a pre-existing CI configuration issue, unrelated to the Railway deployment.

## Evidence

### `main` head (2026-05-27 03:18Z)

```
$ git log --oneline -3 origin/main
9f272c80c fix(api): align NPPES source_complete truth state on main (#423)
fe9c6f9c1 fix(api): repair Railway build module resolution (#421)
7f1cfb050 fix(deploy): remove Vercel coupling, prepare Railway-native deploy (#415)
```

### PR #423 merge commit on `main`

```
$ git branch --contains 9f272c80ce842366a4ee43274b6584668c0a9e0c -r
  origin/HEAD -> origin/main
  origin/main

$ gh pr view 423 --json mergedAt,mergeCommit,state
{
  "mergeCommit": {"oid": "9f272c80ce842366a4ee43274b6584668c0a9e0c"},
  "mergedAt":   "2026-05-26T20:53:43Z",
  "state":      "MERGED"
}
```

### Live API state (2026-05-27 03:18Z)

```
$ curl -fsS https://api.vitalcv.com/health
{
  "status": "ok",
  "metrics": {
    "total_requests": 13,
    "error_requests": 0,
    "avg_latency_ms": 27.97,
    "p90_latency_ms": 73.08,
    "max_latency_ms": 94.48
  },
  "git_branch": "main",
  "git_sha":    "9f272c80ce842366a4ee43274b6584668c0a9e0c"
}
```

`git_sha` matches the PR #423 merge commit exactly. **Deployed.**

### `api.vitalcv.com` root

```
$ curl -fsS https://api.vitalcv.com/
{"name":"VitalCV API","version":"mvp"}
```

API responding normally.

### Web `/api/health` view of the API backend

```
$ curl -fsS https://vitalcv-web-production.up.railway.app/api/health
{
  "status": "ok",
  "service": "web",
  "timestamp": "2026-05-27T03:19:03.858Z",
  "backend": {
    "url":    "https://api.vitalcv.com",
    "status": "degraded"
  },
  "config":  {"apiBase": true, "clerk": {"enabled": true, "mode": "production"}, "sentry": false}
}
```

`backend.status: "degraded"` is the web app's *own* assessment of the API backend health, computed by the web's `/api/health` route. The API itself reports `status: "ok"` with `error_requests: 0`. This discrepancy is not a deployment failure of #423; it's the web's degradation classifier disagreeing with the API's self-report. Likely a stale snapshot or a check-shape mismatch. **Not a PR #423 blocker.**

### Local build smoke on `main`

Run 2 (2026-05-26 ~20:55Z, captured in `docs/ops/api-main-build-smoke.md`):

```
pnpm install --frozen-lockfile      → lockfile unchanged
pnpm turbo run build --filter @vitalcv/api --force
                                    → Tasks: 15 successful, 15 total; 0 cached; 15.14s
pnpm --filter @vitalcv/api exec tsc -p backend/tsconfig.json --noEmit → clean
pnpm lint                           → Tasks: 2 successful, 2 total
```

**`@vitalcv/api` builds clean on the same SHA that's live in production.** No reproduction of a build failure.

### The "Deploy health probe" CI failure

```
$ gh run list --branch main --limit 10
… completed  failure  fix(api): align NPPES source_complete truth state on main (#423)  Deploy health probe  main  push  2026-05-26T20:53:46Z

$ gh run view 26474550050 --log | tail
…
##[error]CRON_SECRET secret is not configured for this workflow.
##[error]Process completed with exit code 1.
```

The workflow runs `if [ -z "$CRON_SECRET" ]; then echo "::error::CRON_SECRET secret is not configured for this workflow."; exit 1; fi` BEFORE attempting any HTTP probe. The failure is a missing repository secret in GitHub Actions settings — a pre-existing CI configuration issue, **not** a Railway deployment failure. The same workflow has been failing every ~30 minutes on the `Source Health Probe` schedule for the same reason; that pattern predates this batch.

## Likely Railway sequence (best inference, no Railway settings inspected)

1. **20:53:43Z** — PR #423 squash-merged to `main`. Push event triggers Railway watcher.
2. **20:53:46Z** — GitHub Actions `Deploy health probe` workflow runs on the push; immediately fails at `CRON_SECRET` check (unrelated to Railway).
3. **20:54:58Z** — Web `/api/health` polled; backend `git_sha` still `fe9c6f9c1` (#421). Railway build queued or in flight.
4. **~03:18Z next day** — `api.vitalcv.com/health` polled; backend `git_sha` is now `9f272c80c` (#423). **Auto-deploy succeeded.**

The lag between 20:53Z merge and the next observation of the new SHA is ~6.4 hours. We did not poll between those two windows, so we cannot pinpoint when the deploy actually flipped over.

## Classification

`api.vitalcv.com` is **API BUILD REPAIR LIVE + NPPES TRUTH-STATE PATCH LIVE**. Not a deployment gap.

## Recommended operator action

1. **None required for #423 deployment.** It is live.
2. **Run authenticated SSE smoke for NPI 1699264564** — this is the next gate that moves NPPES truth-state from "deployed" to "validated live". See `docs/ops/authenticated-sse-smoke-runbook.md`.
3. **Configure `CRON_SECRET`** in repository Actions settings to fix the `Deploy health probe` and `Source Health Probe` workflows. Optional; their failure is cosmetic noise, not a deploy gate.
4. **Investigate the `backend.status: "degraded"`** signal in the web's `/api/health`. The API self-reports healthy; this discrepancy is the web app's degradation classifier disagreeing. Likely a stale cache or a check-shape mismatch. Not blocking, but worth fixing for observability hygiene.

## Audit trail

- Diagnosis date: 2026-05-27 03:18Z
- Verifying commit on `main`: `9f272c80ce842366a4ee43274b6584668c0a9e0c`
- API SHA confirmed: `9f272c80ce842366a4ee43274b6584668c0a9e0c`
- No code change, no Railway settings change, no env/secret/DNS mutation made during this diagnosis.
