# Runtime Integrity Dashboard

**Status:** **OPERATIONAL — DASHBOARD DESIGN** · **Date established:** 2026-05-08 · **Authority:** subordinate to `runtime-governance-telemetry.md`, `dashboard-governance-enforcement.md`, `constitutional-runtime-alerts.md`

This doc designs dashboard surfaces for runtime constitutional integrity. Goal: **operators see at a glance whether integrity is HEALTHY / DEGRADED / DRIFT / FRAGMENTED / VIOLATION across all 7 governance dimensions.**

---

## 1. Dashboard widget inventory

| # | Widget | Data source | TG metric |
|---|---|---|---|
| **W-1** | Constitutional Health Index (composite) | `runtime-governance-telemetry.md` CHI | All TGs |
| **W-2** | Trust-class integrity (per-handler) | Audit-row class assignment | TG-6 |
| **W-3** | Replay survivability health | Denial-rate + correlationId presence | TG-2 |
| **W-4** | Export survivability health | EX-1 vs EX-3 variance | TG-3 |
| **W-5** | Constitutional drift health | Forbidden-phrase scan + class assignment | TG-1 + TG-6 |
| **W-6** | Lineage fragmentation health | Mean events per chain | TG-4 |
| **W-7** | Forensic continuity health | Composite TG-3 + TG-4 + CIS-4 | TG-5 |
| **W-8** | Alert dashboard | Active CA-1..CA-7 alerts | All CA |

---

## 2. Mandatory integrity indicators

Every widget surfaces ONE of:

| Indicator | Color | Meaning |
|---|---|---|
| 🟢 **CI-GREEN** | Green | All thresholds met; integrity nominal |
| 🟡 **CI-DEGRADED** | Yellow | Within tolerance but trending down |
| 🟠 **CI-DRIFT** | Orange | Detected drift; investigation needed |
| 🔴 **CI-FRAGMENTED** | Red | Cross-source inconsistency observed |
| ⚫ **CI-VIOLATION** | Black/dark red | Constitutional violation; immediate action required |

---

## 3. Per-widget design

### 3.1 W-1 Constitutional Health Index

```
┌─────────────────────────────────────────────────────┐
│ Constitutional Health Index           [Last: 5 min] │
│                                                     │
│       CHI: 87  🟢 CI-GREEN                          │
│                                                     │
│  TG-1 Drift:        🟢 100  TG-5 Forensic:  🟡 80   │
│  TG-2 Replay:       🟢 95   TG-6 Trust-class: 🟢 100 │
│  TG-3 Export:       🟡 75   TG-7 Dashboard: 🟢 95   │
│  TG-4 Lineage:      🟢 90                           │
└─────────────────────────────────────────────────────┘
```

### 3.2 W-2 Trust-class integrity (per-handler)

```
┌─────────────────────────────────────────────────────┐
│ Per-Handler Trust-Class Integrity   [Last: 1 min]   │
│                                                     │
│ accept           [🟢 C-1 + R0 + D0]    🟢 CI-GREEN  │
│ confirm-start    [🟢 C-1 + D0]         🟢 CI-GREEN  │
│ request-refresh  [🟢 C-1 + R0 + D0]    🟢 CI-GREEN  │
│ route-to-review  [🟢 C-1 + D0] (HITL)  🟡 CI-DEGRADED│
│ share-packet     [🟡 C-2 + D0]         🟡 CI-DEGRADED│
│ packet           [🟡 C-2 + D0]         🟡 CI-DEGRADED│
└─────────────────────────────────────────────────────┘
```

### 3.3 W-3 Replay survivability health

```
┌─────────────────────────────────────────────────────┐
│ Replay Survivability                [Last: 1 hour]  │
│                                                     │
│ R-OBSERVED:    47  🔵 R0-Canonical                  │
│ R-DENIED:     128  🔴 D0 (correlationId-gate)       │
│ R-COLLAPSED:    3  🔵 R0-Concurrency                │
│ R-ACCEPTED:    ??  (forensic detection only)        │
│                                                     │
│ correlationId presence:  98%   🟢                   │
│ denial-rate variance:    +2%   🟢                   │
│                                                     │
│ Status: 🟢 CI-GREEN                                 │
└─────────────────────────────────────────────────────┘
```

