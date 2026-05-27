# NPPES Source Health — Next Engineering Wave

Wave spec — written after PR #423 (`fix(api): align NPPES source_complete truth state on main`) merged to `main` as `9f272c80c` on 2026-05-26 20:53Z. Docs-only; not yet a `fix/` branch.

## Current known states (2026-05-27)

| State | Status | Evidence |
|---|---|---|
| **Frontend no-payload copy** | live | PR #419 (`fix(passport): show NPPES source-confirmed when identity payload returned`) — merged earlier, currently deployed on `vitalcv-web`. |
| **Backend truth-state patch** | merged + deployed | PR #423 — merged as `9f272c80c`; `api.vitalcv.com/health` confirms `git_sha:"9f272c80c"`. |
| **Live SSE smoke proof** | pending | Authenticated smoke for NPI 1699264564 not yet executed. See `docs/ops/authenticated-sse-smoke-runbook.md`. |
| **NPPES source operational reliability** | unsolved | Browser repeatedly observes NPPES unavailable / no successful read when unauthenticated; root cause not yet diagnosed. |

## What PR #423 fixes (in scope, on `main`)

A narrow truth-state alignment, only:

- When the orchestrator already holds an authoritative NPPES identity payload (from the pre-pipeline entity resolution call) AND the downstream claim-derivation / artifact-write / delta / alert stages of `ingestClinicianIdentity` flipped the overall `status` to `FAILED`, the emitted `source_complete` event for NPPES is promoted from `FAILED → SUCCESS`.
- Promotion gate requires ALL of: `sourceId === 'nppes'`, `extras.displayName` non-empty, `extras.identityStatus` non-empty AND not `"UNKNOWN"`, `extras.entityId` non-empty.
- `status` and `resultStatus` are written **after** the `...extras` spread, so a stale `extras.status` or `extras.resultStatus` cannot contradict the derived truth.

## What PR #423 does NOT fix (still open problems)

| Problem | Description |
|---|---|
| **NPPES source outage** | When the upstream NPPES API (or our proxy to it) is unreachable, returns 5xx, times out, or rate-limits, our orchestrator currently surfaces this as a generic `FAILED` `source_complete`. The patch does not promote no-payload cases (this is correct), but it also doesn't give operators a clean signal for *why* the lane failed. |
| **No-payload reads** | When NPPES returns 200 OK but the body is empty / minimal / missing identity, our adapter currently bails to `FAILED` without distinguishing "source said no" from "we couldn't parse". |
| **Auth-gated ingest access** | The web `/api/ingest/:npi` route is gated; agents and browser tooling cannot exercise the ingest path unauthenticated, which makes operational triage harder than it should be. |
| **OIG / PECOS / STATE_BOARD / FSMB / NURSYS connectivity** | These sources are not promoted by PR #423 (by design). They remain in `FAILED` state because the adapters are not yet wired to live upstream services. |
| **Backend "degraded" report in web `/api/health`** | The web app's `/api/health` reports `backend.status: "degraded"` even when the API self-reports `status: "ok"`. The classifier disagrees with the API's self-report; not blocking, but obscures observability. |

## Next engineering questions to resolve (before writing code)

1. **Why does NPPES sometimes return no payload?**
   - Auth scope on our outbound NPPES proxy?
   - Routing change in NPPES NPI lookup endpoints?
   - Source adapter (parser/HTTP client) regression?
   - Timeout in the orchestrator's pre-pipeline `resolveEntityFromNpi` call?
   - Rate limit on a shared NPPES API key?
   - Persistence layer dropping the payload between fetch and emit?
2. **Where is source operational state computed?**
   - The orchestrator emits per-source `source_complete` events with `status` and (now) `resultStatus`.
   - Is there a higher-level "source operational state" / "lane health" aggregator that the Passport surface reads from?
   - Is the aggregator currently snapshot-store-based (in-memory) or DB-backed?
3. **Where is the web app's "backend.status: degraded" computed?**
   - What's the actual probe the web app runs against `api.vitalcv.com`?
   - Is the "degraded" verdict cached / TTL'd?
   - What threshold of API errors flips it to "degraded"?
4. **What's the persistence boundary?**
   - Is per-run / per-source state currently written to a real DB table, or held in process memory only?
   - If in-memory, every API restart resets observability. Per the completion board, Database / Persistence Layer is 16% and the largest single board blocker.

## Proposed next wave tasks

Each item is a one-PR-sized increment. None of them touch product truth-state behavior; all are observability / reliability adds.

