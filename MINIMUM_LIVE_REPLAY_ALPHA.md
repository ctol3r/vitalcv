# Minimum Live Replay Alpha
Generated: 2026-05-13T19:05:00Z
DB: PostgreSQL vitalcv_dev

---

## Verdict: REPLAY IS OPERATIONALLY REAL

3 runs in chain. All DB-backed. All verified post-restart. Writer isolated.

---

## Live Chain (NPI 1457128589 — NPPES_API)

```
246f3c0d ← 6a4aaa2a ← 44f6042a ← null

  44f6042a  priorRunId=null      NPPES_API  VERIFIED  (origin — PILOT-1)
  6a4aaa2a  priorRunId=44f6042a  NPPES_API  VERIFIED  (second run)
  246f3c0d  priorRunId=6a4aaa2a  NPPES_API  VERIFIED  (third run — PR-β)
```

All three runs persisted in `source_runs` with `run_id` and `prior_run_id` columns.

---

## Continuity Properties

| Property | Status | Evidence |
|---|---|---|
| Persisted | ✅ | 3 SourceRun rows with runId in PostgreSQL |
| Retrievable | ✅ | `GET /api/replay/runs/by-npi/1457128589` → 3 runs |
| Reconstructable | ✅ | `replayReconstructor.ts` → `reconstructChain(npi, sourceId)` |
| Survives restart | ✅ | Verified: kill → restart → chain intact |
| Chronology stable | ✅ | Ordered by `startedAt` (immutable timestamp) |
| Lineage stable | ✅ | `NPPES_API:1457128589` — derived from immutable DB fields |
| Writer isolated | ✅ | try/catch, fire-and-forget, no caller mutation |

---

## DB State

| Table | Rows | Relevant |
|---|---|---|
| `source_runs` | 39 | 3 for NPI 1457128589 (NPPES_API) |
| `source_runs` with `run_id` | 37 | 95% populated |
| `source_runs` with `prior_run_id` | 24 | Chain links active |
| `verification_receipt_records` | 45+ | Linked to source_runs |
| `ingest_runs` | 3 | Tracking all 3 ingests |
| `audit_events` | 18+ | Actor-attributed |

---

## What Is NOT Yet Built (Honest)

| Component | Status |
|---|---|
| Payload digest/checksum | **Absent** — no hash of ingest payload stored |
| Receipt JWT bytes persisted | **Absent** — signed JWTs exist in memory only |
| Status List 2021 | **Absent** |
| TSA/RFC 3161 anchor | **Absent** |
| Multi-NPI coverage | **Partial** — only NPI 1457128589 actively tested |
| Advanced reconciliation | **Absent** — `repairChain` exists but not scheduled |
| Production deploy | **Blocked** — Vercel build needs GitHub push to main |

**SUCCESS: VitalCV replay is operationally real. 3-run chain in PostgreSQL. Verified survivable.**
