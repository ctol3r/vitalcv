# PR-α Deployment Risk Summary

**Scope:** safety profile of PR-α (`wave/replay-alpha-foundation`),
which adds the minimum durable replay-run + replay-event persistence
infrastructure plus four reader endpoints.

This doc lives inside the PR. Operator reading order: this doc → PR
description → migration SQL → routes file. Each subsequent file is
shorter than the prior.

## §1 — Migration scope

The migration `apps/api/backend/prisma/migrations/20260513120000_replay_run_persistence/migration.sql`
contains EXACTLY two `CREATE TABLE` statements and five `CREATE INDEX`
statements. No `ALTER TABLE`, no `DROP`, no `UPDATE`, no `DELETE`, no
schema-rename, no FK addition to existing tables.

Tables added:
- `ReplayRun` (runId UNIQUE, lineageKey, entityId, channel, checkedAt, artifactChecksums[], payloadDigest, recordedBy, createdAt)
- `ReplayEvent` (replayRunId FK → ReplayRun.id ON DELETE CASCADE, sequenceNumber, eventType, checksum, occurredAt, payload JSONB, createdAt, UNIQUE(replayRunId, sequenceNumber))

Indexes added (none on existing tables):
- `ReplayRun_lineageKey_idx`
- `ReplayRun_entityId_idx`
- `ReplayRun_checkedAt_idx`
- `ReplayEvent_replayRunId_idx`
- `ReplayEvent_eventType_idx`

The only reference to an existing table is `ReplayEvent.replayRunId →
ReplayRun.id`, which is INTERNAL to the new pair — it does not bind
into any pre-existing table.

## §2 — Runtime isolation boundaries

| Concern | State |
|---|---|
| Pre-existing routes modified | NONE |
| Pre-existing services modified | NONE — `replayIdentity.ts` is a new module in a new directory `apps/api/backend/src/services/replay/` |
| Pre-existing model relationships changed | NONE — no FK added FROM existing tables TO `ReplayRun`/`ReplayEvent` |
| Existing flows touching the new tables | NONE — writer is exported but not called anywhere |
| Boot sequence dependency on new tables | NONE — `apps/api/backend/src/index.ts` does not import the new module; only `app.ts` registers the new HTTP routes, which are exercised only on explicit caller request |
| Backend startup if migration not applied | UNAFFECTED — startup does not query the new tables |
| Existing ingest path side-effects | NONE — no writer wired in |

The only added line in `apps/api/backend/src/app.ts` is one
`import` + one `registerReplayRoutes(app)` call, sequenced adjacent
to the existing `registerAuditReplayRoutes(app)` call. The new
registration adds 4 GET routes; it does NOT replace any existing
route, mount middleware, or alter route precedence.

## §3 — Rollback characteristics

| Scenario | Rollback path |
|---|---|
| Migration applied, code shipped, decision to revert | `DROP TABLE "ReplayEvent"; DROP TABLE "ReplayRun";` — fully reverses the migration without touching any existing data. The `ON DELETE CASCADE` on `ReplayEvent.replayRunId` ensures the order is safe. |
| Code shipped, migration not yet applied | All four new routes return 503 `replay_infrastructure_unavailable` (see §4). No 500s, no crashes. |
| Code reverted, migration left in place | The empty tables persist; no impact. Future code may re-introduce them or leave them dormant. |
| Partial deploy (backend updated, web not) | Web proxies don't exist yet → 404 from web router. No regression. |
| Partial deploy (web updated, backend not) | Web proxies call backend; backend 404s the unknown path → web proxy returns 502/503. No data corruption. |

There is NO data-migration step. The tables start empty and stay
empty until a writer is wired in (separate PR).

## §4 — Failure characteristics

Each backend route handler has a try/catch with TWO distinct catch
paths:

1. **`isPrismaTableMissingError(err)` returns true** (Prisma `P2021`
   or a "relation does not exist" message) → 503 with
   `{ error: 'replay_infrastructure_unavailable', detail: "Apply the REPLAY-PERSIST-α migration." }`
2. **Any other error** → 500 with `{ error: 'internal_error' }` + log
   line `replay_run_fetch_failed` / `replay_lineage_fetch_failed` /
   `replay_run_integrity_failed` / `replay_lineage_receipt_fetch_failed`

