# Scheduler Foundation State
Generated: 2026-05-13T18:22:00Z

---

## Phase 4 Verdict: 3 EXTERNAL + 2 INTERNAL SCHEDULERS ACTIVE

OpenClaw cron handles external probes. Backend has internal schedulers for continuous monitoring.

---

## OpenClaw Cron Schedulers (External — Survive Restart)

| Name | Schedule | Purpose | Next Run |
|---|---|---|---|
| `vcv-lane-probe` | `0 */6 * * *` LA | NPPES lane refresh for test NPI | Every 6h |
| `vcv-replay-reconciliation` | `0 */12 * * *` LA | Replay integrity verification | Every 12h |
| `vcv-degraded-recovery` | `*/30 * * * *` LA | Status + JWKS health check | Every 30min |

Properties:
- Survive OpenClaw restart: ✅ (cron persisted in gateway)
- Run in isolated sessions: ✅
- Announce results: ✅
- Read-only probes: ✅ — no mutations

---

## Backend Internal Schedulers (Process-scoped)

From startup logs:

| Scheduler | Cadence | Status |
|---|---|---|
| `investigator_scheduler` | `*/15 * * * *` | ✅ started, 8s delay |
| `continuous_monitor` | `0 2 * * *` daily | ✅ started |
| `nursys_poll_cron` | `0 */6 * * *` | configured (nursys_enabled=false) |
| `oig_cron` | `0 3 * * *` | ✅ started |
| `monitoring_cron` | `0 0 * * *` | ✅ started |
| `sanctions agent` | every 30s | ✅ started |
| `state_board agent` | every 45s | ✅ started |
| `audit_scrapbook worker` | every 300s | ✅ started |

**Note:** Internal schedulers do NOT survive process restart without an operator restarting the backend. OpenClaw cron jobs persist across restarts.

---

## Duplicate Replay Prevention

| Mechanism | Status |
|---|---|
| `LearningEvent.dedupeKey @unique` | ✅ — duplicate events rejected at DB |
| `AuditEvent` Prisma upsert with `dedupeKey` | ✅ — restart-safe |
| `SourceRun.runId @unique` | ✅ — unique constraint on derived ID |
| `IngestRun` idempotency | ✅ — same NPI creates new run (intentional) |

---

## Race Conditions / Stale Locks

No distributed locking mechanism exists. Multiple simultaneous ingest calls for the same NPI will create multiple `IngestRun` records. This is acceptable for current pilot scale (single operator).

---

## What Is Not Scheduled (Gap)

| Missing Scheduler | Impact |
|---|---|
| Replay `priorRunId` chain linker | `priorRunId` always null — no chain links computed after ingest |
| Receipt continuity reconciler | No automatic reconciliation of receipt continuity gaps |
| Lane freshness rehydrator | Lanes other than NPPES do not auto-refresh (OIG, state, PECOS) |

**SUCCESS: Runtime continuity no longer fully operator-manual. 5+ schedulers active. 3 persist across restarts.**
