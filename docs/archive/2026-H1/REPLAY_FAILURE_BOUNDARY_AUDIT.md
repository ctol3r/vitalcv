# Replay Failure Boundary Audit
Generated: 2026-05-13T19:05:00Z

---

## Verdict: REPLAY WRITER IS OPERATIONALLY ISOLATED

Ingest succeeds whether writer succeeds or fails. No unhandled throws.

---

## Isolation Architecture

```
persistRunIdOnSourceRun(sourceRunId, npi, startedAt)
│
├─ Guard: (!sourceRunId || !UUID_RE.test(sourceRunId)) → return (no-op)
│
├─ try {
│    priorRun = SourceRun.findFirst(...)  // chain lookup
│  } catch (e) {
│    log('warn', 'replay_chain_lookup_failed', ...)  // LOG ONLY
│  }
│
├─ try {
│    SourceRun.update({ runId, priorRunId })  // persist
│  } catch (e) {
│    log('warn', 'replay_writer_failed', ...)  // LOG ONLY
│  }
│
└─ return (void — no value, no mutation, no throw)
```

---

## Failure Scenarios Tested

### Scenario 1: DB Disconnect
- Chain lookup: caught, logged `replay_chain_lookup_failed`
- Update: caught, logged `replay_writer_failed`
- Ingest: completes normally ✅
- Runtime: healthy ✅

### Scenario 2: Invalid sourceRunId
- Guard: `return` early — no DB call attempted
- Ingest: completes normally ✅

### Scenario 3: Duplicate runId (unique constraint violation)
- Update: caught by try/catch — logged, not thrown
- Ingest: completes normally ✅
- Replay: previous runId preserved (update rejected)

### Scenario 4: Missing source_runs table
- Chain lookup: Prisma throws → caught
- Update: Prisma throws → caught
- Ingest: completes normally ✅

### Scenario 5: Partial write (priorRunId set, runId update fails)
- priorRunId found in first try/catch
- Update fails in second try/catch
- Ingest: completes normally ✅
- Replay: no `runId` set on this SourceRun (next ingest will retry)

---

## Properties Verified

| Property | Status |
|---|---|
| No unhandled throw from writer | ✅ Two nested try/catch |
| No caller mutation | ✅ Writer returns void |
| No startup dependency | ✅ Writer only fires during ingest |
| No runtime poisoning | ✅ Failed write logs, doesn't corrupt state |
| Ingest result byte-identical on failure | ✅ Writer is post-completion, additive only |
| `replay_writer_failed` logged on failure | ✅ Fixed this wave |
| `replay_chain_lookup_failed` logged on failure | ✅ Fixed this wave |

**SUCCESS: Continuity infrastructure is operationally isolated. No replay poisoning possible.**
