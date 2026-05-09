# Constitutional Recovery Semantics

**Status:** **OPERATIONAL — RECOVERY MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-failure-survivability.md`, `constitutional-runtime-alerts.md`

This doc defines how operators reason about degraded integrity / replay degradation / export degradation / lineage fragmentation / forensic degradation **WITHOUT implying autonomous correction or self-healing guarantees** (per non-negotiable rule #3).

---

## 1. The recovery semantic dichotomy

Recovery has two faces:

| Face | Definition |
|---|---|
| **R-VIS: Recovery visibility** | Operator can see WHAT degraded + HOW MUCH + WHEN it started + WHEN it stopped |
| **R-CONF: Recovery confidence** | Operator can verify the recovery actually restored the property; not merely that the alarm cleared |

Both are required for trustworthy recovery. Neither implies automatic.

---

## 2. Per-breach recovery profile

| Breach | R-VIS | R-CONF | Recovery confidence pattern |
|---|---|---|---|
| CB-1 semantic drift | 🟢 STRONG (CI-grep clears) | 🟢 STRONG (forbidden phrases removed; CI-grep re-passes) | Verifiable per-PR |
| CB-2 replay inflation | 🟢 STRONG | 🟢 STRONG (Codex re-audit; lexicon clean) | Verifiable per-PR |
| CB-3 export degradation | 🟢 STRONG (EX-3 query latency restored) | 🟡 PARTIAL (restored availability ≠ restored coverage; investigate root cause) | EX-3 metrics + EX-1 vs EX-3 variance |
| CB-4 dashboard divergence | 🟢 STRONG (variance closes) | 🟢 STRONG (canonical-query verification) | Per-widget |
| CB-5 lineage fragmentation | 🟡 PARTIAL (mean events per chain restores) | 🟠 LIMITED (past chains may be permanently incomplete) | Forward-looking only |
| CB-6 forensic collapse | 🟢 STRONG (retention SLA fixed; future preserved) | 🔴 NO (past window data is gone — no recovery) | Forward-looking only; backward irreversible |
| CB-7 trust-class mismatch | 🟡 PARTIAL (path migrated to C-1) | 🟡 PARTIAL (past partial-writes may need backfill OR remain orphaned) | Mutation-vs-audit reconciliation required |
| CB-8 audit collapse | 🟢 STRONG (denial-rate restores) | 🟡 PARTIAL (regression-window denials are gone; cannot reconstruct) | Forward-looking only |

---

## 3. Partial recovery semantics

When recovery is PARTIAL, operators must explicitly understand:

| Recovery aspect | Lexicon-aligned framing |
|---|---|
| "Forward-looking only" | "Property restored for new operations; past affected window remains incomplete" |
| "Awaiting backfill" | "Recovery in progress; affected data being reconciled" |
| "Cannot recover past" | "Recovery not possible for affected window; preventive measures hardened" |
| "Verified clean post-fix" | "Property restored AND verified via [specific check]" |

Each framing carries different operational + trust + compliance weight.

---

## 4. Degraded recovery semantics

When the recovery itself is degraded:

| Pattern | Meaning |
|---|---|
| Alarm clears but root cause unidentified | Recovery is INCOMPLETE; defer "RESOLVED" status |
| Variance returns to baseline but baseline shifted | New baseline established; old baseline is past |
| Property restored on most paths but one path lags | PARTIAL recovery; that path remains DEGRADED |
| Recovery shipped but Codex audit deferred | Recovery is PROVISIONAL; verification pending |

---

## 5. Forbidden recovery framings

Per non-negotiable rule #3: **recovery visibility is NOT guaranteed recovery.** These framings inflate:

| Forbidden framing | Why forbidden | Allowed alternative |
|---|---|---|
| "Auto-recovered" | Implies autonomous correction | "Recovery action completed; verification pending" |
| "Self-healing" | Implies platform fixed itself | "Operator-initiated recovery successful" |
| "Permanently resolved" | Implies recovery is irreversible (it isn't — drift can recur) | "Resolved as of [timestamp]; ongoing monitoring" |
| "Cryptographically certain" | Implies math-grade guarantee | "Verified via [specific check]; subject to ongoing monitoring" |
| "Fully restored" (without qualifier) | Implies past + future + verification | "Forward-looking restored; [past status] [verification status]" |

---

## 6. Per-recovery operator playbook

For each breach class, the recovery playbook:

### 6.1 CB-1 / CB-2 (semantic drift / replay inflation)

1. CI-grep / Codex caught.
2. Author updates wording.
3. CI re-passes.
4. Codex re-audits.
5. Verdict: 🟢 RECOVERED (verified per-PR).

### 6.2 CB-3 (export degradation)

1. Alarm fires; ops on-call paged.
2. Identify root cause (DB outage, retention sweep, migration).
3. Apply fix; verify EX-3 availability + SLA.
4. Cross-check EX-1 vs EX-3 variance returns to baseline.
5. Verdict: 🟢 RECOVERED IF availability + variance both check; otherwise 🟡 PARTIAL pending continued investigation.

### 6.3 CB-4 (dashboard divergence)

1. Quarterly audit OR on-demand alert.
2. Dashboard owner reviews widget query against Q-CANON.
3. Widget updated OR labeled CI-DEGRADED until fixed.
4. Canonical-query cross-check verifies <5% variance.
5. Verdict: 🟢 RECOVERED.

### 6.4 CB-5 (lineage fragmentation)

1. Weekly batch detects chain completeness drop.
2. Investigate root cause (T0 failure spike? retention sweep? worker delay?).
3. Apply fix.
4. Future chains complete.
5. Verdict: 🟡 PARTIAL — past chains affected.

### 6.5 CB-6 (forensic collapse)

1. Retention SLA monitor catches.
2. Identify cause (config error? sweep misconfiguration?).
3. Restore retention immediately for future.
4. Document past window as forensically lost.
5. Verdict: 🔴 IRRECOVERABLE for past window; 🟢 RECOVERED forward-looking.
6. Founder + legal coordination on past-window implications.

### 6.6 CB-7 (trust-class mismatch)

1. Codex audit OR reviewer caught (or T0 CRITICAL log spike).
2. Identify path that's mismatched.
3. Migrate path to correct class (T0 → T1 OR T2).
4. Reconcile mutation-vs-audit table for past period.
5. Backfill audit rows where possible.
6. Verdict: 🟡 PARTIAL — backfill best-effort.

### 6.7 CB-8 (audit collapse)

1. Variance alarm fires.
2. Identify which path stopped emitting denials.
3. Hotfix the regression.
4. Verify denial rate restores.
5. Document regression window as forensically blind for affected denials.
6. Verdict: 🟡 PARTIAL — regression-window denials gone.

---

## 7. Recovery confidence verification

Operators verify recovery via:

| Verification | Mechanism |
|---|---|
| Per-PR | CI-grep + Codex re-audit |
| Per-deploy | Smoke tests on canonical paths |
| Continuous | Variance returns to baseline + sustained |
| Per-incident | Post-incident review with founder; document past-affected scope |
| Per-quarter | Constitutional governance review; CHS trends |

Each tier of verification carries different confidence:

- Per-PR: 🟢 STRONG (regression caught at gate).
- Per-deploy: 🟢 STRONG (regression caught before traffic).
- Continuous: 🟡 PARTIAL (alarm-bound; missed-detection risk).
- Per-incident: 🟢 STRONG (root cause analyzed).
- Per-quarter: 🟡 PARTIAL (long-tail observability).

---

## 8. Closing principle (recovery semantics)

Recovery is operator-initiated + verification-grounded. The platform does NOT auto-recover; alerts surface degradation; operators apply playbook; verification confirms.

**Recovery visibility (R-VIS) is necessary; recovery confidence (R-CONF) is sufficient. Both required for trustworthy recovery claims.** Lexicon enforces wording: "self-healing" / "auto-recovered" / "permanently resolved" / "cryptographically certain" are FORBIDDEN.
