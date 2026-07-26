# Replay Persistence Alpha
Generated: 2026-05-13T18:11:00Z
Status: Sub-agent executing (replay-persistence-alpha)

---

## Phase 2 Summary

### What Already Exists in DB (Confirmed)

The following tables already durably persist replay-relevant data:

| Table | Relevant Fields | Usage |
|---|---|---|
| `SourceRun` | `subjectNpi`, `sourceId` (laneId), `idempotencyKey`, `status`, `runSummary`, `startedAt`, `completedAt` | One row per lane + NPI run |
| `VerificationReceiptRecord` | `receiptId`, `subjectNpi`, `sourceRunId`, `trustTier`, `observedAt`, `sourceSystem` | One row per receipt — linked to SourceRun |
| `IngestRun` | `npi`, `status`, `startedAt`, `completedAt` | Top-level ingest tracking |
| `AuditEvent` | All events with `dedupeKey` | Restart-safe event log |
| `LearningEvent` | `dedupeKey @unique` | Restart-safe, no duplicates |

### What the Sub-Agent Is Adding

1. `runId String? @unique @map("run_id")` field on `SourceRun`
2. Prisma migration: `add_run_id_to_source_runs`
3. `deriveRunId()` computation on ingest create/update
4. Backend endpoint: `GET /api/replay/runs/:runId`
5. `getReplayInspection.ts` wired to query backend first, synthetic fallback

### Durability Properties (Post-Alpha)

| Property | Before | After Alpha |
|---|---|---|
| Replay runId in DB | ❌ Not stored | ✅ On `SourceRun.runId` |
| Replay lookup by runId | ❌ Synthetic only | ✅ DB-first, synthetic fallback |
| Replay survives restart | ❌ Reconstructed | ✅ Retrieved from DB |
| Receipt linked to run | ✅ Already via `sourceRunId` | ✅ Unchanged |
| Ingest run tracked | ✅ `IngestRun` table | ✅ Unchanged |

### Determinism Guarantees (Current + Post-Alpha)

| Field | Algorithm | Deterministic |
|---|---|---|
| `runId` | `djb2(npi:startedAt)` | ✅ Same NPI + time → same ID |
| `lineageKey` | `{laneId}:{npi}` | ✅ |
| `receiptId` | `rcpt_{responseId}` (fixed this wave) | ✅ |
| `jti` | `rcpt_{responseId}` (fixed this wave) | ✅ |
| `signingKeyId` | `vcv-es256-dev` stable (fixed this wave) | ✅ |
| `checkedAt` | ISO 8601 Z-suffix (fixed this wave) | ✅ |

---

**Sub-agent results will update this document when complete.**
**Current state: 5 durability fixes applied this wave. DB-backed runId in progress.**