1. **Source adapter trace logging.** Add structured logs to the NPPES adapter capturing: upstream URL, HTTP status, response size, parse result (`identity-present` / `identity-empty` / `parse-error`), elapsed ms. Redact NPI/SSN/DOB from log payloads. Off by default; behind `INGEST_DEBUG_TRACE=1`.
2. **Per-source health endpoint.** Add `GET /api/ingest/source-health` returning a snapshot of recent per-source outcomes (last N runs): `{ source, lastSuccessAt, lastFailureAt, last10Outcomes: [...] }`. Read-only; aggregated from persistence (DB-backed only — no new in-memory state).
3. **NPPES timeout / error taxonomy.** Replace the single `IngestionResult.status: 'FAILED'` for NPPES failures with a sub-classified taxonomy in `extras`: `nppesFailureKind: 'TIMEOUT' | 'UPSTREAM_5XX' | 'NO_PAYLOAD' | 'PARSE_ERROR' | 'RATE_LIMITED' | 'AUTH_FAILED' | 'UNKNOWN'`. Does **not** change the public `status` / `resultStatus` semantics — only adds a debug breadcrumb.
4. **runId-linked source diagnostics.** Extend the existing `appendIngestEvent` to attach a `diagnostic` field (when `INGEST_DEBUG_TRACE=1`) with the trace from item 1, scoped to that `runId`. So an operator with a runId can pull `GET /api/ingest/diagnostics/:runId` and see what happened, without re-running.
5. **No-PHI debug snapshot.** Endpoint `GET /api/ingest/snapshot/:runId` that returns the full SSE event log for a single run with PHI redacted (NPI suffix-masked, names hashed, DOB stripped). For operator triage.
6. **Retry / backoff policy.** Document the existing NPPES retry behavior (or absence of it) in the orchestrator; propose a bounded exponential backoff for transient failure classes (`TIMEOUT`, `UPSTREAM_5XX`, `RATE_LIMITED`) and a fail-fast policy for `AUTH_FAILED` / `PARSE_ERROR`.
7. **Source freshness budget.** When a `source_complete` is `FAILED` for a source whose lastSuccessAt is > N hours old, surface a `staleness` flag in the `extras` payload. The web app can render a "source last confirmed at …" disclosure instead of a generic "no payload" state.
8. **Passport operational-state alignment.** Reconcile the web app's `backend.status: degraded` classifier with the API's `/health` self-report. Either fix the web's classifier to match API truth, or fix the API to expose the data the web classifier needs.

## Test plan (no live mutation, no PHI)

| Case | Setup | Expected behavior |
|---|---|---|
| Known valid NPI (1699264564) | Upstream NPPES returns intact payload; downstream stages succeed. | `source_complete` NPPES `status:"SUCCESS"`, `resultStatus:"SUCCESS"`, full identity fields present. |
| No-payload case | Mock NPPES adapter to return `{}` even when upstream is reachable. | `source_complete` NPPES `status:"FAILED"`, `resultStatus:"FAILED"`, `nppesFailureKind:"NO_PAYLOAD"`. |
| Intact-payload + failed-claims case | NPPES returns valid identity; downstream artifact write throws. | `source_complete` NPPES **promoted** to `status:"SUCCESS"`, `resultStatus:"SUCCESS"`. `claimCount: 0`. This is the PR #423 invariant. |
| Source timeout case | Mock NPPES adapter to await past the configured timeout. | `source_complete` NPPES `status:"FAILED"`, `resultStatus:"FAILED"`, `nppesFailureKind:"TIMEOUT"`. |
| Parser error case | NPPES adapter receives unexpected JSON shape. | `source_complete` NPPES `status:"FAILED"`, `resultStatus:"FAILED"`, `nppesFailureKind:"PARSE_ERROR"`. |
| OIG non-promotion (regression guard) | OIG adapter returns intact payload (even though unused). | OIG `source_complete` does **not** auto-promote to `SUCCESS`. Same for PECOS / STATE_BOARD / FSMB / NURSYS. |

All of the above must be Jest-backed unit tests in `apps/api/backend/__tests__/`, mocking the adapter layer. **No live NPPES calls in CI.**

## Truth constraints (apply to every task in this wave)

- **Do not promote no-payload reads.** Empty payload → `FAILED` stays `FAILED`. PR #423's promotion gate is the only allowed promotion path.
- **Do not claim OIG / PECOS / STATE_BOARD / FSMB / NURSYS are connected** unless they actually are. The taxonomy in proposed task 3 is for NPPES only; other sources need their own adapter work.
- **Do not imply final credentialing.** Source-confirmed identity is not the same as a verified credentialing decision. Copy review on any new operator-facing surface must pass the banned-strings check (see CLAUDE.md).
- **Do not run Prisma migrations in this wave** unless explicitly approved. Items 2 and 4–7 touch persistence; some may require schema additions, which should be staged as their own PRs and not bundled in.
- **No env / Railway / DNS / secret mutation** as part of this wave. New endpoints, new adapters, new schema — code only.

## Recommended sequencing

1. Item 1 (adapter trace logging) — smallest, fastest, immediate observability win.
2. Item 3 (NPPES failure taxonomy) — small, adds critical breadcrumb without changing public semantics.
3. Item 2 (per-source health endpoint) + Item 4 (runId diagnostics) — together, give operators a clear triage UX.
4. Item 6 (retry/backoff) — depends on items 1 and 3.
5. Items 5, 7, 8 — observability polish, lower priority.

Each item is its own PR with its own Local Claude Code audit (Codex remains operator-discretion). None of them block the next batch of revenue-generating work; they are the observability moat that makes revenue defensible.
