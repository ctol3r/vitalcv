# Integrity Containment Dashboard Semantics

**Status:** **OPERATIONAL — DASHBOARD CONTAINMENT INDICATORS** · **Date established:** 2026-05-08 · **Authority:** subordinate to `runtime-integrity-dashboard.md`, `constitutional-containment-taxonomy.md`, `dashboard-governance-enforcement.md`

This doc defines operator-visible **containment indicators** that complement the integrity indicators (CI-GREEN..CI-VIOLATION) from `runtime-integrity-dashboard.md`. Containment indicators show whether degradation is BEING CONTAINED vs CONTINUING TO ESCALATE.

---

## 1. The 5 containment indicators

| Indicator | Meaning | Color |
|---|---|---|
| 🟢 **CT-GREEN** | No degradation detected; no containment needed | Green |
| 🟡 **CT-DEGRADED** | Degradation detected; containment in progress; no escalation | Yellow |
| 🠀 **CT-FRAGMENTING** | Degradation expanding scope; multi-handler / multi-domain spread | Orange |
| 🔴 **CT-ESCALATING** | Degradation crossed escalation threshold; founder coordination active | Red |
| ⚫ **CT-VIOLATION** | Constitutional violation shipped (CT-7); incident response active | Black/dark red |

---

## 2. Per-domain containment indicators

### 2.1 Replay containment indicators

| State | Operator interpretation | Action |
|---|---|---|
| 🟢 CT-GREEN replay | Dedup working; correlationId presence high; denial-rate stable | Continue monitoring |
| 🟡 CT-DEGRADED replay | Variance > 10% baseline; investigate but bounded | SOC review |
| 🠀 CT-FRAGMENTING replay | Multiple handlers showing degradation; vocabulary divergence rising | SOC + Codex audit |
| 🔴 CT-ESCALATING replay | Denial-rate variance > 50% drop (F-4 risk) | P0 ops + founder |
| ⚫ CT-VIOLATION replay | "Replay protected" inflation shipped externally | Founder + legal + customer comms |

### 2.2 Export containment indicators

| State | Operator interpretation | Action |
|---|---|---|
| 🟢 CT-GREEN export | EX-3 SLA met; EX-1 vs EX-3 variance within DL-8 baseline | Continue monitoring |
| 🟡 CT-DEGRADED export | EX-3 latency elevated; investigate root cause | Ops review |
| 🠀 CT-FRAGMENTING export | EX-3 row count dropping; cross-source variance widening | Ops + SOC investigation |
| 🔴 CT-ESCALATING export | EX-3 unavailable; forensic queries blocked | P0 ops + founder |
| ⚫ CT-VIOLATION export | "Complete audit log via SIEM" claim shipped externally | Founder + legal |

### 2.3 Lineage containment indicators

| State | Operator interpretation | Action |
|---|---|---|
| 🟢 CT-GREEN lineage | Mean events per chain at baseline; no orphans | Continue monitoring |
| 🟡 CT-DEGRADED lineage | Mean events per chain dropped 5–20% below baseline | Investigate root cause |
| 🠀 CT-FRAGMENTING lineage | Multiple traceIds showing incomplete chains; cross-row joins failing | SOC investigation |
| 🔴 CT-ESCALATING lineage | Significant past-window data already lost; CB-5 fragmenting | P0 ops + founder |
| ⚫ CT-VIOLATION lineage | "Complete audit trail" claim shipped externally | Founder + legal |

### 2.4 Forensic containment indicators

| State | Operator interpretation | Action |
|---|---|---|
| 🟢 CT-GREEN forensic | Retention SLA met; T0 CRITICAL log volume low; chain completeness high | Continue monitoring |
| 🟡 CT-DEGRADED forensic | T0 CRITICAL log spike OR retention sweep approaching | Ops review |
| 🠀 CT-FRAGMENTING forensic | Audit retention shortened OR T0 dual-write failures escalating | Ops + SOC + audit team |
| 🔴 CT-ESCALATING forensic | Retention sweep imminent OR forensic horizon shrinking | P0 ops + founder |
| ⚫ CT-VIOLATION forensic | CB-6 forensic past-window data loss occurred | Founder + legal + compliance |

---

## 3. Composite containment indicator

A platform-wide composite:

```
CT-COMPOSITE = max(
  CT-replay,
  CT-export,
  CT-lineage,
  CT-forensic,
  CT-dashboard,
  CT-constitutional
)
```

Where max is in the order: GREEN < DEGRADED < FRAGMENTING < ESCALATING < VIOLATION.

If ANY domain is CT-ESCALATING, the composite is CT-ESCALATING. If any is CT-VIOLATION, composite is CT-VIOLATION.

---

## 4. Per-widget containment label

Every widget shows BOTH:

```
[Integrity: CI-GREEN]      [Containment: CT-GREEN]
                  ↓
        means: data nominal AND no degradation in progress
```

Or:

```
[Integrity: CI-DEGRADED]   [Containment: CT-FRAGMENTING]
                  ↓
        means: data shows degradation AND it's spreading
```

The two labels together give operators 2D situational awareness.

---

## 5. Operator response per composite state

| Composite | Action |
|---|---|
| 🟢 CT-GREEN | Continue monitoring; quarterly governance review |
| 🟡 CT-DEGRADED | Apply per-domain playbook; verify fix; monitor for re-escalation |
| 🠀 CT-FRAGMENTING | SOC + ops investigation; escalate to founder if scope widens |
| 🔴 CT-ESCALATING | P0 incident; founder coordination; per-class containment playbook |
| ⚫ CT-VIOLATION | Incident response; founder + legal + compliance + customer comms |

---

## 6. Closing principle (containment dashboard)

Containment indicators give operators degradation-in-progress visibility. Combined with integrity indicators (CI-*), operators see BOTH static state AND trajectory. Two-dimensional awareness enables earlier intervention.

**CI tells you where you are. CT tells you where you're going.**
