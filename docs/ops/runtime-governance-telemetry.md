# Runtime Governance Telemetry

**Status:** **OPERATIONAL — TELEMETRY CATEGORIES** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-integrity-signals.md`

This doc defines telemetry categories for runtime governance. Each category produces structured metrics; each metric has a state classification (🟢 HEALTHY / 🟡 DEGRADED / 🟠 DRIFTING / 🔴 VIOLATING).

---

## 1. The 7 telemetry categories

| # | Category | Source signals | Aggregation |
|---|---|---|---|
| **TG-1** | Constitutional drift | CIS-1, CIS-2, CIS-5 | Per-PR + per-quarter |
| **TG-2** | Replay survivability degradation | CIS-3, CIS-5 (replay-related) | Continuous |
| **TG-3** | Export degradation | CIS-3 | Continuous |
| **TG-4** | Lineage degradation | CIS-7 | Weekly |
| **TG-5** | Forensic degradation | CIS-3 + CIS-4 + CIS-7 (composite) | Daily |
| **TG-6** | Trust-class violations | CIS-1 + CIS-2 | Per-PR |
| **TG-7** | Dashboard/runtime divergence | CIS-6 | Quarterly + on-demand |

---

## 2. Per-category state classification

### 2.1 TG-1 Constitutional drift

| State | Threshold | Indicator |
|---|---|---|
| 🟢 HEALTHY | 0 forbidden phrases in last 7 PRs; 0 unclassified paths | Lexicon CI-grep clean |
| 🟡 DEGRADED | 1-2 forbidden phrases caught + remediated; 1-2 unclassified paths | Reviewer caught it |
| 🟠 DRIFTING | 3+ forbidden phrases in 7-PR window OR 3+ unclassified paths | Pattern emerging |
| 🔴 VIOLATING | Forbidden phrase merged without remediation | Constitutional breach |

### 2.2 TG-2 Replay survivability degradation

| State | Threshold | Indicator |
|---|---|---|
| 🟢 HEALTHY | Denial-rate variance ≤ 10% vs baseline; correlationId presence ≥ 95% on audit rows | Lock v2 working |
| 🟡 DEGRADED | Variance 10–30% OR correlationId presence 80–95% | Investigate |
| 🟠 DRIFTING | Variance 30–50% OR correlationId presence 60–80% | Regression risk |
| 🔴 VIOLATING | Variance > 50% drop (F-4 risk) OR correlationId < 60% | Hotfix; rollback consideration |

### 2.3 TG-3 Export degradation

| State | Threshold | Indicator |
|---|---|---|
| 🟢 HEALTHY | EX-1 vs EX-3 variance within DL-8 baseline (~50%) | Known structural gap stable |
| 🟡 DEGRADED | Variance shift > 10% from baseline | New T2 writers OR T0 dual-write failures |
| 🟠 DRIFTING | Variance shift > 25% | Operations review |
| 🔴 VIOLATING | EX-3 unavailable OR EX-3 row count drops > 50% from prior period | DB outage OR retention sweep error |

### 2.4 TG-4 Lineage degradation

| State | Threshold | Indicator |
|---|---|---|
| 🟢 HEALTHY | Mean events per chain ≥ baseline | Lineage intact |
| 🟡 DEGRADED | Mean events per chain 80–95% of baseline | Investigate (worker delay? T0 failures?) |
| 🟠 DRIFTING | 60–80% | Operations + audit team review |
| 🔴 VIOLATING | < 60% | Chain reconstruction broken |

### 2.5 TG-5 Forensic degradation

| State | Composite |
|---|---|
| 🟢 HEALTHY | TG-3 + TG-4 + CIS-4 all 🟢 |
| 🟡 DEGRADED | Any one 🟡 |
| 🟠 DRIFTING | Any one 🟠 OR two 🟡 |
| 🔴 VIOLATING | Any one 🔴 |

### 2.6 TG-6 Trust-class violations

| State | Threshold | Indicator |
|---|---|---|
| 🟢 HEALTHY | 0 unclassified audit-emitting paths | Codex audit clean |
| 🟡 DEGRADED | 1-2 paths flagged in PR review | Author updated |
| 🟠 DRIFTING | 3+ paths in 7-PR window | Reviewer training |
| 🔴 VIOLATING | T0 path mistakenly used for canonical event OR class-mismatch shipped | Hotfix |

### 2.7 TG-7 Dashboard/runtime divergence

| State | Threshold | Indicator |
|---|---|---|
| 🟢 HEALTHY | All widgets within 5% variance of canonical Q-CANON | Dashboard accurate |
| 🟡 DEGRADED | 1-2 widgets > 5% variance | Investigate widget query |
| 🟠 DRIFTING | 3+ widgets divergent | Dashboard governance review |
| 🔴 VIOLATING | Widget contains forbidden phrasing OR shows count > 50% off canonical | Remove widget pending fix |

---

## 3. Aggregate constitutional health metric

A single composite "Constitutional Health Index":

```
CHI = mean(TG-1, TG-2, TG-3, TG-4, TG-5, TG-6, TG-7)
where each TG_n maps:
  🟢 → 100
  🟡 → 70
  🟠 → 40
  🔴 → 0
```

| CHI range | Aggregate state |
|---|---|
| 90-100 | 🟢 HEALTHY |
| 70-90 | 🟡 DEGRADED |
| 40-70 | 🟠 DRIFTING |
| 0-40 | 🔴 VIOLATING |

---

## 4. Closing principle (telemetry)

Runtime governance telemetry is the operational data layer for the integrity signals. State classifications give operators a single-glance view; CHI provides aggregate health. Telemetry is observability, not autonomous correction.
