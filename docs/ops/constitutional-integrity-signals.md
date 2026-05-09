# Constitutional Integrity Signals

**Status:** **OPERATIONAL — RUNTIME-DETECTABLE SIGNAL DEFINITIONS** · **Date established:** 2026-05-08 · **Authority:** subordinate to `constitutional-enforcement-matrix.md`, `constitutional-drift-registry.md`, `operational-guarantee-matrix.md`

This doc defines **runtime-detectable signals** for constitutional drift, replay degradation, export degradation, audit degradation, taxonomy divergence, dashboard mismatch, lineage fragmentation, and denial observability degradation.

The contract: **monitoring is NOT prevention** (per non-negotiable rule #1). These signals make drift OBSERVABLE; operators take action.

---

## 1. The 8 signal categories

| # | Signal | Source data | Detection latency |
|---|---|---|---|
| **CIS-1** | Replay inflation drift | PR description scan + CI-grep | per-PR (seconds) |
| **CIS-2** | Trust-class mismatch drift | Audit-row counts vs declared class | continuous |
| **CIS-3** | Export survivability degradation | EX-1 vs EX-3 row-count variance | continuous |
| **CIS-4** | Audit survivability degradation | T0 CRITICAL log volume | continuous |
| **CIS-5** | Replay taxonomy divergence | Cross-vocabulary query result variance | per-query |
| **CIS-6** | Dashboard/runtime mismatch | Widget count vs Q-CANON canonical query | quarterly + on-demand |
| **CIS-7** | Lineage fragmentation increase | Audit chain incompleteness rate | continuous |
| **CIS-8** | Denial observability degradation | Denial-rate variance vs 7-day baseline | continuous |

---

## 2. Per-signal detection definition

### 2.1 CIS-1 Replay inflation drift

**Detection method:** CI-grep on PR content + Codex SAFE audit prompt scan for forbidden phrases (per `semantic-drift-detection.md` §2.1).

**Signal data:** boolean per PR.

**Confidence:** 🟢 HIGH (whole-word regex; allowlist for legitimate uses).

**FP risk:** LOW (allowlist managed).

**Runtime observability:** PR-build time.

**Operator visibility:** PR review comments + Codex verdict in transcript.

### 2.2 CIS-2 Trust-class mismatch drift

**Detection method:** for each audit-emitting code path, verify class-assignment matches `runtime-trust-class-map.md`.

**Signal data:** count of paths without explicit class declaration.

**Confidence:** 🟡 MEDIUM (semantic; depends on Codex prompt + reviewer).

**FP risk:** LOW.

**Runtime observability:** discoverable via grep + reviewer playbook.

**Operator visibility:** dashboard widget showing "unclassified path count."

### 2.3 CIS-3 Export survivability degradation

**Detection method:** compare row counts between SIEM stream (EX-1) and Postgres direct (EX-3) for the same time window.

**Query:**
```sql
-- EX-3 count
SELECT COUNT(*) FROM audit_events WHERE created_at BETWEEN $start AND $end;
-- EX-1 count from SIEM (out-of-band)
-- variance > 10% (DL-8 baseline) suggests new T2 writers OR T0 dual-write failures
```

**Confidence:** 🟢 HIGH.

**FP risk:** MEDIUM (DL-8 SIEM gap is a STRUCTURAL constant; need baseline-aware variance).

**Runtime observability:** continuous; daily comparison.

**Operator visibility:** dashboard widget showing "EX-1 vs EX-3 variance %."

### 2.4 CIS-4 Audit survivability degradation

**Detection method:** monitor CRITICAL log volume from `audit_ledger_persist_failed` (T0 dual-write failures per `auditService.ts:97`).

**Signal data:** CRITICAL log count per hour.

**Confidence:** 🟢 HIGH.

**FP risk:** LOW.

**Runtime observability:** structured logs.

**Operator visibility:** dashboard widget; alerting on > baseline.

### 2.5 CIS-5 Replay taxonomy divergence

**Detection method:** run canonical replay-rate query (Q-CANON-3 / Q-CANON-7) AND single-vocabulary variant; variance suggests new literals.

**Signal data:** count discrepancy.

**Confidence:** 🟡 MEDIUM.

**FP risk:** MEDIUM.

**Runtime observability:** per-query comparison.

**Operator visibility:** SOC playbook + quarterly audit.

### 2.6 CIS-6 Dashboard/runtime mismatch

**Detection method:** for each dashboard widget, compare its count to canonical query (Q-CANON-*) for same time window. Variance > threshold suggests widget query drift.

**Signal data:** per-widget variance.

**Confidence:** 🟡 MEDIUM.

**FP risk:** MEDIUM (eventual consistency; small windows naturally variant).

**Runtime observability:** quarterly + on-demand.

**Operator visibility:** dashboard reviewer + widget label "Last canonical-cross-check: <timestamp>."

### 2.7 CIS-7 Lineage fragmentation increase

**Detection method:** audit-chain reconstruction completeness rate. For sample logical operations, verify all expected events are present.

**Signal:**
```sql
-- Per traceId, count distinct expected event types
SELECT
  metadata->>'traceId' AS trace_id,
  COUNT(DISTINCT type) AS event_types
FROM audit_events
WHERE metadata->>'traceId' IS NOT NULL
GROUP BY trace_id;
```

Drop in mean event_types over time = increased fragmentation.

**Confidence:** 🟡 MEDIUM.

**FP risk:** MEDIUM.

**Runtime observability:** weekly batch.

**Operator visibility:** dashboard widget showing "mean events per chain (7-day rolling)."

### 2.8 CIS-8 Denial observability degradation

**Detection method:** denial-rate variance vs 7-day baseline. Sudden drop > 50% suggests F-4 regression.

**Query:**
```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) FILTER (WHERE metadata->>'outcome' = 'denied') AS denied_count
FROM audit_events
WHERE created_at > now() - interval '7 days'
GROUP BY hour;
```

Compare current hour to 7-day baseline.

**Confidence:** 🟢 HIGH.

**FP risk:** LOW.

**Runtime observability:** continuous; per-hour aggregation.

**Operator visibility:** dashboard widget + alerting.

---

## 3. Signal aggregate matrix

| Signal | Detection method | Confidence | FP risk | Runtime obs | Operator vis |
|---|---|---|---|---|---|
| CIS-1 Replay inflation | CI-grep + Codex | 🟢 HIGH | LOW | PR-build | PR + Codex transcript |
| CIS-2 Trust-class mismatch | Path classification | 🟡 MED | LOW | discoverable | Dashboard |
| CIS-3 Export degradation | Variance EX-1 vs EX-3 | 🟢 HIGH | MED | continuous | Dashboard |
| CIS-4 Audit T0 degradation | CRITICAL log volume | 🟢 HIGH | LOW | structured logs | Dashboard + alerting |
| CIS-5 Replay vocabulary divergence | Cross-vocab query | 🟡 MED | MED | per-query | SOC playbook |
| CIS-6 Dashboard mismatch | Widget vs Q-CANON | 🟡 MED | MED | quarterly | Reviewer |
| CIS-7 Lineage fragmentation | Chain completeness | 🟡 MED | MED | weekly | Dashboard |
| CIS-8 Denial degradation | Variance vs baseline | 🟢 HIGH | LOW | continuous | Dashboard + alerting |

---

## 4. Closing principle (signals)

These 8 signals make constitutional integrity OBSERVABLE without claiming PREVENTION. Each is grounded in runtime data; each has explicit detection method + confidence + FP risk; each surfaces to operator visibility.

**Monitoring is the discipline. Prevention is per-PR + per-deploy + per-runbook.** The signals close the loop.
