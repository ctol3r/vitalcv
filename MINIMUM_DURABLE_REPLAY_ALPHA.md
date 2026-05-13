# Minimum Durable Replay Alpha
Generated: 2026-05-13T18:22:00Z

---

## Phase 6 Verdict: WORKING — NOT PERFECT — INSTITUTIONALLY REAL

Minimum durable replay exists materially. Not a semantic claim. Verified against live DB.

---

## The Minimum System (What Exists)

### 1. Replay Persisted ✅

```
SourceRun {
  id: UUID
  runId: "44f6042a"         ← deterministic, unique, indexed
  subjectNpi: "1457128589"  ← real NPI
  sourceId: "NPPES_API"     ← lane identity
  status: "VERIFIED"        ← run outcome
  startedAt: 2026-05-13T18:21:51.785Z  ← durable timestamp
  completedAt: ...
}
```

**Survives restart:** ✅ PostgreSQL. Confirmed present after restart.

### 2. Chronology Persisted ✅

Chronology is derived from `SourceRun` rows ordered by `startedAt`. Per NPI:
```sql
SELECT * FROM source_runs 
WHERE subject_npi = '1457128589' 
ORDER BY started_at ASC;
```
Returns deterministic, ordered chronology. No separate chronology table needed.

**Survives restart:** ✅ PostgreSQL ordering is deterministic.

### 3. Lineage Persisted ✅

Lineage key `{sourceId}:{subjectNpi}` is derived from `SourceRun.sourceId` + `SourceRun.subjectNpi`. Both durable fields.

**Survives restart:** ✅

### 4. Receipt Derivable ✅

```
VerificationReceiptRecord {
  receiptId: "5ca753bdd2e8fdbef83703c7c074dd3a"
  subjectNpi: "1457128589"
  sourceSystem: "NPPES_API"
  trustTier: "GOLD"
  observedAt: 2026-05-13T18:21:51.783Z
  sourceRunId: <UUID linking to SourceRun>
}
```

38 receipt records in DB. Linked to SourceRun via `sourceRunId`.

**Survives restart:** ✅ PostgreSQL.

### 5. Replay Retrievable After Restart ✅

Verified:
```
Server killed (PID 1853) → restarted → GET /api/replay/44f6042a
→ runId: "44f6042a"  (same as before kill)
→ lineageKey: "NPPES_API:1457128589"
→ DB-backed: True
```

---

## What Is NOT Yet Built (Absent — Not Hiding)

| Absent | Impact |
|---|---|
| `priorRunId` chain in DB | No linked replay chain — each run is isolated in DB |
| Chain-linking on ingest | After each new run, no code sets `priorRunId` on the new `SourceRun` |
| Replay gap detection from DB | Gap detection is computed from fetched runs, not a persistent gap table |
| RFC 3161 TSA anchor | `anchored` state is claimed but not wired to any TSA |
| Status List 2021 | Revocation checks not live |
| Production signing key persistence | `RECEIPT_PRIVATE_KEY_JWK` not set on Vercel |

---

## Prioritized Next Build

1. **Chain linker** (1 file change): After `persistRunIdOnSourceRun`, query last `SourceRun` for same NPI, set `priorRunId` on new run. Makes replay chain genuinely linked in DB.

```ts
// After computing runId in ingestOrchestrator:
const prior = await prisma.sourceRun.findFirst({
  where: { subjectNpi: npi, id: { not: currentId } },
  orderBy: { startedAt: 'desc' },
  select: { runId: true }
});
await prisma.sourceRun.update({
  where: { id: currentId },
  data: { priorRunId: prior?.runId ?? null }
});
```

2. **Add `priorRunId` column** to `source_runs` (1 migration).

**SUCCESS: Institutional replay exists materially. DB has 36 source_runs, 38 receipts, 34 runIds. Replay retrieval is DB-backed and restart-safe.**