Web App Router proxies have additional resilience:

- Input validation against `run_v1_<16 hex>` / `lin_v1_<16 hex>` before
  any backend call → malformed input returns 400 without a backend round trip
- `AbortSignal.timeout(8000)` on all upstream fetches → bounded round trip
- `try/catch` around fetch → upstream-unavailable returns 503 with stable error code

No new route can crash the existing runtime. No new route is a startup
dependency. No new route is required by any pre-existing handler.

## §5 — Additive-only guarantees

| Guarantee | Evidence |
|---|---|
| No existing API contract changes | `git diff --stat` shows zero modifications to existing route files; new files only, plus one comment-adjacent line in `app.ts` |
| No existing test expectations changed | No test file modified |
| No existing model field added/removed/renamed | Prisma schema diff is purely additive (two new models appended at end of file) |
| No env-var requirement added | New code reads from `prisma` client only; no new `process.env.*` reads |
| No new dependency added to `package.json` | All imports use existing dependencies: `node:crypto`, `express`, `prisma` |
| No new build step | TS compilation picks up the new files automatically; no Prisma generator config change |

## §6 — Verification log (this PR)

| Check | Result |
|---|---|
| `npx prisma generate` | OK |
| Backend Jest on new test suite | 21/21 passing (replay-identity determinism, discrimination, integrity, payload-digest, prefix conventions, known-vector pin) |
| Backend `tsc --noEmit` | Clean |
| `pnpm turbo run build --filter @vitalcv/web` | 13/13 successful (web App Router proxies build) |
| Banned-strings scan | CLEAN across all new code + this doc |
| Migration syntax | Valid PostgreSQL DDL; no PG-specific syntax outside what existing migrations use |

## §7 — What this PR explicitly does NOT do

- Does NOT wire any writer into the existing ingest / passport /
  trust-state flow. No existing call path produces a `ReplayRun` row.
- Does NOT sign or issue any ES256 receipt. The receipt-derivation
  endpoint returns only the deterministic inputs (`runId`,
  `lineageKey`, `payloadDigest`, derived `jti`) — signing remains the
  responsibility of a separate handler.
- Does NOT add UI primitives or trust-page integration.
- Does NOT alter any apex Vercel env requirement.
- Does NOT bind into the in-flight verifier-continuity stack
  (#345 / #349 / #355) — these routes are mounted at
  `/api/replay/...`, `/api/lineage/[lineageKey]/runs`, and
  `/api/receipt/by-lineage/[lineageKey]`. The last path explicitly
  uses the `by-lineage/` segment to avoid the Next.js slug collision
  with the planned `/api/receipt/[npi]` from #349.

## §8 — Operator deploy checklist

1. Review the migration SQL — purely additive.
2. Merge the PR.
3. Railway deploys: Prisma `migrate deploy` applies the new tables.
   - On success: empty `ReplayRun` + `ReplayEvent` tables exist; the
     four new routes start serving 404 (no rows) and 200 (when rows
     are seeded by a follow-up PR's writer).
   - On migration failure: Railway deploy halts; new code never
     reaches production. Roll forward with the fix; no data risk.
4. Smoke test post-deploy: `curl https://api.vitalcv.com/api/replay/runs/run_v1_0000000000000000` → expect 404 `replay_run_not_found`.
5. Smoke test fallback: if migration unapplied, the same curl returns 503 `replay_infrastructure_unavailable` (graceful).

## §9 — Summary verdict

PR-α is safely deployable additive persistence infrastructure:

- Migration is pure-additive (two new tables, no existing data touched).
- New code has zero existing-flow dependencies.
- Replay routes fail gracefully (503 with a stable error code) when
  the migration has not yet been applied.
- Web proxies are isolated, input-validated, bounded by timeout, and
  do not regress any existing surface.
- Rollback is a two-line `DROP TABLE` if needed.
- No new env vars, no new dependencies, no new boot dependencies.

The remaining replay continuity work (writer integration into the
ingest path, ES256 receipt signing keyed by deterministic jti,
continuity reconciler, receipt-issuance persistence) is sequential
and unblocked by this PR.
