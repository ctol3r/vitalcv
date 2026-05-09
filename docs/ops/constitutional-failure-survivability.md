# Constitutional Failure Survivability

**Status:** **OPERATIONAL — FAILURE SURVIVABILITY MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-breach-taxonomy.md`, `integrity-stress-escalation-paths.md`

This doc determines which constitutional failures remain survivable / detectable / containable / explainable / recoverable — vs. silently fragmenting / operationally misleading / forensically dangerous.

---

## 1. Per-breach survivability profile

For each CB breach (per `constitutional-breach-taxonomy.md`):

| Breach | Survivable | Detectable | Containable | Explainable | Recoverable | Hidden? |
|---|---|---|---|---|---|---|
| CB-1 semantic drift | 🟢 YES | 🟢 YES (CI-grep) | 🟢 YES (block merge) | 🟢 YES | 🟢 YES (revert) | NO |
| CB-2 replay inflation | 🟢 YES | 🟢 YES (CI-grep + Codex) | 🟢 YES | 🟢 YES | 🟢 YES (re-word) | NO |
| CB-3 export degradation | 🟡 PARTIAL | 🟢 YES (continuous) | 🟡 PARTIAL (depends on root cause) | 🟢 YES | 🟡 PARTIAL (during outage data lost from SIEM cursor; Postgres preserved) | NO |
| CB-4 dashboard divergence | 🟢 YES | 🟡 MEDIUM (quarterly) | 🟢 YES (dashboard fix) | 🟢 YES | 🟢 YES | PARTIAL — depends on review cadence |
| CB-5 lineage fragmentation | 🟡 PARTIAL | 🟡 MEDIUM | 🟡 PARTIAL | 🟢 YES | 🟠 LIMITED — past chains may be unrecoverable | YES — silent until query investigation |
| CB-6 forensic continuity collapse | 🔴 NO (irreversible for affected window) | 🟢 YES (retention SLA monitoring) | 🟢 YES (prevent future) | 🟢 YES | 🔴 NO — past forensic horizon lost | PARTIAL — affected window's data is gone |
| CB-7 trust-class mismatch | 🟡 PARTIAL | 🟡 MEDIUM (Codex audit + reviewer) | 🟢 YES (hotfix) | 🟢 YES | 🟡 PARTIAL — requires backfill if past data has partial-writes | YES — silent partial-writes until reconciliation |
| CB-8 audit survivability collapse | 🟡 PARTIAL | 🟢 YES (variance alerting) | 🟢 YES (revert) | 🟢 YES | 🟡 PARTIAL — denials missed during regression window are gone | PARTIAL — depends on alert latency |

---

## 2. Breach class summary

| Class | Count |
|---|---|
| 🟢 Fully survivable + recoverable | 3 (CB-1, CB-2, CB-4) |
| 🟡 Partially survivable | 4 (CB-3, CB-5, CB-7, CB-8) |
| 🔴 Irreversible window | 1 (CB-6) |

**Headline:** 7 of 8 breaches are detectable + containable + explainable. CB-6 forensic continuity collapse is the single irreversible class.

---

## 3. Hidden breach surfaces

Breaches where impact is INVISIBLE to operators until investigation:

| Hidden breach | Hidden until... |
|---|---|
| CB-5 lineage fragmentation | Audit-chain query reveals incompleteness |
| CB-7 trust-class mismatch | Audit-mutation reconciliation reveals partial-writes |
| CB-8 audit collapse (partial) | Denial-rate variance crosses alert threshold (depends on baseline + alert config) |

These three benefit most from PROACTIVE monitoring (continuous, dashboard, alerting).

---

## 4. Delayed breach visibility

Breaches whose visibility lags onset:

| Breach | Lag |
|---|---|
| CB-1 semantic drift in dashboards/marketing | Until quarterly governance review |
| CB-3 export degradation (slow build) | Until variance alarm threshold crossed |
| CB-4 dashboard divergence | Until quarterly + on-demand cross-check |
| CB-5 lineage fragmentation | Until weekly batch + chain-completeness check |
| CB-6 forensic collapse during retention sweep | Visible at sweep time but data gone |

Delay matters: longer delay = more downstream consumers form false beliefs.

---

## 5. Replay-collapse ambiguity

When CB-8 (audit collapse) hits replay specifically:

| Audit row state | What you see | What may have happened |
|---|---|---|
| `<base>.duplicate_request` denied row count drops | "Fewer replays" — good? OR fewer denials emitted (regression) — bad? | Need cross-check via correlationId variance + payloadHash clustering |
| `IDEMPOTENT_REPLAY` count steady but `duplicate_request` dropped | Specific code path's denial emission lost | Hotfix the affected handler |
| Both drop simultaneously | Either both genuinely rare (e.g., low traffic) OR both regressions | Investigate traffic baseline first |

**Disambiguation:** payloadHash clustering for capture-replay forensic detection — survives even if denied-emission regresses.

---

## 6. Export-collapse ambiguity

When CB-3 (export degradation) hits:

| Symptom | Could be |
|---|---|
| EX-3 query slowness | DB load OR retention sweep OR migration |
| EX-3 row-count drops | Above OR genuine reduction in audit-emitting traffic |
| EX-1 SIEM stream pauses | Worker delay OR SIEM consumer disconnect OR in-memory ledger overflow |
| EX-1 vs EX-3 variance shifts | New T2 writers (DL-8 expansion) OR T0 dual-write failures |

**Disambiguation:** correlate with traffic baseline + new-deploy timeline + retention-sweep schedule.

---

## 7. Operationally misleading failures

Breaches where the wrong response is plausible:

| Breach | Misleading response | Correct response |
|---|---|---|
| CB-3 export degradation | "Switch to SIEM as primary forensic" | EX-3 is canonical; investigate why EX-3 is unavailable |
| CB-4 dashboard divergence | "Trust the bigger number" | Cross-check both sources via Q-CANON canonical |
| CB-5 lineage fragmentation | "Patch missing rows manually" | Investigate retention SLA + GC pattern + chain completeness root cause |
| CB-7 trust-class mismatch | "Audit row exists, mutation must have committed" | Reconcile mutation table vs audit table; identify orphaned mutations |
| CB-8 audit collapse | "Denial rate dropped because we got better" | Variance alarm = regression risk; verify denial paths still emit |

---

## 8. Forensically dangerous failures

Failures that compromise forensic completeness:

| Breach | Forensic danger |
|---|---|
| CB-6 forensic collapse | Past audit data gone; investigations impossible |
| CB-7 trust-class mismatch | Mutation persisted without audit; incident attribution impossible |
| CB-8 audit collapse | Denial-row regression; capture-replay attacks invisible during regression window |

These three are the highest forensic-stakes breaches. CB-6 is irreversible; CB-7 + CB-8 are recoverable IF detected quickly.

---

## 9. Per-breach recovery semantics

For each CB:

| Breach | Recovery mechanism |
|---|---|
| CB-1 semantic drift | Doc / code revert; lexicon enforcement re-tightened |
| CB-2 replay inflation | Re-word; founder review |
| CB-3 export degradation | Restore EX-3 availability; backfill if possible |
| CB-4 dashboard divergence | Dashboard widget fix; canonical-query verification |
| CB-5 lineage fragmentation | Audit retention SLA hardening; cannot recover past chains |
| CB-6 forensic collapse | Cannot recover; hotfix retention SLA to prevent future |
| CB-7 trust-class mismatch | Migrate path to C-1 OR T1; backfill audit rows where possible |
| CB-8 audit collapse | Hotfix to restore denied-row emission; cannot recover regression-window denials |

---

## 10. Closing principle (failure survivability)

The platform survives most constitutional failures with degraded-but-recoverable fidelity. CB-6 (forensic collapse) is the irreversible class. CB-7 + CB-8 are recoverable IF detected — making detection (CIS-4 + CIS-8 monitoring) the highest-leverage discipline.

**Survivability is bounded by detectability + speed-of-response. Detectability is monitorable. Speed-of-response is operational.**