### 3.4 W-4 Export survivability health

```
┌─────────────────────────────────────────────────────┐
│ Export Survivability                [Last: 24 hours]│
│                                                     │
│ EX-1 SIEM cursor:   12,456 rows                     │
│ EX-3 Postgres:      24,891 rows                     │
│ Variance: 50.0%   🟡 CI-DEGRADED (DL-8 baseline)    │
│                                                     │
│ EX-3 SLA: ≤ 200ms  🟢                               │
│ Audit retention: 365 days  🟢                       │
│                                                     │
│ Status: 🟡 CI-DEGRADED (structural DL-8 gap)        │
└─────────────────────────────────────────────────────┘
```

### 3.5 W-5 Constitutional drift health

```
┌─────────────────────────────────────────────────────┐
│ Constitutional Drift                [Last: 7 days]  │
│                                                     │
│ Forbidden phrases (PR scan):    0   🟢              │
│ Unclassified audit-paths:       0   🟢              │
│ Lock v2 wording fixes pending:  2   🟡 (L-DR-1, L-DR-2) │
│ Cleanup-wave drifts pending:    3   🟡 (L-DR-3..5)  │
│                                                     │
│ Status: 🟡 CI-DEGRADED                              │
└─────────────────────────────────────────────────────┘
```

### 3.6 W-6 Lineage fragmentation health

```
┌─────────────────────────────────────────────────────┐
│ Lineage Continuity                  [Last: 7 days]  │
│                                                     │
│ Mean events per chain:  4.2 (baseline 4.5)          │
│ Chains with all expected events: 87% 🟢             │
│ Orphaned audit rows: 12 (OL-1..4)  🟡               │
│                                                     │
│ Status: 🟡 CI-DEGRADED                              │
└─────────────────────────────────────────────────────┘
```

### 3.7 W-7 Forensic continuity health

```
┌─────────────────────────────────────────────────────┐
│ Forensic Continuity                 [Composite]     │
│                                                     │
│ Audit retention:    365 days   🟢                   │
│ Postgres direct:    available  🟢                   │
│ Schema rename in flight: NO    🟢                   │
│ T0 CRITICAL log volume: 3/hour 🟢                   │
│                                                     │
│ Status: 🟢 CI-GREEN                                 │
└─────────────────────────────────────────────────────┘
```

### 3.8 W-8 Alert dashboard

```
┌─────────────────────────────────────────────────────┐
│ Active Constitutional Alerts        [Live]          │
│                                                     │
│ CA-1 Replay inflation:    0 active                  │
│ CA-2 Dashboard mismatch:  1 active (W-2)            │
│ CA-3 Export collapse:     0 active                  │
│ CA-4 Audit collapse:      0 active                  │
│ CA-5 Drift threshold:     0 active                  │
│ CA-6 Replay taxonomy:     0 active                  │
│ CA-7 Operator-visible:    0 active                  │
│                                                     │
│ Status: 🟡 CI-DEGRADED (1 P1 alert active)          │
└─────────────────────────────────────────────────────┘
```

---

## 4. Dashboard discipline

| Discipline | Mechanism |
|---|---|
| Every widget displays trust-class + lineage badges | Per `dashboard-governance-enforcement.md` §1 |
| Every widget displays integrity indicator (CI-GREEN..CI-VIOLATION) | This doc §2 |
| Every widget cross-references canonical query | Per `canonical-query-model.md` Q-CANON-* |
| Dashboard mismatch (CA-2) auto-flags widgets | Per CA-2 alert |
| Marketing-grade phrasing forbidden | Per `dashboard-governance-enforcement.md` §7 |

---

## 5. Closing principle (runtime integrity dashboard)

Operators see integrity at a glance. The dashboard converts the 7 telemetry categories into 8 widgets with integrity indicators. Each widget self-discloses class + lineage + canonical-query reference + integrity state.

**Visibility is the discipline. Action is the operator's. Dashboards do not auto-remediate.**
