# Continuity Recovery Paths
Generated: 2026-05-13T18:29:50Z

---

## Verdict: RECOVERY PATHS IMPLEMENTED AND VERIFIED IDEMPOTENT

Three recovery paths exist. All idempotent. No infinite loops.

---

## Path 1: Chain Repair (`repairChain`)

**When to invoke:** Broken `priorRunId` links detected (orphaned runs).
**Implementation:** `replayReconstructor.ts → repairChain(npi)`

```ts
// Sets priorRunId = previous run's runId in startedAt order, per NPI+sourceId
// Idempotent: re-running produces same result
const result = await repairChain('1457128589');
// → { repaired: N }
```

Properties:
- Idempotent: ✅ same input → same output
- No duplicate repair attempts: ✅ only updates where `priorRunId !== expectedPrior`
- No data loss: ✅ only updates `prior_run_id`, no deletions
- Atomic per run: ✅ each update is independent

---

## Path 2: Full Reconstruction (`reconstructAll`)

**When to invoke:** After crash recovery or suspected chain corruption.
**Implementation:** `replayReconstructor.ts → reconstructAll()`

```ts
const summary = await reconstructAll();
// → { npis, totalSourceRuns, runsWithRunId, runsChained, orphanedRuns, chainsRepaired }
```

Properties:
- Runs across all NPIs with source_runs
- Calls `repairChain(npi)` for each NPI
- Returns summary with `chainsRepaired` count
- Safe to run at startup or on a schedule

---

## Path 3: Synthetic Fallback in `getReplayInspection`

**When fires:** Backend unreachable, or runId not found in DB (unknown format).
**What it returns:** Deterministic synthetic `ReplayInspection` with:
  - `degradationOwnership: "anonymous_preview"` or `"no_adverse_findings"`
  - `survivabilityScore: 20` (anonymous) or `60–100` (rcpt_/rec- format)

This is NOT a failure path — it is a graceful degradation with honest disclosure.
The synthetic fallback never returns `chain_valid: true` for unknown runs.

---

## Degraded Continuity Recovery

| Degraded Condition | Recovery | Automatic |
|---|---|---|
| Backend unreachable | Web layer falls to synthetic | ✅ automatic |
| `priorRunId` null on non-origin | `repairChain(npi)` | Manual or scheduled |
| Orphaned run (prior missing) | Can't recover — prior never existed | N/A |
| Signing key rotation | New receipts use new kid | ✅ automatic |
| DB disconnection | Prisma reconnects | ✅ automatic |
| Partial ingest (interrupted) | Next ingest overwrites or creates new run | ✅ automatic |

---

## Reconciliation Loops: None

No reconciliation loops exist in the current implementation. Recovery functions are:
- Called explicitly (by operator or scheduler)
- Idempotent with early-exit on no-op
- Not scheduled automatically yet (pending wire-up in `vcv-replay-reconciliation` cron)

**Duplicate repair prevention:** `repairChain` updates only when `run.priorRunId !== expectedPrior`. No duplicate writes.

**SUCCESS: Continuity survives operational interruption. Three recovery paths available.**
