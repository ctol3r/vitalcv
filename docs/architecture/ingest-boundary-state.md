# Ingest Boundary State

**PR-β TASK 1 deliverable.** Identifies the single deterministic
insertion point in the existing ingest flow where the replay writer
is wired.

## §1 — Identified boundary

**File:** `apps/api/backend/src/services/ingest/ingestOrchestrator.ts`
**Function:** the success branch of `runIngestOrchestratorJob` (and
its `runIngestPipeline` variant)
**Line (post-edit):** between the `completeIngestRun(runId, {status: 'DONE'})`
call and the subsequent `appendIngestEvent({type: 'done'})` call.

## §2 — Why this boundary

At the moment we record the replay run, four prerequisites must all
hold:

| Required input | Where it exists at the boundary | Source |
|---|---|---|
| `checkedAt` (stable ISO timestamp the run was bound to) | `passport.lastCheckedAt` — set by `buildPassport(entityRecord.entity.id)` earlier in the function | `apps/api/backend/src/services/entity/passportService.ts` |
| `entityId` (the canonical entity the run was performed against) | `entityRecord.entity.id` — set by `resolveEntityFromNpi(npi)` at function start | `apps/api/backend/src/services/entity/entityResolutionService.ts` |
| `channel` (the run-invocation source) | hardcoded literal `'ingest_orchestrator'` (constant `INGEST_REPLAY_CHANNEL` in `replayWriterIngest.ts`) | new |
| `artifactChecksums` (deterministic source-summary fingerprints) | `sourceSummary` — output of `getIngestSourceRunSummary(runId)`, the per-source `{sourceId, status, claimCount, credentialCount}` snapshot | `apps/api/backend/src/services/ingest/ingestEventStore.ts:285` |
| `payloadDigest` (the canonical digest the writer computes) | derived by the writer from the above | internal to `replayIdentity.ts` |

Earlier candidate boundaries that did NOT meet the four-prerequisite
test:

- **At `createIngestRun` start** — `passport` and `sourceSummary` not yet built.
- **At `finalizeSourceResult` (per-source)** — fires once per source, not once per run; would over-record. The replay-run is per ingest-run, not per source.
- **At the `'done'` event append** — too late: the event itself is the externalized signal; recording the replay BEFORE the 'done' event ensures consumers that listen to the 'done' event know the lineage exists.

## §3 — Failure-isolation guarantees

| Property | Mechanism |
|---|---|
| Writer never throws into caller | `.catch(...)` on the returned promise; no `await`; structured `log('warn', 'replay_writer_failed', …)` |
| Writer never blocks ingest completion | Not `await`-ed; promise runs in parallel with subsequent `appendIngestEvent('done')` |
| Migration-absent failure handled | `recordReplayRun` raises Prisma `P2021`; the `.catch` swallows; ingest flow continues |
| Passport-absent skip | Whole replay-record block is guarded by `if (passport)` — when `buildPassport` returns null, we skip the record and proceed |
| No mutation of caller state | The writer call is in an additive block; subsequent ingest events (`'done'`) fire identically regardless of writer outcome |
| No new env var | Writer reads from `prisma` only |
| No new dependency | All imports use existing `prisma`, `node:crypto`, `log` |

## §4 — Diff scope on the orchestrator

```
apps/api/backend/src/services/ingest/ingestOrchestrator.ts
  + 2 imports (recordReplayRun, buildReplayWriterInputFromIngest)
  + 18 lines added at the post-completeIngestRun boundary
    (comment + if-guarded fire-and-forget recordReplayRun call)
  ± 0 existing lines modified
  ± 0 existing event handlers altered
```

No other file in `apps/api/backend/src/services/ingest/` is touched.

## §5 — Verdict

Single deterministic insertion point identified, ingredients verified
to exist at that boundary, failure isolation guarantees enumerated.
The writer call is the minimum coupling possible: one fire-and-forget
Promise on a guarded post-completion code path.
