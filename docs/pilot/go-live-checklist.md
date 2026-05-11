# VitalCV Pilot Go-Live Checklist

The operator-side actions required before onboarding the first institutional
pilot user. Every item below is either:
- **Repo-side** — already shipped or pinned by lockdown; no further work.
- **Operator-side** — you must do this locally or in a vendor dashboard.
- **Verifiable** — there is a code surface that proves whether the item is
  done.

Pair this checklist with `/api/status/health` (PR416A) — that endpoint reports
which subsystems are configured and which are degraded, without exposing any
secret values.

## Pre-flight (operator-side, in order)

### 1. Clerk OAuth configured
- Follow `docs/ops/clerk-google-oauth-runbook.md` (PR #314): 7-step Dashboard
  + Google Cloud Console + env-var setup.
- **Verify**: `curl http://localhost:3000/api/status/health` → the
  `clerk-auth` subsystem reports `present: true` with a `publishableKeyPrefix`
  of `pk_test_` (dev) or `pk_live_` (prod).

### 2. ES256 signing key configured
- Run `node scripts/generate-signing-keypair.mjs` locally (PR #326).
  Generates a P-256 keypair, writes private to `./keys/` (gitignored),
  prints public JWK + kid to stdout.
- Paste into `.env.local` (dev) AND Vercel project env (production Server
  scope):
  - `VITALCV_SIGNING_PUBLIC_JWK`
  - `VITALCV_SIGNING_PRIVATE_KEY_JWK`
  - `VITALCV_SIGNING_KEY_ID`
- **Verify**: `/api/status/health` → `es256-signing` subsystem reports
  `present: true`. Independently: `curl /.well-known/jwks.json` → response
  carries `X-JWKS-Status: ok` (PR #316).

### 3. DATABASE_URL configured
- Create a Postgres database (Supabase, Railway, or self-hosted).
- Add the **pooled** URL to `.env.local` and Vercel env (production).
- Run the durable schema migration locally (PR #319):
  ```
  pnpm --filter vitalcv-backend exec prisma migrate dev \
    --name durable_enterprise_runtime
  ```
- Commit the generated migration SQL.
- **Verify**: `/api/status/health` → `database` subsystem reports
  `present: true`.

### 4. HTTPS operational
- Add your production domain to Vercel.
- Vercel handles HTTPS automatically once DNS resolves.
- **Verify**: `curl -I https://<your-domain>/.well-known/jwks.json` returns
  HTTP/2 200.

### 5. JWKS publicly reachable
- Already gated by step 2. JWKS endpoint at `apps/web/app/api/.well-known/jwks.json`
  (production) or `apps/web-v2/src/app/.well-known/jwks.json/route.ts`
  (sandbox, PR #316).
- **Verify**: `curl -I https://<your-domain>/.well-known/jwks.json` returns
  `X-JWKS-Status: ok`.

### 6. Replay continuity verified
- Web side: PR #312 ships `replayLineage` on `PassportData`. **Backend
  population is pending W3-PR213A** — without it, the passport response
  has no `replayLineage` field and the panel renders ambiguity-visible
  (correct fail-closed behavior).
- **Verify**: hit `/api/passport/<npi>` and look for `replayLineage` in
  the response. Until W3-PR213A lands, absence is expected.

### 7. Revocation continuity verified
- `apps/status-api` exposes 5 routes (PR #317 audit). Persistence is
  in-memory today; durable storage lands when STATUS-PERSIST-WIRE wires
  `CredentialStatus` from PR #319.
- **Verify**: `curl <status-api>/status-list/status/test-credential-id`
  should return a fail-closed "not found" until a real credential is
  registered.

### 8. Backups operational
- Backup primitive shipped in PR #320: `scripts/backups/pg_dump.sh`.
- Run it manually now to test:
  ```
  DATABASE_URL="postgresql://…" ./scripts/backups/pg_dump.sh
  ```
- For production: schedule a daily cron (Vercel cron jobs, GitHub Actions,
  or your monitoring vendor).

### 9. Recovery verification operational
- Restore primitive shipped in PR #320: `scripts/backups/pg_restore.sh`.
- **Verify**: take a dump, restore it into an ephemeral DB, run a row-count
  query against both. See `docs/ops/credential-status-stack-audit.md` for
  the verification recipe.

## Institutional semantics (already enforced; no operator action)

- **Fail-closed verification**: `/api/receipts/verify` returns 422 on
  failure; verifiers receiving 422 MUST reject (PR #321 quickstart).
- **Explicit degraded-state visibility**: `/api/status/health` reports
  `aggregate: 'degraded' | 'absent'` when subsystems are unconfigured.
  `/truth-boundary` (PR #325) shows operational state to compliance officers.
- **Append-only replay lineage**: `CredentialStatusHistory` (PR #319) and
  `replayLineage` (PRs #312/#313) are both append-only by design.
- **Replay-safe presentation flows**: `VerifierNonce` table exists on the
  Prisma schema today; nonce reuse is rejected at the verifier.

## Pilot go-live verdict

Read `/api/status/health` once everything above is configured. Aggregate
`'ok'` = all subsystems configured. Aggregate `'degraded'` = some configured,
some not — see `degradedSubsystems` array. Aggregate `'absent'` = nothing
configured (fresh deploy).

Do NOT go live with aggregate `'degraded'` unless you have a documented
reason for each degraded subsystem.

## Related PRs

- #314 — Clerk OAuth runbook
- #316 — Web-v2 JWKS endpoint (sandbox)
- #319 — Durable schema additions
- #320 — pg_dump + pg_restore scripts
- #321 — Verifier quickstart
- #325 — TruthBoundary surface
- #326 — Signing keypair generator
- **PR416A (this PR)** — Status health route + this checklist
- W3-PR213A — Backend replayLineage wiring (pending)
- EXPORT-PERSIST-WIRE, STATUS-PERSIST-WIRE — wiring follow-ups (pending)
