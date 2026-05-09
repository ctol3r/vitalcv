# Constitutional Decision Matrix

**Status:** **OPERATIONAL — DECISION MATRIX** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-containment-taxonomy.md`, `escalation-governance-paths.md`

This doc defines operator decisions for 6 governance ambiguity scenarios. Each scenario has: safe operational action, unsafe operational assumption, forensic caution, survivability caution, escalation threshold.

---

## 1. The 6 decision scenarios

| # | Scenario | Decision domain |
|---|---|---|
| **DM-1** | Replay ambiguity | Replay-state classification under uncertainty |
| **DM-2** | Export delay | EX-3 latency / EX-1 freshness mismatch |
| **DM-3** | Lineage fragmentation | Audit-chain incompleteness |
| **DM-4** | Forensic degradation | Audit retention sweep / data loss imminent |
| **DM-5** | Dashboard/runtime mismatch | Widget shows different count than canonical query |
| **DM-6** | Trust-class violations | T0 path detected where C-1 expected |

---

## 2. Per-scenario decision

### 2.1 DM-1 Replay ambiguity

| Aspect | Guidance |
|---|---|
| Safe operational action | Use 5-state taxonomy (R-OBSERVED / R-DENIED / R-ACCEPTED / R-COLLAPSED / R-AMBIGUOUS); apply disambiguation matrix per `replay-taxonomy-map.md` §6 |
| Unsafe operational assumption | "Same correlationId for two events = honest retry" (could be capture-replay reusing correlationId) |
| Forensic caution | Cluster by `(actor, payloadHash)` to disambiguate capture-replay from honest-retry |
| Survivability caution | DO NOT treat R-OBSERVED as denied OR R-DENIED as observed |
| Escalation threshold | Multi-row scenarios where `payloadHash` reveals capture-replay → SOC investigation |

### 2.2 DM-2 Export delay

| Aspect | Guidance |
|---|---|
| Safe operational action | EX-3 Postgres direct is canonical for forensics; EX-1 SIEM stream tolerates lag |
| Unsafe operational assumption | "SIEM has every audit event" (DL-8 SIEM coverage gap) |
| Forensic caution | Cross-reference EX-1 vs EX-3 if confidence required |
| Survivability caution | Real-time queries against EX-3 may see eventually-consistent in-flight writes |
| Escalation threshold | EX-3 unavailable > 5 minutes → P0 alert |

### 2.3 DM-3 Lineage fragmentation

| Aspect | Guidance |
|---|---|
| Safe operational action | Use traceId-bound query (Q-CANON-6); accept partial chains; document gaps |
| Unsafe operational assumption | "Empty chain = nothing happened" (could be retention sweep OR T0 failures OR worker delay) |
| Forensic caution | Verify retention SLA covers query window before concluding chain incomplete |
| Survivability caution | Past chains may be permanently incomplete (CB-5 fragmenting) |
| Escalation threshold | Mean events per chain < 60% baseline → P1 alert |

### 2.4 DM-4 Forensic degradation

| Aspect | Guidance |
|---|---|
| Safe operational action | Treat retention SLA as load-bearing; restore retention BEFORE sweep affects data |
| Unsafe operational assumption | "Data is recoverable from backup" (depends on backup retention; may also lag) |
| Forensic caution | Document past-window data loss explicitly; founder + legal coordination |
| Survivability caution | CB-6 forensic loss is IRREVERSIBLE for affected window |
| Escalation threshold | Retention SLA breach detected → P0; immediate founder coordination |

### 2.5 DM-5 Dashboard/runtime mismatch

| Aspect | Guidance |
|---|---|
| Safe operational action | Trust canonical Q-CANON query result; label widget DEGRADED until fix |
| Unsafe operational assumption | "Bigger number is correct" (single-vocabulary query may MISS aliases per `audit-event-vocabulary-map.md`) |
| Forensic caution | Cross-vocabulary OR-clause queries return more complete results; widget MAY undercount |
| Survivability caution | Decisions based on widget data may be wrong; defer decisions if dashboard divergent |
| Escalation threshold | Widget variance > 10% from canonical → P1 dashboard governance review |

### 2.6 DM-6 Trust-class violations

| Aspect | Guidance |
|---|---|
| Safe operational action | Identify path; classify per `runtime-trust-class-map.md`; if mismatch, hotfix to correct class |
| Unsafe operational assumption | "T0 fire-and-forget is reliable enough for canonical events" (silent partial-writes) |
| Forensic caution | Reconcile mutation-table vs audit-table for past period; identify orphaned mutations |
| Survivability caution | Past partial-writes may be unrecoverable (cannot retroactively atomically-couple) |
| Escalation threshold | Class mismatch detected → P0; founder review |

---

## 3. Decision-flow per ambiguity

For each scenario, the decision tree:

```
1. Detect ambiguity (per integrity signals)
2. Classify per containment taxonomy (CT-1..CT-7)
3. Apply per-scenario guidance (this doc §2)
4. Take SAFE action; AVOID UNSAFE assumption
5. Apply forensic + survivability caution
6. Escalate per escalation paths (EG-1..EG-5) if threshold crossed
7. Document decision in incident log
```

---

## 4. Forbidden decision shortcuts

| Shortcut | Why forbidden |
|---|---|
| "Trust the dashboard widget without canonical-query cross-check" | Dashboard divergence may show wrong data (CB-4) |
| "Trust the SIEM stream as canonical" | DL-8 SIEM coverage gap |
| "Treat audit row count as logical-operation count" | TOCTOU race + cross-vocabulary aliases inflate count |
| "Treat absence of denied audit row as 'no denial happened'" | DC-4 regression risk OR Step-1 silent BY DESIGN |
| "Recover by retrying without new correlationId" | Honest retries should reuse correlationId; fresh per attempt = bypass dedup |
| "Assume in-memory ledger has all events" | T0 dual-write may have failed silently |
| "Assume audit retention covers historical query" | UNDOCUMENTED SLA; check before concluding |

---

## 5. Closing principle (decision matrix)

The matrix gives operators a SAFE / UNSAFE distinction for each ambiguity. Combined with containment taxonomy + escalation paths, this is the decision-grade reference for the SOC + ops team.

**Operators consult the matrix BEFORE acting. Acting without consultation = unsafe assumption inheritance.**
