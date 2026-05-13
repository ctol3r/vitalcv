# Ingest Canonical Boundary
Generated: 2026-05-13T19:05:00Z

---

## Single Deterministic Replay Insertion Point

**File:** `apps/api/backend/src/services/ingest/ingestOrchestrator.ts`
**Function:** `runPipeline(runId: string, npi: string)`
**Boundary:** Line ~420, post-completion loop — after `completeIngestRun()` + `appendIngestEvent('done')`

```ts
// Line ~418-422 (exact location)
for (const [, result] of resultBySource) {
  await persistRunIdOnSourceRun(result.sourceRunId, npi, pipelineStartedAt);
}
```

**Writer function:** `persistRunIdOnSourceRun(sourceRunId, npi, startedAt)`
**Lines:** 37–70

---

## Available Inputs at Boundary

| Input | Source | Deterministic |
|---|---|---|
| `npi` | Function parameter | ✅ |
| `result.sourceRunId` | `IngestionResult.sourceRunId` (UUID) | ✅ per-ingest |
| `pipelineStartedAt` | `new Date()` captured at pipeline start | ✅ per-ingest |
| `result.status` | `IngestionResult.status` | ✅ |
| `result.artifactId` | `IngestionResult.artifactId` | ✅ |
| `sourceId` | `resultBySource` map key | ✅ |
| `runId` (ingest) | UUID from `createIngestRun()` | ✅ per-ingest |

---

## Derived Outputs (Computed by Writer)

| Output | Algorithm | Deterministic |
|---|---|---|
| `runId` (replay) | `deriveRunId(npi + ':' + startedAt.toISOString())` → djb2 → 8-char hex | ✅ |
| `priorRunId` | `SourceRun.findFirst({ subjectNpi: npi, not: current, orderBy: startedAt desc })` | ✅ |

---

## Failure Semantics

```ts
persistRunIdOnSourceRun:
  if (!sourceRunId || !UUID_RE.test(sourceRunId)) → return (no-op)
  chain lookup try/catch → log('warn', 'replay_chain_lookup_failed')
  update try/catch → log('warn', 'replay_writer_failed')
  NEVER throws into caller
  NEVER mutates caller state
  NEVER blocks ingest completion
```

**Ingest result is byte-identical whether writer succeeds or fails.**

---

## Call Graph

```
POST /api/ingest/:npi
  → createIngestRun(npi)
  → runPipeline(runId, npi)
    → pipelineStartedAt = new Date()
    → emitSourceStart(runId, 'nppes')
    → run NPPES adapter
    → finalizeSourceResult(runId, 'nppes', result)
    → [repeat for oig, pecos, etc.]
    → completeIngestRun(runId, { status: 'DONE' })
    → appendIngestEvent(runId, 'done', ...)
    → for each sourceResult:
        → persistRunIdOnSourceRun(sourceRunId, npi, pipelineStartedAt)  ← REPLAY WRITER
    → log('info', 'ingest_run_done')
```

No new ingest flows invented. No pipeline forked. Single additive call at existing boundary.
