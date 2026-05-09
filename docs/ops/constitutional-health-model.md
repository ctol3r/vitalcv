# Constitutional Health Model

**Status:** **OPERATIONAL — HEALTH MODEL** · **Date established:** 2026-05-08 · **Authority:** subordinate to `runtime-governance-telemetry.md`, `runtime-integrity-dashboard.md`, `constitutional-runtime-alerts.md`

This doc defines how the platform measures **constitutional health** — the composite operational metric that lets operators observe integrity degradation BEFORE trust collapse occurs.

The contract: **constitutional health is NOT cryptographic certainty** (per non-negotiable rule #4). It is observable degradation; operators interpret + act.

---

## 1. The 6 health dimensions

| # | Dimension | Source TGs | Per-state thresholds |
|---|---|---|---|
| **CH-1** | Constitutional health (composite) | TG-1 + TG-6 | Per CHI in `runtime-governance-telemetry.md` §3 |
| **CH-2** | Survivability health | TG-2 + TG-3 + TG-4 + TG-5 | Composite weighted average |
| **CH-3** | Replay coherence health | TG-2 + CIS-5 | Replay state distribution + vocabulary divergence |
| **CH-4** | Export coherence health | TG-3 + EX-3 availability | Cross-path variance + EX-3 SLA |
| **CH-5** | Forensic continuity health | TG-5 + audit retention SLA + CIS-4 | Composite |
| **CH-6** | Dashboard/runtime coherence health | TG-7 | Widget vs canonical-query variance |

---

## 2. Per-dimension health calculation

### 2.1 CH-1 Constitutional health

```
CH-1 = mean(TG-1, TG-6)
where each maps:
  🟢 → 100
  🟡 → 70
  🟠 → 40
  🔴 → 0
```

| Range | State |
|---|---|
| 90-100 | 🟢 HEALTHY |
| 70-90 | 🟡 DEGRADED |
| 40-70 | 🟠 DRIFTING |
| 0-40 | 🔴 COLLAPSING |

### 2.2 CH-2 Survivability health

```
CH-2 = weighted_mean(
  TG-2 (replay survivability) × 0.30,
  TG-3 (export degradation) × 0.25,
  TG-4 (lineage degradation) × 0.20,
  TG-5 (forensic degradation) × 0.25
)
```

Weights reflect operational priority (replay + forensic carry highest weight).

### 2.3 CH-3 Replay coherence

```
CH-3 = composite(
  R-state_distribution_anomaly_score,
  cross_vocabulary_query_variance
)
```

Anomaly score: deviation from baseline R-OBSERVED / R-DENIED / R-COLLAPSED ratio. Variance: per `replay-taxonomy-map.md` taxonomy.

### 2.4 CH-4 Export coherence

```
CH-4 = composite(
  EX_path_variance,
  EX-3_response_time,
  EX-3_availability_pct
)
```

EX_path_variance: EX-1 vs EX-3 row-count delta (DL-8 baseline ~50%; deviation > 10% degrades).

### 2.5 CH-5 Forensic continuity

```
CH-5 = composite(
  audit_retention_pct (current / SLA target),
  T0_critical_log_rate (lower better),
  chain_completeness_pct
)
```

### 2.6 CH-6 Dashboard/runtime coherence

```
CH-6 = mean(per_widget_variance_pct), inverted
```

Lower mean variance = higher coherence.

---

## 3. The Constitutional Health Score (composite)

A single platform-wide score:

```
CHS = weighted_mean(
  CH-1 × 0.20,  # constitutional drift (PR-time)
  CH-2 × 0.25,  # survivability (runtime)
  CH-3 × 0.15,  # replay coherence
  CH-4 × 0.15,  # export coherence
  CH-5 × 0.15,  # forensic continuity
  CH-6 × 0.10   # dashboard coherence
)
```

| CHS range | Aggregate state |
|---|---|
| 90-100 | 🟢 HEALTHY |
| 75-90 | 🟡 DEGRADED |
| 50-75 | 🟠 DRIFTING |
| 0-50 | 🔴 COLLAPSING |

---

## 4. Per-state operator action

| Aggregate state | Operator action |
|---|---|
| 🟢 HEALTHY | No action; continuous monitoring |
| 🟡 DEGRADED | Investigate degraded dimension(s); update runbook |
| 🟠 DRIFTING | Quarterly governance review escalated to monthly; founder informed |
| 🔴 COLLAPSING | Immediate ops/SOC/founder coordination; identify breach class per `constitutional-breach-taxonomy.md` (W2-PR13A) |

---

## 5. Health score visibility

The CHS is surfaced as:

1. **Top-of-dashboard widget** (W-1 from `runtime-integrity-dashboard.md`).
2. **Quarterly governance review report.**
3. **Founder briefing** when state crosses 🟢 → 🟡 → 🟠 → 🔴 threshold.
4. **Codex audit transcript** for every wave merge (per `codex-constitutional-prompt-layer.md`).

---

## 6. Health degradation precedes trust collapse

The model's purpose: **observe integrity degradation BEFORE trust collapse occurs.** Degradation patterns:

| Degradation | Precedes... |
|---|---|
| TG-1 → 🟠 (forbidden phrases creeping in) | Marketing inflation; external trust collapse |
| TG-2 → 🟠 (replay survivability drift) | F-4 collapse; capture-replay invisibility |
| TG-3 → 🟠 (export degradation) | Forensic blindness; SOC failure |
| TG-4 → 🟠 (lineage degradation) | Audit-chain breaks; compliance failure |
| TG-7 → 🟠 (dashboard mismatch) | Operator misinformation; decision drift |

Operators acting at 🟡 DEGRADED stage prevent escalation to 🟠 DRIFTING / 🔴 COLLAPSING.

---

## 7. Closing principle (constitutional health model)

The model converts 6 dimensions into 1 composite score. It is observability-grade, NOT certification-grade. Operators interpret; founder approves; SOC plays runbook.

**Constitutional health is OBSERVABLE. It is NOT GUARANTEED. The score is the measurement; the response is the discipline.**
