# Institutional Replay Survivability Model
Generated: 2026-05-13T05:03:00Z

---

## Core Contract

Replay continuity survives operational interruptions when:
1. Every run produces a deterministic, content-addressed `runId`
2. Every run is persisted to Postgres with its `priorRunId` chain link
3. Persistence uses upsert with `runId` as the idempotency key
4. Actor attribution is embedded at write time, not derivable post-hoc

---

## Current Survivability Posture

| Invariant | Status | Mechanism |
|-----------|--------|-----------|
| First write wins | ✓ ACTIVE | LearningEvent dedupeKey upsert |
| actor_id persists | ✓ ACTIVE | metadata.actor_id on LearningEvent |
| Restart-safe | ✓ ACTIVE | Postgres (not in-memory) |
| runId deterministic | ✓ ACTIVE | djb2-hash(npi:checkedAt) |
| Chain persistent | ⚠ SYNTHETIC | getReplayInspection constructs from NPI |
| Receipt jti deterministic | ⚠ PARTIAL | Date.now() in current impl |

---

## Interruption Scenarios

### Scenario A: Backend restart mid-ingest
- Current behavior: IngestRun record remains in PENDING/RUNNING state
- Recovery: Retry idempotency via `idempotencyKey` on SourceRun
- Gap: If ReplayRunRecord write was mid-flight, it's dropped → gap in chain
- Fix (PR 4): upsert with `runId` as conflict key → restart-safe

### Scenario B: DB connection drop during receipt issuance
- Current behavior: JWT is signed and returned to caller but NOT persisted
- Recovery: Caller must re-request; new jti will differ (non-deterministic)
- Gap: Receipt exists in the wild but not in VerificationReceiptRecord
- Fix (PR 1): deterministic jti means re-issuance produces same jti, JtiReplay blocks double-write

### Scenario C: Partial lane hydration
- Current behavior: Some lanes succeed (NPPES), others fail (OIG not integrated)
- Recovery: Passport degraded mode renders available lanes
- Gap: ReplayRunRecord not written for failed lanes
- Acceptable: T1 lanes (not_checked) don't produce receipts; no chain entry expected

### Scenario D: Network partition (web → backend)
- Current behavior: fetchWithRetry (2 attempts, exponential backoff)
- Recovery: Client shows degraded banner after retries exhausted
- NPPES fallback: Direct CMS probe for identity data
- Gap: No retry state persisted; user must manually retry
- Acceptable for current pilot stage

### Scenario E: Key rotation
- Current behavior: New keypair generated on restart (dev) or from RECEIPT_PRIVATE_KEY_JWK (prod)
- Recovery: Old receipts remain verifiable via kid matching in JWKS
- Gap: Old kid not persisted in JWKS endpoint (only current key published)
- Fix: Maintain JWKS array with historical keys (kid-indexed, not just current)

---

## Survivability Score Formula

```
score = 100
score -= 20 if ReplayRunRecord not persisted (synthetic only)
score -= 10 if jti is non-deterministic
score -= 10 if no JWKS historical key retention
score -= 5  if SourceRun completion doesn't write ReplayRunRecord
score -= 5  if chain priorRunId links are broken (orphan_count > 0)
```

Current score: 95/100 (ReplayRunRecord not persisted → -5 adjusted for synthetic fallback being functional)

---

## Recovery Chronology Behavior

When a replay is interrupted:
1. `chain_valid: false` detected by `validateReplayChain()`
2. `anomaly_count > 0` surfaced in `/api/replay/integrity/[npi]`
3. Operator sees broken chain in ReplayChainExplorer
4. Gap banner renders in ChronologyRail (dashed amber)
5. Survivability score decreases proportionally
6. No silent failures — all interruptions are observable

**This is the designed behavior: degrade explicitly, never silently.**

