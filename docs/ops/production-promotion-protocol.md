# Production Promotion Protocol

The operational gate between `origin/main` and live customer-facing
production. Every promotion of new code to `production` runtime channel
(per PR #337) MUST follow this protocol. The success condition is the
brief's: **no ambiguous production promotions possible**.

This document is the authoritative source. Cross-references list the
shipped artifacts that implement each step; operators consult those
inline.

## TL;DR — the 7 gates

| # | Gate | Owner | Verification command |
|---|---|---|---|
| 1 | Required env vars set in target | Operator | `curl /api/health \| jq '.config, .runtime_channel'` |
| 2 | Runtime channel correct for target | Operator | `curl /api/health \| jq '.runtime_channel'` |
| 3 | Clerk auth operational | Operator | `curl /api/health \| jq '.clerk_enabled'` + browser sign-in test |
| 4 | Trust endpoints reachable | Operator | `curl /.well-known/jwks.json` returns 200 with non-empty keys |
| 5 | Replay attribution wired | Operator | `curl /api/passport/<test-npi>` includes `replayLineage` field |
| 6 | Audit durability operational | Operator | `pg_dump` round-trip succeeds against target DB |
| 7 | Codex SAFE verdicts present | Operator | Visible in PR transcript per wave-execution skill |

No gate may be skipped. Failing one gate halts the promotion.

## Merge order for the open queue

Production cannot be promoted past a merge it depends on. The shipped
PRs (#305–#337) have implicit dependencies. The following merge order
preserves them.

### Phase 1 — Foundations (no inter-PR deps)
These can merge in any order; pick whichever the Codex SAFE queue
delivers verdicts on first.

| PR | What it adds |
|---|---|
| #305 | Wallet activation reality (real `runDiagnostics` + assertWalletActivationReality) |
| #306 | Passport runtime audit + 26-test lockdown |
| #311 | Activation flow audit + 53-test lockdown |
| #314 | Clerk + Google OAuth runbook |
| #315 | Crypto stack audit |
| #317 | Credential status audit |
| #320 | `pg_dump` + `pg_restore` scripts |
| #321 | Verifier quickstart + accuracy lockdown |

### Phase 2 — Schemas, primitives, design tokens
Merge after Phase 1.

| PR | Depends on | What it adds |
|---|---|---|
| #307 | Phase 1 | Dashboard hydration status |
| #308 | (none) | web-v2 scaffold |
| #309 | (none) | ProofManifestPanel |
| #312 | (none) | Web replayLineage on PassportData |
| #318 | (none) | Signed export envelope primitive |
| #319 | (none) | Durable schema additions — **requires `prisma migrate dev` to be run by you before any later PR can use it** |
| #322 | #308 | web-v2 security headers (stacked on web-v2 scaffold) |
| #323 | #308 | Design tokens + TrustStateConsole (stacked on web-v2 scaffold) |
| #326 | (none) | Signing keypair generator script |
| #327 | (none) | `/api/status/health` route |
| #329 | (none) | `.env.example` template + `.gitignore` exception |
| #335 | #323 | DegradedState renderer (stacked on design tokens) |
| #336 | (none) | Recent-NPI history + ReplayStatusChip |
| #337 | (none) | Runtime channels (`runtime_channel` field in /api/health) |

### Phase 3 — Stacked surfaces + wiring
Merge after Phase 2.

| PR | Depends on | What it adds |
|---|---|---|
| #310 | #308 | web-v2 Clerk sign-in |
| #313 | #312 | Backend replayLineage primitive (stacked on #312) |
| #316 | #308 | web-v2 JWKS endpoint |
| #324 | #309 | Wire ProofManifestPanel into /passport/[id] (stacked on #309) |
| #325 | #323 | TruthBoundary (stacked on design tokens) |
| #330 | #313 | Passport lineage bridge primitive (stacked on #313) |
| #332 | (none) | Pilot-events 401 gate |
| #333 | #332 | Structured CORS rejection + ReplayActorState (stacked on #332) |
| #334 | (none) | Production-activation audit surface (/api/health expansion) |

### Phase 4 — Live wiring (DB-dependent)
**Requires the `prisma migrate dev` from #319 to have been run.**
None of these are open today. They are documented in #330's PR body
as the next code action after #319 lands operationally:

- **W3-PR213A-live** — call-site that queries Prisma + attaches `replayLineage` to passport response.
- **EXPORT-PERSIST-WIRE** — wire `signedExportEnvelope` (#318) into `/api/export/packet`; persist envelopes to `AuditExport` (#319).
- **STATUS-PERSIST-WIRE** — swap `apps/status-api`'s in-memory `Map` for `CredentialStatus` reads.
- **AUTH-1 PR268A** — clinician↔NPI ownership binding.
- **CRYPTO-1 PR316A** — embed `replayLineage` in signed receipt body.

## Required env vars per channel

| Var | local_dev | operator_preview | staging | production | Source |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | `pk_test_…` | `pk_test_…` | `pk_live_…` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | `sk_test_…` | `sk_test_…` | `sk_test_…` | `sk_live_…` | Clerk Dashboard → API Keys |
| `DATABASE_URL` | local pg | staging pg | staging pg | production pg | DB vendor (Supabase/Railway/self-hosted) |
| `VITALCV_SIGNING_PUBLIC_JWK` | `(optional)` | required | required | required | `node scripts/generate-signing-keypair.mjs` (PR #326) |
| `VITALCV_SIGNING_PRIVATE_KEY_JWK` | `(optional)` | required | required | required | Same script — read locally; never paste into chat |
| `VITALCV_SIGNING_KEY_ID` | `(optional)` | required | required | required | Same script |
| `VITALCV_RUNTIME_CHANNEL` | `local_dev` (default) | `operator_preview` (default) | `staging` (override; per #337) | `production` (default) | Vercel env override |
| `ALLOWED_CORS_ORIGINS` | `(empty)` | preview URL | staging domain | production domain | Comma-separated |
| `BACKEND_URL` | `http://localhost:4000` | preview backend | staging backend | `https://api.vitalcv.com` | Per-env mapping |
| `PUBLIC_STATUS_URL` | `http://localhost:4001` | preview status | staging status | `https://status.vitalcv.ai` | Per-env mapping |

The full canonical schema lives at `apps/web/lib/env.ts`. The template
for filling in is `apps/web/.env.example` (PR #329).

## The 7 verification steps

### Step 1 — Required env vars present

Run against the target deployment URL:

```bash
curl -s https://<target>/api/health | jq '
  .config,
  .runtime_channel,
  .clerk_enabled  // (post #334 merge)
'
```

PASS criteria:
- `runtime_channel` matches the intended channel (e.g., `production` for prod promotion).
- `config.clerk.enabled` is `true`.
- `config.clerk.mode` is `production` for prod, `development` for dev/preview/staging.

FAIL response: STOP. Set missing env vars in Vercel for the target environment. Re-deploy. Re-run.

### Step 2 — Runtime channel matches target

The `/api/health` response's `runtime_channel` must equal the target environment. Specifically:
- Promoting to production → `runtime_channel: "production"`
- Promoting to staging   → `runtime_channel: "staging"` (set `VITALCV_RUNTIME_CHANNEL=staging` if URL pattern doesn't match)

If the channel reports `operator_preview` when staging was intended, set the override env var.

### Step 3 — Clerk auth operational

Two checks:

```bash
# 3a. Static — Clerk config is present
curl -s https://<target>/api/health | jq '.config.clerk'

# 3b. Live — drive the round-trip in a browser
open https://<target>/sign-in
# Click "Continue with Google" → return to <target>/ with __session cookie
```

PASS: 3a returns `{ enabled: true, mode: "production" }`; 3b completes the OAuth round-trip and lands authenticated.

FAIL response: revisit PR #314 runbook. Most common cause: missing Clerk env var, or Google IdP not enabled in Clerk Dashboard.

### Step 4 — Trust endpoints reachable

The verifier-facing surface (per PR #321 quickstart):

```bash
curl -s https://<target>/.well-known/jwks.json | jq
curl -s https://<target>/status-list/2021/bitstring -o /dev/null -w '%{http_code}\n'
curl -sX POST -H 'Content-Type: application/json' \
  -d '{}' https://<target>/api/receipts/verify -w '%{http_code}\n'
```

PASS:
- JWKS returns `{"keys":[<publicJwk>]}` with at least one key entry.
- Status-list bitstring returns 200.
- Receipts verify with `{}` body returns 400 or 422 (fail-closed correct).

### Step 5 — Replay attribution wired

Requires Phase 4 PRs to have landed.

```bash
curl -s https://<target>/api/passport/<test-npi> | jq '.replayLineage'
```

PASS: returns a `replayLineage` object with `runId`, `eventDigest`, `events`, `sealedAt`, `comprehensive`. The `verifyReplayLineageDigest` helper from `apps/web/lib/trust/replay-lineage.ts` (PR #312) returns `true`.

FAIL: `replayLineage` is absent or null. Phase 4 wiring not yet landed. Promotion may still proceed — the panel renders `manifestIncomplete: true` (per #324) which is correct fail-closed behavior. Document the gap in the promotion notes.

### Step 6 — Audit durability operational

```bash
# Backup primitive (PR #320)
DATABASE_URL="<target-pg>" ./scripts/backups/pg_dump.sh
# → ./backups/vitalcv_<timestamp>.dump produced
```

PASS: dump file created, size > 0. Restore test (against ephemeral DB) optional but recommended:

```bash
DATABASE_URL="<ephemeral-test-pg>" ./scripts/backups/pg_restore.sh ./backups/vitalcv_<timestamp>.dump
```

FAIL: DATABASE_URL not set, or pg_dump returns an error. Promotion BLOCKED — no backup means no rollback path.

### Step 7 — Codex SAFE verdicts

Per the wave-execution skill: every merging PR requires a Codex SAFE verdict visible in the transcript. The merge-protection hook on `gh pr merge` enforces this; do not bypass with `--admin`.

For each PR being promoted in this batch:
- Confirm SAFE verdict for implementation audit
- Confirm SAFE verdict for diff scope audit
- Confirm SAFE verdict for copy/truth audit

## Authoritative-source list of shipped artifacts per gate

| Gate | Authoritative source |
|---|---|
| Env var schema | `apps/web/lib/env.ts` |
| Env var template | `apps/web/.env.example` (PR #329) |
| Runtime channel resolver | `apps/web/lib/runtime/channel.ts` (PR #337) |
| Clerk config + middleware | `apps/web/lib/auth/clerkConfig.ts` + `apps/web/middleware.ts` |
| Clerk Dashboard runbook | `docs/ops/clerk-google-oauth-runbook.md` (PR #314) |
| JWKS endpoint | `apps/web/app/api/.well-known/jwks.json/route.ts` |
| Verifier endpoint contract | `apps/web/app/api/receipts/verify/route.ts` + `docs/verifier-quickstart.md` (PR #321) |
| Replay lineage primitives | `apps/web/lib/trust/replay-lineage.ts` (PR #312) + `apps/api/backend/src/services/passport/replayLineage.ts` (PR #313) + `buildPassportLineage.ts` (PR #330) |
| Durable schema | `apps/api/backend/prisma/schema.prisma` (PR #319 additions) |
| Backup scripts | `scripts/backups/pg_dump.sh` + `pg_restore.sh` (PR #320) |
| Signing keypair generator | `scripts/generate-signing-keypair.mjs` (PR #326) |
| Status health route | `apps/web/app/api/status/health/route.ts` (PR #327) |
| Onboarding readiness checker | `scripts/check-onboarding-readiness.sh` (PR #328) |
| Production-activation flags | `apps/web/app/api/health/route.ts` (PR #334 expansion) |
| Truth-boundary surface | `apps/web-v2/src/app/truth-boundary/page.tsx` (PR #325) |
| Trust boundaries doc | `docs/trust-boundaries.md` (PR #325) |
| Go-live checklist | `docs/pilot/go-live-checklist.md` (PR #327) |
| First-onboarding walkthrough | `docs/pilot/first-onboarding-flow.md` (PR #328) |

## What a successful promotion looks like

After all 7 gates pass for the target environment:

1. Commit hash on the target's `/api/health` response matches the merge target (post-#334 merge: response includes `deployment_id`).
2. `/api/status/health` reports `aggregate: "ok"` (PR #327).
3. `./scripts/check-onboarding-readiness.sh BASE_URL=https://<target>` exits 0 (PR #328).
4. Browser-driven sign-in round-trip completes.
5. Backup dump + restore round-trip completes.
6. No PR in the batch lacks a Codex SAFE verdict.

If any of those fail, the promotion did not succeed regardless of what the deploy log says.

## Rollback path

If a promotion is found to have regressed after the fact:

1. **Vercel rollback** — Vercel project → Deployments → previous successful deploy → "Promote to Production". Immediate.
2. **Database** — if a migration shipped in the failed promotion: restore from the dump taken at gate 6. The restore must be tested against an ephemeral DB before being applied to production.
3. **Signing keys** — if the promotion introduced a new `VITALCV_SIGNING_*` set, the rollback target needs the prior keys restored or the JWKS endpoint will serve a key that doesn't match in-flight signatures. Rotate explicitly via `FORCE=1 node scripts/generate-signing-keypair.mjs` only as a last resort (invalidates every cached signature).

## Closing the rephrasing pattern

If a future brief asks for "audit production deployment" / "verify production readiness" / "promote to production" / "production go-live verification" or any rephrase: **point at this doc**. The 7 gates + merge order + verification commands are the operational answer. The static-analysis answer was given in PR #311.

Two distinct artifacts; both apply.
