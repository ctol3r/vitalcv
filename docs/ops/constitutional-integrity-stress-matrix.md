# Constitutional Integrity Stress Matrix

**Status:** **OPERATIONAL — STRESS MATRIX** · **Date established:** 2026-05-08 · **Authority:** consolidates `constitutional-breach-taxonomy.md`, `integrity-stress-escalation-paths.md`, `constitutional-failure-survivability.md`, `constitutional-recovery-semantics.md`

This doc consolidates per-breach × per-survivability-axis classification into a single matrix.

Each cell: 🟢 RESILIENT / 🟡 DEGRADED / 🟠 FRAGMENTING / 🔴 COLLAPSING.

---

## 1. The matrix

| Breach | Replay surv. | Export surv. | Lineage surv. | Forensic surv. | Operator explainability | Dashboard visibility | Constitutional detectability | **Aggregate** |
|---|---|---|---|---|---|---|---|---|
| **CB-1** semantic drift | 🟢 R | 🟢 R | 🟢 R | 🟢 R | 🟢 R | 🟢 R | 🟢 R (CI-grep) | 🟢 **RESILIENT** |
| **CB-2** replay inflation | 🟡 D (concept inflation) | 🟢 R | 🟢 R | 🟢 R | 🟡 D (false sense) | 🟡 D | 🟢 R (CI + Codex) | 🟡 **DEGRADED** |
| **CB-3** export degradation | 🟢 R | 🔴 C (collapse) | 🟡 D (cross-source breaks) | 🟠 F (forensic queries fail during outage) | 🟢 R | 🔴 C (no data to display) | 🟢 R (continuous monitoring) | 🟠 **FRAGMENTING** |
| **CB-4** dashboard divergence | 🟢 R | 🟢 R | 🟢 R | 🟢 R | 🟠 F (decisions misinformed) | 🔴 C (widget wrong) | 🟡 D (quarterly catch) | 🟡 **DEGRADED** |
| **CB-5** lineage fragmentation | 🟢 R | 🟢 R | 🠀 C (chain reconstruction broken) | 🟠 F (incomplete chains) | 🟡 D (chain unclear) | 🟡 D (per widget) | 🟡 D (weekly batch) | 🟠 **FRAGMENTING** |
| **CB-6** forensic collapse | 🟡 D (older replay context lost) | 🟢 R (forward) | 🠀 C (past chains GC'd) | 🔴 C (irreversible past) | 🟢 R (operators see retention SLA) | 🟢 R (retention badge) | 🟢 R (SLA monitor) | 🔴 **COLLAPSING (irreversible past)** |
| **CB-7** trust-class mismatch | 🟡 D (path-specific) | 🟢 R (audit table OK) | 🟡 D (orphaned mutations) | 🟠 F (incident attribution unclear) | 🟡 D (silent until reconcile) | 🟡 D (T0 CRITICAL log) | 🟡 D (Codex + reviewer) | 🠀 **FRAGMENTING (silent)** |
| **CB-8** audit collapse | 🠀 C (denied-replay invisible) | 🟢 R (audit table OK; just denials missing) | 🟡 D (denied chain broken) | 🠀 C (forensic blindness for denials) | 🟢 R (variance alarm) | 🠀 C (denial dashboard zero) | 🟢 R (variance alerting) | 🠀 **FRAGMENTING (with detection)** |

---

## 2. Aggregate distribution

| Status | Count | Breaches |
|---|---|---|
| 🟢 RESILIENT | 1 | CB-1 |
| 🟡 DEGRADED | 2 | CB-2, CB-4 |
| 🠀 FRAGMENTING | 4 | CB-3, CB-5, CB-7, CB-8 |
| 🔴 COLLAPSING | 1 | CB-6 |

---

## 3. Per-axis aggregate

| Axis | RESILIENT | DEGRADED | FRAGMENTING | COLLAPSING |
|---|---|---|---|---|
| Replay survivability | 5 | 2 | 0 | 1 (CB-8) |
| Export survivability | 7 | 0 | 0 | 1 (CB-3) |
| Lineage survivability | 4 | 2 | 0 | 2 (CB-5, CB-6) |
| Forensic survivability | 3 | 0 | 4 | 1 (CB-6) |
| Operator explainability | 5 | 2 | 1 | 0 |
| Dashboard visibility | 4 | 2 | 0 | 2 (CB-3, CB-4) |
| Constitutional detectability | 6 | 2 | 0 | 0 |

---

## 4. Cross-cutting findings

### 4.1 CB-6 is the unique COLLAPSING-IRREVERSIBLE class

CB-6 (forensic continuity collapse) is the only breach that produces unrecoverable past-window data loss. All other breaches are recoverable + survivable.

### 4.2 CB-3 + CB-5 + CB-7 + CB-8 are FRAGMENTING

These four breaches degrade specific axes without total collapse. Each requires monitoring + playbook + recovery.

### 4.3 CB-7 is the most SILENT FRAGMENTING

CB-7 (trust-class mismatch) is silent until reconciliation. No real-time alarm; depends on Codex + reviewer + T0 CRITICAL log monitoring. Highest detection-discipline requirement.

### 4.4 CB-8 has STRONG detection, FRAGMENTING impact

CB-8 (audit collapse) has variance alarm (🟢 detection) but FRAGMENTING impact on replay-survivability + forensic-survivability. The discipline is FAST RESPONSE to detection.

### 4.5 Constitutional detectability is universally 🟢 OR 🟡

No breach is COLLAPSE-IN-DETECTABILITY. Every class has at least 🟡 visibility. Detection is the platform's strongest defense.

---

## 5. Closing principle (stress matrix)

The matrix shows that constitutional stress survivability is MOSTLY DEGRADED + FRAGMENTING — with 1 RESILIENT class (CB-1) and 1 IRREVERSIBLE class (CB-6 past-window). Every class has visible detection; recovery is bounded by the class.

**The platform survives constitutional stress IF: (a) detection is wired (CI-grep + Codex + variance alerting + retention monitoring), (b) operators execute per-class recovery playbooks, (c) CB-6 forensic-retention SLA is rigorously protected (CB-6 past loss is irreversible).**

The matrix is the operator's stress-test reference. Every cell maps to a runbook.
