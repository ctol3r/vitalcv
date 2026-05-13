# Final Operator Activation State

**Scope:** the operator-side checklist required to convert "code shipped"
into "verifier-visible reality." This document is descriptive of state
that operators control via Vercel / Railway / scheduled jobs, not of
state that an in-repo PR can change. Read alongside
`institutional-readiness-synthesis.md` §5.

## §1 — Apex Vercel env-var checklist

These env vars are required for apex `vitalcv.com` to fully serve
institutional verifier surfaces. Each row names the consumer of the var
and what fails when it is absent.

| Env var | Consumer | What fails when absent | Verification command |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `apps/web/middleware.ts` + Clerk SDK | All protected routes 500 / redirect-loop; `/api/health` reports `clerk.enabled: false` | `curl -s https://vitalcv.com/api/health \| jq .config.clerk` should return `{enabled:true, mode:"production"}` |
| `CLERK_SECRET_KEY` | `apps/web/middleware.ts:35` | Middleware enters `CLERK_MIDDLEWARE_ENABLED=false` fallback; protected routes redirect to `/sign-in` without working auth | (same as above; both must be set) |
| `VITALCV_ISSUER_ORIGIN` | `apps/web/lib/trust/wellKnownIdentity.ts` (on unmerged #349) | DID + JWKS + OID4VCI metadata emit a wrong `iss` based on `VERCEL_PROJECT_PRODUCTION_URL` fallback | After #349 merges: `curl -s https://vitalcv.com/.well-known/did.json \| jq .id` should return `did:web:vitalcv.com` |
| `RECEIPT_PRIVATE_KEY_JWK` | `apps/web/lib/crypto/receiptIssuer.ts:67-69` | Fresh ES256 keypair on every cold start; pre-redeploy JWTs fail verification | After #349 merges: `curl -s https://vitalcv.com/.well-known/jwks.json` `kid` field stable across two cold-start probes |
| `CRON_SECRET` and/or `MONITORING_SECRET` | probe runner at `apps/web/app/api/_probe/...` (or equivalent on the unmerged probe stack) | `LaneHealthMount` band renders four UNKNOWN seeds — this is the operator-reported "Unavailable" symptom | After scheduled runner active: `LaneHealthMount` band emits non-UNKNOWN states |
| `NEXT_PUBLIC_API_BASE` (optional but recommended) | `apps/web/lib/backend-url.ts:15` + `/api/health` `apiBase` field | Cosmetic: `apiBase: false` in `/api/health` even though backend reachability falls back to `https://api.vitalcv.com`. Several inline-resolver routes fall back to `localhost:4000` when this is unset (upstream-fetch-topology §A) | `curl -s https://vitalcv.com/api/health \| jq .config.apiBase` should return `true` |
| `BACKEND_URL` | `apps/web/lib/backend-url.ts:11`; also inlined into ~40 routes | When unset, inline-resolver routes fall back to `localhost:4000` and produce `fetch failed` on Vercel | Same probe as `NEXT_PUBLIC_API_BASE` |
| `NEXT_PUBLIC_BACKEND_URL` | Several inline resolvers (upstream-fetch §A) | Tertiary fallback in the resolver chain | (same chain) |
| `NEXT_PUBLIC_SENTRY_DSN` | observability | `sentry: false` in `/api/health`; runtime errors not captured | `curl -s https://vitalcv.com/api/health \| jq .config.sentry` returns `true` |
| `ALLOWED_CORS_ORIGINS` | `apps/web/middleware.ts:111-124` | All cross-origin API requests blocked (allowlist empty); same-origin still works | Cross-origin fetch from an allowed origin returns 200 instead of 403 |

**Operator activation verdict (env vars):** as of the operator probe in
`apex-deployment-forensics.md` (on unmerged PR), `apiBase`, `clerk.enabled`,
and `sentry` all read `false` on apex. Three of the ten env vars above
are demonstrably absent; the others have not been probed externally.

## §2 — Railway / Postgres state

| State | Why it matters | Verification |
|---|---|---|
| Demo NPI 1346053246 (Macie Miller, PA-C) seeded in production DB | Without it, the demo `/passport?npi=1346053246` flow renders "no profile" terminal state per gating-graph §3 | Run `psql -c "SELECT id FROM entity WHERE npi='1346053246';"` against the Railway production DB. If 0 rows: not seeded. |
| `verification_artifact` rows for `source='TRUST_STATE_ENGINE'` purged after #339 lands | The trust-state cache referenced in MEMORY.md memory entry; stale rows would mask the canonical readiness math | Run `DELETE FROM verification_artifact WHERE source='TRUST_STATE_ENGINE';` once #339 merges. |
| Prisma migrations for the replay-persistence stack (after `replay-topology-gap-analysis.md` §7 PRs land) | Without the migration, the `ReplayRun` / `Lineage` tables don't exist; lineageKey-keyed readers return 500 | `npx prisma migrate status` after engineering PRs ship. |

## §3 — Scheduled-job state

| Job | Schedule | Consumer | Verification |
|---|---|---|---|
| Probe runner (NPPES, OIG, PECOS, state-board freshness probes) | Every ~5–15 min | `getLaneSnapshots` feeding `LaneHealthMount` | Vercel cron dashboard shows the cron is `enabled: true` with non-error last-run timestamp |
| Replay reconciliation | Hourly (TBD when the replay reader PRs land) | Continuity reconciler endpoint (not yet implemented) | Job exists in Vercel cron and last run < 65 min ago |
| Edge cache purge after deploy | On each deploy of #339-equivalent | Trust-state cache invalidation | Manual probe of `/api/health` shows fresh `timestamp` after deploy |

**Operator activation verdict (jobs):** zero of the three job categories
above are confirmed scheduled on apex. The probe runner is the most
load-bearing because it directly drives the operator-reported
"Unavailable" lane symptom (per `runtime-gating-graph.md` §6).

## §4 — Deployment / propagation strategy

Per `apex-deployment-forensics.md` (on unmerged PR): apex is on the
`vitalcv` Vercel project, deploying `apps/web`. The marketing app is a
separate Vercel project on a different domain. When PRs #338–#358 land
on `origin/main`, Vercel will auto-deploy.

| Strategy item | Current state |
|---|---|
| Auto-deploy from `origin/main` | Enabled (per `gh pr checks` showing `Vercel – vitalcv` succeeding on PR previews) |
| Preview deployments per PR | Enabled (same evidence) |
| Promote-on-merge | Implied by auto-deploy |
| Rollback strategy | Not documented in repo; Vercel deployment-history rollback assumed |
| Cache-purge on deploy | Assumed default Vercel CDN behavior; explicit purge for SD-JWT / JWKS not configured |
| Production-promotion gate (Codex SAFE) | Operator-side per wave-execution skill |

## §5 — Operator activation truth verdict

Of the four operator-controlled state categories (env vars, DB state,
scheduled jobs, deployment), **none is confirmed fully active on apex**
as of the most recent probe carried in repo. The order in which an
operator should close them, for fastest visible verifier convergence:

1. **Env vars** (~30 min via Vercel dashboard) — closes `clerk.enabled`,
   `apiBase`, `sentry`, `VITALCV_ISSUER_ORIGIN`, `RECEIPT_PRIVATE_KEY_JWK`.
2. **Codex SAFE on PRs #338–#358** then merge — lands the canonical
   routes on `origin/main`. Vercel auto-deploys.
3. **Probe runner cron** in Vercel dashboard — closes the operator-reported
   "Unavailable" lane symptom.
4. **Railway demo seed** — closes the `/passport?npi=…` demo flow.
5. **Engineering PRs for replay persistence** (per
   `replay-topology-gap-analysis.md` §7) then operator runs migrations —
   closes the lineageKey persistence + reader gap.

None of these five steps require any new product design; all are
named in prior audits. The closure path is operationally finite.
